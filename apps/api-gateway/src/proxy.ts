import { createProxyMiddleware } from "http-proxy-middleware";
import { Request, Response } from "express";

export const createProxy = (target: string, pathRewrite?: Record<string, string>) => {
    return createProxyMiddleware<Request, Response>({
        target,
        changeOrigin: true,
        pathRewrite,
        on: {
            /**
             * Re-stream the body that express.json() already consumed.
             * When express.json() runs before the proxy it reads the raw stream,
             * leaving an empty body for the proxy to forward.  We fix this by
             * serialising req.body back to JSON and writing it into the outgoing
             * proxy request with the corrected Content-Length header.
             */
            proxyReq: (proxyReq, req: any) => {
                if (req.body && Object.keys(req.body).length > 0) {
                    const bodyData = JSON.stringify(req.body);
                    proxyReq.setHeader('Content-Type', 'application/json');
                    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                    proxyReq.write(bodyData);
                }
            },
            error: (err, req, res: any) => {
                res.status(502).json({ success: false, message: "Service unavailable" });
            }
        }
    });
};