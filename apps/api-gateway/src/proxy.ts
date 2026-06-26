import { createProxyMiddleware } from "http-proxy-middleware";
import { Request, Response } from "express";

export const createProxy = (target: string) => {
    return createProxyMiddleware<Request, Response>({
        target,
        changeOrigin: true,
        on: {
            error: (err, req, res: any) => {
                res.status(502).json({ success: false, message: "Service unavailable" });
            }
        }
    });
};