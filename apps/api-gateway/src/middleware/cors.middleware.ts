import { Request, Response, NextFunction } from "express";
import env from "../config/env";

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const allowedOrigins = [env.cors_origin]
    const origin = req.headers.origin as string;

    if (!allowedOrigins.includes(origin)) {
        return res.status(403).json({ success: false, message: "Origin not allowed" });
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE, PUT, PATCH");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, X-Forwarded-For");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "600");

    if (req.method === 'OPTIONS') {
        return res.status(200).send();
    }

    next();
}