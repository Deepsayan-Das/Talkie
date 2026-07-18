import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";

export const errorMiddleware = (err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error("Unhandled error in key-service", { error: err.message, stack: err.stack });
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
};
