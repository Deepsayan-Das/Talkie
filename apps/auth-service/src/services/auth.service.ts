import bcrypt from 'bcryptjs'
import env from '../config/env'
import { assignRole, createRefreshToken, createUser, createVerificationToken, deleteRefreshToken, findLatestVerificationToken, findRefreshToken, findUserByEmail, findUserById, findVerificationToken, getRolesByUserId, markTokensUsed, rotateRefreshToken, updateUserRole } from '../repositories/auth.repository';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { blacklistToken } from '../utils/tokenBlacklist';
import redis from '../config/redis';
import logger from '../config/logger';

import { broker } from '../config/broker';

export const sendVerificationMail = async (user: any, email: string) => {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);
    await createVerificationToken(user.id, verificationTokenHash, expiresAt);

    const verificationUrl = `${env.client_url}/verify-email?token=${verificationToken}`;

    logger.info('Publishing verification email event', { email });
    if (broker) {
        await broker.publish('auth.user.registered', {
            email,
            verificationLink: verificationUrl
        });
    } else {
        logger.warn('Broker not initialized, fallback to redis');
        await redis.publish('auth.user.registered', JSON.stringify({
            email,
            verificationLink: verificationUrl
        }));
    }
    logger.info('Verification email event published', { email });
}


export const registerUser = async (email: string, password: string) => {
    logger.info('Checking if user already exists', { email });
    const isUserExist = await findUserByEmail(email);
    if (isUserExist) {
        logger.warn('Registration blocked — user already exists', { email });
        throw new Error('User already exists');
    }
    const hashedPassword: string = await bcrypt.hash(password, env.salt_rounds);
    const user = await createUser(email, hashedPassword);
    await assignRole(user.id, 'UNVERIFIED');
    logger.info('New user created and assigned UNVERIFIED role', { userId: user.id, email });

    const accessToken = jwt.sign(
        { userId: user.id, role: 'UNVERIFIED' },
        env.jwt_secret,
        { expiresIn: env.jwt_expires_in as any }
    );
    
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await createRefreshToken(user.id, refreshTokenHash, expiresAt);
    
    const { password_hash, ...safeUser } = user;
    return { ...safeUser, accessToken, refreshToken, role: 'UNVERIFIED' };

}



export const loginUser = async (email: string, password: string) => {
    const user = await findUserByEmail(email);
    if (!user) {
        logger.warn('Login failed — user not found', { email });
        throw new Error("INVALID CREDENTIALS");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
        logger.warn('Login failed — wrong password', { email });
        throw new Error("INVALID CREDENTIALS");
    }
    const roles = await getRolesByUserId(user.id);

    const accessToken = jwt.sign(
        { userId: user.id, role: roles },
        env.jwt_secret,
        { expiresIn: env.jwt_expires_in as any }
    )

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    // Delete any existing refresh tokens for this user before inserting a new one
    await deleteRefreshToken(user.id);
    await createRefreshToken(user.id, refreshTokenHash, expiresAt);
    
    const role = roles.includes('USER') || roles.includes('VERIFIED') ? 'VERIFIED' : 'UNVERIFIED';
    logger.info(`User login — issuing access + refresh tokens for role ${role}`, { userId: user.id });
    
    return { accessToken, refreshToken, role };
}

export const verifyUser = async (token: string) => {
    const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')
    const verificationToken = await findVerificationToken(tokenHash);
    if (!verificationToken) {
        logger.warn('Email verification failed — token not found');
        throw new Error("INVALID VERIFICATION TOKEN");
    }

    if (new Date(verificationToken.expires_at).getTime() < Date.now()) {
        logger.warn('Email verification failed — token expired', { userId: verificationToken.user_id });
        throw new Error("VERIFICATION TOKEN EXPIRED");
    }
    if (verificationToken.is_used) {
        logger.warn('Email verification failed — token already used', { userId: verificationToken.user_id });
        throw new Error("VERIFICATION TOKEN ALREADY USED");
    }
    const userId = verificationToken.user_id;
    await markTokensUsed(userId, tokenHash);
    await updateUserRole(userId, 'USER');
    logger.info('User email verified — role updated to USER', { userId });
    const accessToken = jwt.sign(
        { userId: userId, role: 'USER' },
        env.jwt_secret,
        { expiresIn: env.jwt_expires_in as any }
    )

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await createRefreshToken(userId, refreshTokenHash, expiresAt);
    return { accessToken, refreshToken };

}

export const resendVerificationMail = async (userId: string) => {
    logger.info('Resend verification mail requested', { userId });
    const latestToken = await findLatestVerificationToken(userId);
    if (!latestToken) {
        logger.warn('Resend verification — no token record found (unregistered user)', { userId });
        throw new Error("NOT A REGISTERED USER");
    }
    if (new Date(latestToken.expires_at).getTime() > Date.now()) {
        logger.warn('Resend verification — active link still exists', { userId });
        throw new Error("Active Link Exists");
    }
    if (latestToken.is_used) {
        logger.warn('Resend verification — user already verified', { userId });
        throw new Error("USER ALREADY VERIFIED");
    }
    const user = await findUserById(userId)
    if (!user) {
        logger.warn('Resend verification — user record not found', { userId });
        throw new Error("USER NOT FOUND");
    }
    await sendVerificationMail(user, user.email)
    logger.info('Verification email resent successfully', { userId });
    return { message: 'Verification email sent' }

}

export const rotateTokens = async (rawRefreshToken: string) => {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')
    const oldToken = await findRefreshToken(tokenHash)
    if (!oldToken) {
        logger.warn('Token rotation failed — refresh token not found in DB');
        throw new Error("NOT REGISTERED");
    }
    const userId = oldToken.user_id
    const roles = await getRolesByUserId(userId);
    if (new Date(oldToken.expires_at).getTime() < Date.now()) {
        logger.warn('Token rotation failed — refresh token expired', { userId });
        throw new Error("Refresh Token Expired");
    }
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await rotateRefreshToken(userId, refreshTokenHash, expiresAt);
    const accessToken = jwt.sign(
        { userId: userId, role: roles.includes('USER') ? 'USER' : 'UNVERIFIED' },
        env.jwt_secret,
        { expiresIn: env.jwt_expires_in as any }
    )
    logger.info('Tokens rotated successfully', { userId });
    return { accessToken, refreshToken };
}

export const logoutUser = async (userId: string, accessToken: string) => {
    logger.info('Logging out user — blacklisting access token', { userId });
    // Blacklist the accessToken in Redis so it's immediately invalid
    await blacklistToken(accessToken);
    // Remove the refresh token from the DB
    await deleteRefreshToken(userId);
    logger.info('User logged out — refresh token removed', { userId });
    return { message: 'Logout successful' };
}