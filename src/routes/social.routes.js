import { Router } from "express";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import SocialLogin from "../models/SocialLogin.js";
import { auth_middleware } from "../middlewares/middlewares.js";
import { OAuth2Client } from "google-auth-library";
import { publicKey, privateKey } from "../keys.js";
import redisClient from "../redis.js";

const socialRouter = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const JTI_TTL = 7 * 24 * 60 * 60;

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

socialRouter.post("/auth/google/verify", authLimiter, async (req, res) => {
    const { idToken } = req.body;

    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();

        let social = await SocialLogin.findOne({
            where: { provider_user_id: payload.sub },
        });

        if (!social) {
            let user = await User.findOne({ where: { email: payload.email } });
            if (user) {
                user.email_verified = true;
                user.avatar_url = payload.picture;
                await user.save();

                social = SocialLogin.build({
                    user_id: user.id,
                    provider: "google",
                    provider_user_id: payload.sub,
                });
                await social.save();
            } else {
                user = User.build({
                    email: payload.email,
                    full_name: payload.name,
                    avatar_url: payload.picture,
                    is_active: true,
                    email_verified: true,
                });
                await user.save();

                social = SocialLogin.build({
                    user_id: user.id,
                    provider: "google",
                    provider_user_id: payload.sub,
                });
                await social.save();
            }
        }

        const user = await User.findOne({ where: { email: payload.email } });

        if (!user.is_active) {
            return res.status(403).json({ message: "Account is disabled" });
        }

        const tokenPayload = {
            id: user.id,
            email: user.email,
            name: user.full_name,
            avatar_url: user?.avatar_url,
        };
        const jti = randomUUID();

        const accessToken = jwt.sign(tokenPayload, privateKey, { expiresIn: "1h", algorithm: "RS256" });
        const refreshToken = jwt.sign({ ...tokenPayload, jti }, privateKey, { expiresIn: "7d", algorithm: "RS256" });

        await redisClient.set(`jti:${jti}`, String(user.id), { EX: JTI_TTL });

        return res.clearCookie("refreshToken", clearCookieOptions)
            .cookie("refreshToken", refreshToken, cookieOptions)
            .json({ message: "Login successfully", access_token: accessToken });
    } catch (error) {
        console.error("Google verification failed:", error);
        res.status(401).json({ error: "Invalid Google token" });
    }
});

socialRouter.get("/protected-social", auth_middleware, (req, res) => {
    res.json({ message: "Protected data", user: req.user });
});

export default socialRouter;
