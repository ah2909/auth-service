import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import SocialLogin from "../models/SocialLogin.js";
import { config } from "../config/index.js";
import {
    buildTokenPayload,
    signTokens,
    setRefreshCookie,
    clearRefreshCookie,
} from "../services/token.service.js";

const client = new OAuth2Client(config.googleClientId);

export async function googleVerify(req, res) {
    const { idToken } = req.body;

    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: config.googleClientId,
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

        const { accessToken, refreshToken } = await signTokens(buildTokenPayload(user));

        clearRefreshCookie(res);
        setRefreshCookie(res, refreshToken);
        return res.json({ message: "Login successfully", access_token: accessToken });
    } catch (error) {
        console.error("Google verification failed:", error);
        res.status(401).json({ error: "Invalid Google token" });
    }
}

export function protectedSocial(req, res) {
    res.json({ message: "Protected data", user: req.user });
}
