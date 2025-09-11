import { Router } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import SocialLogin from "../models/SocialLogin.js";
import { auth_middleware } from "../middlewares/middlewares.js";
import { OAuth2Client } from "google-auth-library";
import { publicKey, privateKey } from "../../index.js";

const socialRouter = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

socialRouter.post("/auth/google/verify", async (req, res) => {
	const { idToken } = req.body;

	try {
		// Verify the ID token
		const ticket = await client.verifyIdToken({
			idToken: idToken,
			audience: process.env.GOOGLE_CLIENT_ID,
		});
		const payload = ticket.getPayload();

		// Check if user exists by Google ID or email
		let social = await SocialLogin.findOne({
			where: { provider_user_id: payload.sub },
		});

		if (!social) {
			// Check by email to link accounts or create new user
			let user = await User.findOne({
				where: { email: payload.email },
			});
			if (user) {
				//Update user account info
				user.email_verified = true;
				user.avatar_url = payload.picture;
				await user.save();

				// Link Google ID to existing user
				social = SocialLogin.build({
					user_id: user.id,
					provider: "google",
					provider_user_id: payload.sub,
				});
				await social.save();
			} else {
				// Create new user
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

		let user = await User.findOne({
			where: { email: payload.email },
		});

		const accessToken = jwt.sign(
			{
				id: user.id,
				email: user.email,
				name: user.full_name,
				avatar_url: user?.avatar_url,
			},
			privateKey,
			{
				expiresIn: "1h",
				algorithm: "RS256",
			}
		);
		const refreshToken = jwt.sign(
			{
				id: user.id,
				email: user.email,
				name: user.full_name,
				avatar_url: user?.avatar_url,
			},
			privateKey,
			{
				expiresIn: "7d",
				algorithm: "RS256",
			}
		);

		res.clearCookie("refreshToken", {
			httpOnly: true,
			path: "/",
			secure: true,
			sameSite: "none",
			maxAge: 0,
			domain: process.env.COOKIE_DOMAIN,
		})
			.cookie("refreshToken", refreshToken, {
				httpOnly: true,
				path: "/",
				secure: true,
				sameSite: "none",
				maxAge: 7 * 24 * 60 * 60 * 1000,
				domain: process.env.COOKIE_DOMAIN,
			})
			.json({
				message: "Login successfully",
				access_token: accessToken,
				refresh_token: refreshToken,
				user_id: user.id,
			});
	} catch (error) {
		console.error("Google verification failed:", error);
		res.status(401).json({ error: "Invalid Google token" });
	}
});

// Example protected route
socialRouter.get("/protected-social", auth_middleware, (req, res) => {
	res.json({ message: "Protected data", user: req.user });
});

export default socialRouter;
