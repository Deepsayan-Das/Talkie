import { loginUser, logoutUser, registerUser, resendVerificationMail, rotateTokens, sendVerificationMail, verifyUser } from "../services/auth.service";
import { Request, Response } from "express";
import jwt from 'jsonwebtoken';
import env from "../config/env";


export const registerController = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' })
    }
    try {
        const user = await registerUser(email, password);
        await sendVerificationMail(user, email);
        // New registrations are always UNVERIFIED — only send accessToken cookie
        res.status(201).json({ success: true, data: user })
    }
    catch (error: any) {
        console.log(error)
        if (error.message === 'User already exists') {
            return res.status(409).json({ success: false, message: error.message })
        }
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }

}

export const loginController = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' })
    }

    try {
        const user = await loginUser(email, password);
        if (user && user.role === 'UNVERIFIED') {
            // Unverified — accessToken in body only, no refreshToken
            res.status(200).json({ success: true, data: user })
        } else {
            // Verified — accessToken in body, refreshToken in httpOnly cookie
            res.cookie('refreshToken', user?.refreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            }).status(200).json({ success: true, data: user })
        }
    }
    catch (error: any) {
        console.log(error)
        if (error.message === 'INVALID CREDENTIALS') {
            return res.status(401).json({ success: false, message: error.message })
        }
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }

}

export const verifyUserController = async (req: Request, res: Response) => {
    try {
        const { token } = req.params;
        if (!token) {
            return res.status(400).json({ success: false, message: 'Verification token is required' })
        }
        const result = await verifyUser(token as string);
        // accessToken in body, refreshToken in httpOnly cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        }).status(200).json({ success: true, data: { accessToken: result.accessToken } })
    } catch (error: any) {

        if (error.message === 'INVALID VERIFICATION TOKEN') {
            return res.status(401).json({ success: false, message: error.message })
        }
        if (error.message === 'VERIFICATION TOKEN EXPIRED') {
            return res.status(410).json({ success: false, message: error.message })
        }
        if (error.message === 'VERIFICATION TOKEN ALREADY USED') {
            return res.status(409).json({ success: false, message: error.message })
        }
        console.log(error)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
}

export const resendVerificationMailController = async (req: Request, res: Response) => {
    try {
        const jwtToken = req.headers['authorization']?.split(' ')[1];
        if (!jwtToken) {
            return res.status(401).json({ success: false, message: 'No token provided' })
        }
        const payload = jwt.verify(jwtToken, env.jwt_secret) as { userId: string, role: string }
        const user = await resendVerificationMail(payload.userId);
        res.status(200).json({ success: true, data: user })

    } catch (error: any) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' })
        }
        if (error.message === "NOT A REGISTERED USER") {
            return res.status(404).json({ success: false, message: error.message })
        }
        if (error.message === "Active Link Exists") {
            return res.status(429).json({ success: false, message: error.message })
        }
        if (error.message === "USER ALREADY VERIFIED") {
            return res.status(403).json({ success: false, message: error.message })
        }
        console.log(error)
        return res.status(500).json({ success: false, message: "Internal server error" })
    }
}

export const rotateTokensController = async (req: Request, res: Response) => {
    try {
        const refreshToken = req.cookies['refreshToken']
        if (!refreshToken) {
            return res.status(401).json({ success: false, message: 'No refresh token' })
        }
        const result = await rotateTokens(refreshToken);
        // accessToken in body, refreshToken in httpOnly cookie
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        }).status(200).json({ success: true, data: { accessToken: result.accessToken } })
    } catch (error: any) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' })
        }
        if (error.message === "NOT REGISTERED") {
            return res.status(404).json({ success: false, message: error.message })
        }
        if (error.message === "USER NOT VERIFIED") {
            return res.status(403).json({ success: false, message: error.message })
        }
        if (error.message === "Refresh Token Expired") {
            return res.status(410).json({ success: false, message: error.message })
        }
        console.log(error)
        return res.status(500).json({ success: false, message: "Internal server error" })
    }
}

export const logoutController = async (req: Request, res: Response) => {
    try {
        const accessToken = req.headers['authorization']?.split(' ')[1];
        if (!accessToken) {
            return res.status(401).json({ success: false, message: 'No token provided' })
        }
        const payload = jwt.verify(accessToken, env.jwt_secret) as { userId: string, role: string }
        await logoutUser(payload.userId, accessToken);
        // Clear the refreshToken cookie
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: true,
            sameSite: 'strict'
        }).status(200).json({ success: true, message: 'Logged out successfully' })
    } catch (error: any) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' })
        }
        console.log(error)
        return res.status(500).json({ success: false, message: 'Internal server error' })
    }
}
