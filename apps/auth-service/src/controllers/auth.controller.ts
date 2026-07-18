import { loginUser, logoutUser, registerUser, resendVerificationMail, reissueTokensFromAccessToken, rotateTokens, sendVerificationMail, verifyUser } from "../services/auth.service";
import { Request, Response } from "express";
import jwt from 'jsonwebtoken';
import env from "../config/env";
import logger from "../config/logger";


export const registerController = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        logger.warn('Register attempt with missing fields', { email });
        return res.status(400).json({ success: false, message: 'Email and password are required' })
    }
    try {
        logger.info('Registering new user', { email });
        const user = await registerUser(email, password);
        await sendVerificationMail(user, email);
        logger.info('User registered successfully', { userId: user.id, email });
        res.cookie('refreshToken', user.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        }).status(201).json({ success: true, data: user })
    }
    catch (error: any) {
        if (error.message === 'User already exists') {
            logger.warn('Registration failed — user already exists', { email });
            return res.status(409).json({ success: false, message: error.message })
        }
        logger.error('Registration failed with unexpected error', { email, error: error.message });
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }

}

export const loginController = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        logger.warn('Login attempt with missing fields', { email });
        return res.status(400).json({ success: false, message: 'Email and password are required' })
    }

    try {
        logger.info('Login attempt', { email });
        const user = await loginUser(email, password);
        logger.info('User logged in successfully', { email });
        const cookieOptions: any = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        };
        if (user?.role !== 'UNVERIFIED') {
            cookieOptions.maxAge = 7 * 24 * 60 * 60 * 1000;
        }
        res.cookie('refreshToken', user?.refreshToken, cookieOptions).status(200).json({ success: true, data: user })
    }
    catch (error: any) {
        if (error.message === 'INVALID CREDENTIALS') {
            logger.warn('Login failed — invalid credentials', { email });
            return res.status(401).json({ success: false, message: error.message })
        }
        logger.error('Login failed with unexpected error', { email, error: error.message });
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }

}

export const verifyUserController = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        if (!token) {
            logger.warn('Email verification attempt with missing token');
            return res.status(400).json({ success: false, message: 'Verification token is required' })
        }
        logger.info('Email verification attempt');
        const result = await verifyUser(token as string);
        logger.info('Email verified successfully');
        // accessToken in body, refreshToken in httpOnly cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        }).status(200).json({ success: true, data: { accessToken: result.accessToken } })
    } catch (error: any) {

        if (error.message === 'INVALID VERIFICATION TOKEN') {
            logger.warn('Email verification failed — invalid token');
            return res.status(401).json({ success: false, message: error.message })
        }
        if (error.message === 'VERIFICATION TOKEN EXPIRED') {
            logger.warn('Email verification failed — token expired');
            return res.status(410).json({ success: false, message: error.message })
        }
        if (error.message === 'VERIFICATION TOKEN ALREADY USED') {
            logger.warn('Email verification failed — token already used');
            return res.status(409).json({ success: false, message: error.message })
        }
        logger.error('Email verification failed with unexpected error', { error: error.message });
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
}

export const resendVerificationMailController = async (req: Request, res: Response) => {
    try {
        const jwtToken = req.headers['authorization']?.split(' ')[1];
        if (!jwtToken) {
            logger.warn('Resend verification — no token provided');
            return res.status(401).json({ success: false, message: 'No token provided' })
        }
        const payload = jwt.verify(jwtToken, env.jwt_secret) as { userId: string, role: string }
        logger.info('Resending verification email', { userId: payload.userId });
        const user = await resendVerificationMail(payload.userId);
        logger.info('Verification email resent successfully', { userId: payload.userId });
        res.status(200).json({ success: true, data: user })

    } catch (error: any) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            logger.warn('Resend verification — invalid or expired JWT');
            return res.status(401).json({ success: false, message: 'Invalid or expired token' })
        }
        if (error.message === "NOT A REGISTERED USER") {
            logger.warn('Resend verification — user not found');
            return res.status(404).json({ success: false, message: error.message })
        }
        if (error.message === "Active Link Exists") {
            logger.warn('Resend verification — active link already exists');
            return res.status(429).json({ success: false, message: error.message })
        }
        if (error.message === "USER ALREADY VERIFIED") {
            logger.warn('Resend verification — user already verified');
            return res.status(403).json({ success: false, message: error.message })
        }
        logger.error('Resend verification failed with unexpected error', { error: error.message });
        return res.status(500).json({ success: false, message: "Internal server error" })
    }
}

export const rotateTokensController = async (req: Request, res: Response) => {
    const buildCookieOptions = (accessToken: string) => {
        const payload = jwt.decode(accessToken) as any;
        const isUnverified = Array.isArray(payload?.role) ? payload.role.includes('UNVERIFIED') : payload?.role === 'UNVERIFIED';
        const opts: any = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        };
        if (!isUnverified) opts.maxAge = 7 * 24 * 60 * 60 * 1000;
        return opts;
    };

    try {
        const refreshToken = req.cookies['refreshToken'];
        if (!refreshToken) {
            logger.warn('Token rotation — no refresh token provided');
            return res.status(401).json({ success: false, message: 'No refresh token' });
        }

        try {
            // ── Happy path: normal cookie-based rotation ──────────────────────
            logger.info('Rotating tokens');
            const result = await rotateTokens(refreshToken);
            logger.info('Tokens rotated successfully');
            return res
                .cookie('refreshToken', result.refreshToken, buildCookieOptions(result.accessToken))
                .status(200)
                .json({ success: true, data: { accessToken: result.accessToken } });

        } catch (innerErr: any) {
            // ── Fallback: refresh token not in DB — try the access token ──────
            // This happens when the DB was wiped / row deleted while the user
            // still has a valid access token in localStorage. Instead of forcing
            // a full re-login, we use the still-valid access token as proof of
            // identity and re-issue a brand-new refresh token.
            if (innerErr.message === 'NOT REGISTERED') {
                const rawAccessToken = req.headers['authorization']?.split(' ')[1];
                if (!rawAccessToken) {
                    logger.warn('Token rotation fallback — no access token in Authorization header');
                    return res.status(401).json({ success: false, message: 'No refresh token' });
                }
                logger.info('Token rotation — refresh token missing from DB, falling back to access token');
                const result = await reissueTokensFromAccessToken(rawAccessToken);
                return res
                    .cookie('refreshToken', result.refreshToken, buildCookieOptions(result.accessToken))
                    .status(200)
                    .json({ success: true, data: { accessToken: result.accessToken } });
            }
            throw innerErr; // re-throw anything else
        }

    } catch (error: any) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            logger.warn('Token rotation — invalid or expired JWT');
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }
        if (error.message === 'USER NOT VERIFIED') {
            logger.warn('Token rotation — user not verified');
            return res.status(403).json({ success: false, message: error.message });
        }
        if (error.message === 'Refresh Token Expired') {
            logger.warn('Token rotation — refresh token expired');
            return res.status(410).json({ success: false, message: error.message });
        }
        logger.error('Token rotation failed with unexpected error', { error: error.message });
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

export const logoutController = async (req: Request, res: Response) => {
    try {
        const accessToken = req.headers['authorization']?.split(' ')[1];
        if (!accessToken) {
            logger.warn('Logout — no access token provided');
            return res.status(401).json({ success: false, message: 'No token provided' })
        }
        const payload = jwt.verify(accessToken, env.jwt_secret) as { userId: string, role: string }
        logger.info('User logging out', { userId: payload.userId });
        await logoutUser(payload.userId, accessToken);
        logger.info('User logged out successfully', { userId: payload.userId });
        // Clear the refreshToken cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        }).status(200).json({ success: true, message: 'Logged out successfully' })
    } catch (error: any) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            logger.warn('Logout — invalid or expired JWT');
            return res.status(401).json({ success: false, message: 'Invalid or expired token' })
        }
        logger.error('Logout failed with unexpected error', { error: error.message });
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
}
