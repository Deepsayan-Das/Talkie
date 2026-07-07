import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import env from "../config/env";

export const jwtVerifyMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    try {
        const decodedToken = jwt.verify(token, env.jwt_secret);
        req.user = decodedToken;
        req.headers["x-user-id"] = (decodedToken as any).userId;
        next()
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "JWT validation failed";
        return res.status(401).json({ success: false, message });
    }
}