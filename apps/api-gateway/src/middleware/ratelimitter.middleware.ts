import { rateLimit } from "express-rate-limit";

export const globalRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 1000,
    message: { success: false, message: "Too many requests, please try again later" }
});

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: "Too many auth attempts, please try again later" }
});