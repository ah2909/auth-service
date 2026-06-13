import rateLimit from "express-rate-limit";
import { RATE_LIMIT_WINDOW_MS } from "../config/index.js";

// Builds a fixed-window rate limiter; `max` lets each route tune its own
// allowance (e.g. stricter on password endpoints than on OAuth).
export const authLimiter = (max) =>
    rateLimit({
        windowMs: RATE_LIMIT_WINDOW_MS,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: { message: "Too many requests, please try again later." },
    });
