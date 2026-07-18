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
                const contentType: string = req.headers['content-type'] || '';

                // Multipart uploads must NOT be re-streamed — express.json() never
                // touches them so the raw multipart stream is still intact on req.
                // If we call proxyReq.write() here we'd corrupt or double-write it.
                if (contentType.includes('multipart/form-data')) {
                    return;
                }

                if (req.body && Object.keys(req.body).length > 0) {
                    // JSON body — express.json() consumed the stream, so we have to
                    // re-serialise it and write it into the outgoing proxy request.
                    const bodyData = JSON.stringify(req.body);
                    proxyReq.setHeader('Content-Type', 'application/json');
                    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                    proxyReq.write(bodyData);
                } else {
                    // No body — explicitly zero out Content-Length so the downstream
                    // service doesn't wait for bytes that never arrive (causes 408 hang)
                    proxyReq.setHeader('Content-Length', '0');
                }
            },
            /**
             * Rewrite Set-Cookie headers from downstream services.
             *
             * Without this, the auth-service sets `Set-Cookie: refreshToken=...; Domain=localhost`
             * bound to its own port (3001).  The browser will NOT send that cookie back to the
             * gateway (port 4000), so every call to /auth/rotate-tokens arrives with no cookie.
             *
             * We strip the Domain attribute entirely and preserve all other directives
             * (HttpOnly, Secure, SameSite, Max-Age, Path) so the cookie is scoped to
             * whatever origin the browser used to reach the gateway.
             */
            proxyRes: (proxyRes, req, res: any) => {
                const setCookieHeaders = proxyRes.headers['set-cookie'];
                if (setCookieHeaders) {
                    const rewritten = setCookieHeaders.map((cookie: string) =>
                        cookie
                            // Remove Domain=... so the cookie belongs to the gateway's origin
                            .replace(/;\s*Domain=[^;]*/gi, '')
                    );
                    proxyRes.headers['set-cookie'] = rewritten;
                }
            },
            error: (err, req, res: any) => {
                res.status(502).json({ success: false, message: "Service unavailable" });
            }
        }
    });
};