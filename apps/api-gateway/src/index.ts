import express, { Request, Response, NextFunction } from "express";
import env from "./config/env";
import { corsMiddleware } from "./middleware/cors.middleware";
import { loggerMiddleware } from "./middleware/logger.middleware";
import { jwtVerifyMiddleware } from "./middleware/jwtVerify.middleware";
import { globalRateLimiter, authRateLimiter } from "./middleware/ratelimitter.middleware";
import { services } from "./config/routes";
import { createProxy } from "./proxy";
import logger from "./config/logger";
import { metrics } from "./config/metrics";

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.send(await metrics.register.metrics());
});

app.use(corsMiddleware);
app.use(loggerMiddleware);
app.use(globalRateLimiter);

/**
 * Mount one proxy per downstream service.
 * 
 * When Express sees `app.use('/auth', ...)`, it strips '/auth' and hands
 * the proxy `req.url = '/register'` (i.e. the *remainder* after the mount).
 * pathRewrite therefore rewrites THAT remainder — not the full original path.
 *
 * Each ServiceConfig lists which sub-paths are public (no JWT required)
 * so we can apply guards inline before the proxy runs.
 */
services.forEach((svc) => {
    const proxy = createProxy(svc.target, svc.pathRewrite);

    // Rate-limit auth endpoints
    const preMiddleware: express.RequestHandler[] = [];
    if (svc.mountPrefix.startsWith('/auth')) {
        preMiddleware.push(authRateLimiter);
    }

    app.use(svc.mountPrefix, ...preMiddleware, (req: Request, res: Response, next: NextFunction) => {
        // Selectively skip JWT for public paths
        const isPublic = svc.publicPaths?.some(p => req.path.startsWith(p));
        if (isPublic) return next();
        return jwtVerifyMiddleware(req, res, next);
    }, proxy);
});

app.listen(env.port, () => {
    logger.info(`API Gateway started on port ${env.port}`);
});