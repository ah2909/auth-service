import { Router } from "express";
import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createPublicKey } from "crypto";
import { exportJWK } from "jose";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import User from "../models/User.js";
import { publicKey, privateKey } from "../keys.js";
import redisClient from "../redis.js";
import { auth_middleware } from "../middlewares/middlewares.js";

const JWTRouter = Router();

const JTI_TTL = 7 * 24 * 60 * 60; // seconds

const cookieOptions = {
    httpOnly: true,
    path: "/",
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    domain: process.env.COOKIE_DOMAIN,
};
const clearCookieOptions = { ...cookieOptions, maxAge: 0 };

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests, please try again later." },
});

const registerValidators = [
    body("email").isEmail().normalizeEmail(),
    body("password").isString().isLength({ min: 8, max: 72 }).withMessage("Password must be 8–72 characters"),
    body("fullname").optional().isString().trim().isLength({ max: 50 }),
];

const loginValidators = [
    body("email").isEmail().normalizeEmail(),
    body("password").isString().isLength({ max: 72 }),
];

JWTRouter.get("/protected", auth_middleware, (req, res) => {
    res.send("Welcome to the protected route");
});

JWTRouter.get("/", (req, res) => {
    return res.send("Hello World");
});

JWTRouter.post("/register", authLimiter, registerValidators, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    try {
        const { email, password, fullname } = req.body;
        const hash = await bcrypt.hash(password, 10);
        await User.create({ email, password_hash: hash, full_name: fullname || null });
        return res.status(201).json({ message: "Register successfully" });
    } catch (error) {
        console.error("Registration error:", error.message);
        return res.status(500).json({ error_message: "Registration failed" });
    }
});

JWTRouter.post("/login", authLimiter, loginValidators, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    try {
        const { email, password } = req.body;
        const user = await User.findOne({ where: { email } });

        if (!user) {
            return res.status(401).json({ message: "Wrong email or password" });
        }

        const data = user.dataValues;

        if (!data.is_active) {
            return res.status(403).json({ message: "Account is disabled" });
        }

        const match = await bcrypt.compare(password, data.password_hash);
        if (!match) {
            return res.status(401).json({ message: "Wrong email or password" });
        }

        const tokenPayload = {
            id: data.id,
            email: data.email,
            name: data.full_name,
            avatar_url: data?.avatar_url,
        };
        const jti = randomUUID();

        const accessToken = jwt.sign(tokenPayload, privateKey, { expiresIn: "1h", algorithm: "RS256" });
        const refreshToken = jwt.sign({ ...tokenPayload, jti }, privateKey, { expiresIn: "7d", algorithm: "RS256" });

        await redisClient.set(`jti:${jti}`, String(data.id), { EX: JTI_TTL });

        return res.clearCookie("refreshToken", clearCookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json({ access_token: accessToken, message: "Login successfully" });
    } catch (error) {
        console.error("Login error:", error.message);
        return res.status(500).json({ message: "An unexpected error occurred" });
    }
});

JWTRouter.post("/refresh", async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.clearCookie("refreshToken", clearCookieOptions)
            .status(401)
            .json({ message: "Access Denied. No refresh token provided." });
    }

    try {
        const decoded = jwt.verify(refreshToken, publicKey, { algorithms: ["RS256"] });
        const { iat, exp, jti: oldJti, ...payload } = decoded;

        if (!oldJti) {
            return res.clearCookie("refreshToken", clearCookieOptions)
                .status(401).json({ message: "Invalid refresh token." });
        }

        const storedUserId = await redisClient.get(`jti:${oldJti}`);
        if (!storedUserId) {
            return res.clearCookie("refreshToken", clearCookieOptions)
                .status(401).json({ message: "Invalid refresh token." });
        }

        await redisClient.del(`jti:${oldJti}`);

        const userRecord = await User.findByPk(payload.id);
        if (!userRecord || !userRecord.is_active) {
            return res.clearCookie("refreshToken", clearCookieOptions)
                .status(403).json({ message: "Account is disabled" });
        }

        const newJti = randomUUID();
        const accessToken = jwt.sign(payload, privateKey, { expiresIn: "1h", algorithm: "RS256" });
        const newRefreshToken = jwt.sign({ ...payload, jti: newJti }, privateKey, { expiresIn: "7d", algorithm: "RS256" });

        await redisClient.set(`jti:${newJti}`, String(payload.id), { EX: JTI_TTL });

        return res.cookie("refreshToken", newRefreshToken, cookieOptions)
            .json({ access_token: accessToken, message: "Refresh expired token successfully" });
    } catch (error) {
        console.error("Refresh error:", error.message);
        return res.clearCookie("refreshToken", clearCookieOptions)
            .status(403).json({ message: "Invalid refresh token." });
    }
});

// Step 8 — changed from GET to POST
JWTRouter.post("/logout", async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, publicKey, { algorithms: ["RS256"] });
            if (decoded.jti) {
                await redisClient.del(`jti:${decoded.jti}`);
            }
        } catch (_) {
            // Expired/invalid token — JTI already gone, safe to ignore
        }
    }
    return res.clearCookie("refreshToken", clearCookieOptions)
        .json({ message: "Logout successfully" });
});

JWTRouter.get("/me", auth_middleware, (req, res) => {
    const { id, email, name, avatar_url } = req.user;
    res.json({ id, email, name, avatar_url });
});

JWTRouter.get("/.well-known/jwks.json", async (req, res) => {
    try {
        const keyObject = createPublicKey(publicKey);
        const jwk = await exportJWK(keyObject);
        res.json({ keys: [jwk] });
    } catch (error) {
        console.error("Error exporting JWK:", error.message);
        res.status(500).json({ error: "Failed to generate JWK" });
    }
});

export default JWTRouter;
