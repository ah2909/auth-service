import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { createPublicKey } from "crypto";
import { exportJWK } from "jose";
import User from "../models/User.js";
import { publicKey } from "../config/keys.js";
import {
    buildTokenPayload,
    signTokens,
    setRefreshCookie,
    clearRefreshCookie,
    revokeJti,
    lookupJti,
} from "../services/token.service.js";

export function root(req, res) {
    return res.send("Hello World");
}

export function protectedRoute(req, res) {
    res.send("Welcome to the protected route");
}

export async function register(req, res) {
    try {
        const { email, password, fullname } = req.body;
        const hash = await bcrypt.hash(password, 10);
        await User.create({ email, password_hash: hash, full_name: fullname || null });
        return res.status(201).json({ message: "Register successfully" });
    } catch (error) {
        console.error("Registration error:", error.message);
        return res.status(500).json({ error_message: "Registration failed" });
    }
}

export async function login(req, res) {
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

        const { accessToken, refreshToken } = await signTokens(buildTokenPayload(data));

        clearRefreshCookie(res);
        setRefreshCookie(res, refreshToken);
        return res.json({ access_token: accessToken, message: "Login successfully" });
    } catch (error) {
        console.error("Login error:", error.message);
        return res.status(500).json({ message: "An unexpected error occurred" });
    }
}

export async function refresh(req, res) {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        clearRefreshCookie(res);
        return res.status(401).json({ message: "Access Denied. No refresh token provided." });
    }

    try {
        const decoded = jwt.verify(refreshToken, publicKey, { algorithms: ["RS256"] });
        const { iat, exp, jti: oldJti, ...payload } = decoded;

        if (!oldJti) {
            clearRefreshCookie(res);
            return res.status(401).json({ message: "Invalid refresh token." });
        }

        const storedUserId = await lookupJti(oldJti);
        if (!storedUserId) {
            clearRefreshCookie(res);
            return res.status(401).json({ message: "Invalid refresh token." });
        }

        await revokeJti(oldJti);

        const userRecord = await User.findByPk(payload.id);
        if (!userRecord || !userRecord.is_active) {
            clearRefreshCookie(res);
            return res.status(403).json({ message: "Account is disabled" });
        }

        const { accessToken, refreshToken: newRefreshToken } = await signTokens(payload);

        setRefreshCookie(res, newRefreshToken);
        return res.json({ access_token: accessToken, message: "Refresh expired token successfully" });
    } catch (error) {
        console.error("Refresh error:", error.message);
        clearRefreshCookie(res);
        return res.status(403).json({ message: "Invalid refresh token." });
    }
}

export async function logout(req, res) {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
        try {
            const decoded = jwt.verify(refreshToken, publicKey, { algorithms: ["RS256"] });
            if (decoded.jti) {
                await revokeJti(decoded.jti);
            }
        } catch (_) {
            // Expired/invalid token — JTI already gone, safe to ignore
        }
    }
    clearRefreshCookie(res);
    return res.json({ message: "Logout successfully" });
}

export function me(req, res) {
    const { id, email, name, avatar_url } = req.user;
    res.json({ id, email, name, avatar_url });
}

export async function jwks(req, res) {
    try {
        const keyObject = createPublicKey(publicKey);
        const jwk = await exportJWK(keyObject);
        res.json({ keys: [jwk] });
    } catch (error) {
        console.error("Error exporting JWK:", error.message);
        res.status(500).json({ error: "Failed to generate JWK" });
    }
}
