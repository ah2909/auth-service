import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { privateKey } from "../config/keys.js";
import redisClient from "../config/redis.js";
import {
    JTI_TTL,
    ACCESS_TOKEN_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN,
    cookieOptions,
    clearCookieOptions,
} from "../config/index.js";

// Shape of the JWT payload embedded in every access/refresh token.
export function buildTokenPayload(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.full_name,
        avatar_url: user?.avatar_url,
    };
}

// Signs a fresh access/refresh pair for `payload`, registering the refresh
// token's JTI in Redis so it can later be rotated or revoked. Returns both
// tokens; the caller decides how to deliver the refresh cookie.
export async function signTokens(payload) {
    const jti = randomUUID();

    const accessToken = jwt.sign(payload, privateKey, {
        expiresIn: ACCESS_TOKEN_EXPIRES_IN,
        algorithm: "RS256",
    });
    const refreshToken = jwt.sign({ ...payload, jti }, privateKey, {
        expiresIn: REFRESH_TOKEN_EXPIRES_IN,
        algorithm: "RS256",
    });

    await redisClient.set(`jti:${jti}`, String(payload.id), { EX: JTI_TTL });

    return { accessToken, refreshToken };
}

export function setRefreshCookie(res, refreshToken) {
    res.cookie("refreshToken", refreshToken, cookieOptions);
}

export function clearRefreshCookie(res) {
    res.clearCookie("refreshToken", clearCookieOptions);
}

// Invalidates a refresh token by removing its JTI from Redis.
export async function revokeJti(jti) {
    await redisClient.del(`jti:${jti}`);
}

// Returns the user id a refresh JTI is registered to, or null if unknown/expired.
export async function lookupJti(jti) {
    return redisClient.get(`jti:${jti}`);
}
