import { Request, Response, NextFunction } from "express";

export const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    console.log(`→ INBOUND REQUEST : ${req.method} ${req.url}`);
    res.on('finish', () => {
        const totalTime = Date.now() - startTime;
        const status = res.statusCode;

        const color =
            status >= 500 ? '\x1b[31m' :   // red
                status >= 400 ? '\x1b[33m' :   // yellow
                    status >= 300 ? '\x1b[36m' :   // cyan
                        '\x1b[32m';                     // green
        const reset = '\x1b[0m';

        console.log(`${color}${req.method} ${req.url} — ${status} — ${totalTime}ms${reset}`);
    });

    next();
};