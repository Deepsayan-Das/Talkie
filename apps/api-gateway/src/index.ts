import express from "express";
import env from "./config/env";
import { corsMiddleware } from "./middleware/cors.middleware";
import { loggerMiddleware } from "./middleware/logger.middleware";
import { jwtVerifyMiddleware } from "./middleware/jwtVerify.middleware";
import { globalRateLimiter, authRateLimiter } from "./middleware/ratelimitter.middleware";
import { routes } from "./config/routes";
import { createProxy } from "./proxy";
import logger from "./config/logger";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(corsMiddleware);
app.use(loggerMiddleware);
app.use(globalRateLimiter);

routes.forEach((route) => {
    const middlewares: express.RequestHandler[] = [];

    if (route.prefix.startsWith("/auth")) {
        middlewares.push(authRateLimiter);
    }

    if (route.protected) {
        middlewares.push(jwtVerifyMiddleware);
    }

    middlewares.push(createProxy(route.target));

    app.use(route.prefix, ...middlewares);
});

app.listen(env.port, () => {
    logger.info(`API Gateway started on port ${env.port}`);
});