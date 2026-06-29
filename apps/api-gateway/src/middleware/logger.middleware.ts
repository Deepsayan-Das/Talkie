import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";

export const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    logger.info('Inbound request', { method: req.method, url: req.url, ip: req.ip });

    res.on('finish', () => {
        const totalTime = Date.now() - startTime;
        const status = res.statusCode;

        const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';

        logger[level]('Request completed', {
            method: req.method,
            url: req.url,
            status,
            durationMs: totalTime
        });
    });

    next();
};