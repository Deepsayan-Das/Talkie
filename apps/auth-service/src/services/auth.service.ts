import bcrypt from 'bcrypt'
import env from '../config/env'
import { assignRole, createRefreshToken, createUser, createVerificationToken, deleteRefreshToken, findLatestVerificationToken, findRefreshToken, findUserByEmail, findUserById, findVerificationToken, getRolesByUserId, markTokensUsed, rotateRefreshToken, updateUserRole } from '../repositories/auth.repository';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { getTestAccount, getTransporter, initializeTransporter } from '../config/mailTransporter';
import { verificationEmailTemplate } from '../templates/verification.email';
import { blacklistToken } from '../utils/tokenBlacklist';


export const sendVerificationMail = async (user: any, email: string) => {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 1);
    await createVerificationToken(user.id, verificationTokenHash, expiresAt);
    await initializeTransporter();
    const testAcc = await getTestAccount();
    const transporter = getTransporter();
    const verificationUrl = `${env.client_url}/verify?token=${verificationToken}`
    const info = await transporter.sendMail({
        from: `"Chat App" <${testAcc.user}>`,
        to: email,
        subject: 'Email Verification',
        html: verificationEmailTemplate(user.email, verificationUrl)
    })
    console.log('Preview URL:', nodemailer.getTestMessageUrl(info))
}


export const registerUser = async (email: string, password: string) => {
    const isUserExist = await findUserByEmail(email);
    if (isUserExist) {
        throw new Error('User already exists');
    }
    const hashedPassword: string = await bcrypt.hash(password, env.salt_rounds);
    const user = await createUser(email, hashedPassword);
    await assignRole(user.id, 'UNVERIFIED');

    const accessToken = jwt.sign(
        { userId: user.id, role: 'UNVERIFIED' },
        env.jwt_secret,
        { expiresIn: env.jwt_expires_in as any }
    );
    const { password_hash, ...safeUser } = user;
    return { ...safeUser, accessToken };

}



export const loginUser = async (email: string, password: string) => {
    const user = await findUserByEmail(email);
    if (!user) {
        throw new Error("INVALID CREDENTIALS");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
        throw new Error("INVALID CREDENTIALS");
    }
    const roles = await getRolesByUserId(user.id);

    const accessToken = jwt.sign(
        { userId: user.id, role: roles },
        env.jwt_secret,
        { expiresIn: env.jwt_expires_in as any }
    )



    if (roles.includes('UNVERIFIED')) {
        return { accessToken, role: 'UNVERIFIED' };
    }
    if (roles.includes('VERIFIED') || roles.includes('USER')) {
        const refreshToken = crypto.randomBytes(32).toString('hex');
        const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await createRefreshToken(user.id, refreshTokenHash, expiresAt);
        return { accessToken, refreshToken, role: 'VERIFIED' };


    }
    return null;


}

export const verifyUser = async (token: string) => {
    const tokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')
    const verificationToken = await findVerificationToken(tokenHash);
    if (!verificationToken) {
        throw new Error("INVALID VERIFICATION TOKEN");
    }

    if (new Date(verificationToken.expires_at).getTime() < Date.now()) {
        throw new Error("VERIFICATION TOKEN EXPIRED");
    }
    if (verificationToken.is_used) {
        throw new Error("VERIFICATION TOKEN ALREADY USED");
    }
    const userId = verificationToken.user_id;
    await markTokensUsed(userId, tokenHash);
    await updateUserRole(userId, 'USER');
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
    const latestToken = await findLatestVerificationToken(userId);
    if (!latestToken) {
        throw new Error("NOT A REGISTERED USER");
    }
    if (new Date(latestToken.expires_at).getTime() > Date.now()) {
        throw new Error("Active Link Exists");
    }
    if (latestToken.is_used) {
        throw new Error("USER ALREADY VERIFIED");
    }
    const user = await findUserById(userId)
    if (!user) {
        throw new Error("USER NOT FOUND");
    }
    await sendVerificationMail(user.id, user.email)
    return { message: 'Verification email sent' }

}

export const rotateTokens = async (rawRefreshToken: string) => {
    const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex')
    const oldToken = await findRefreshToken(tokenHash)
    if (!oldToken) {
        throw new Error("NOT REGISTERED");
    }
    const userId = oldToken.user_id
    const roles = await getRolesByUserId(userId);
    if (roles.includes('UNVERIFIED')) {
        throw new Error("USER NOT VERIFIED");
    }
    if (new Date(oldToken.expires_at).getTime() < Date.now()) {
        throw new Error("Refresh Token Expired");
    }
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await rotateRefreshToken(userId, refreshTokenHash, expiresAt);
    const accessToken = jwt.sign(
        { userId: userId, role: 'USER' },
        env.jwt_secret,
        { expiresIn: env.jwt_expires_in as any }
    )
    return { accessToken, refreshToken };
}

export const logoutUser = async (userId: string, accessToken: string) => {
    // Blacklist the accessToken in Redis so it's immediately invalid
    await blacklistToken(accessToken);
    // Remove the refresh token from the DB
    await deleteRefreshToken(userId);
    return { message: 'Logout successful' };
}