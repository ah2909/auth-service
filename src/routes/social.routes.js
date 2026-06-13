import { Router } from "express";
import { authLimiter } from "../middlewares/rateLimit.middleware.js";
import { auth_middleware } from "../middlewares/auth.middleware.js";
import * as socialController from "../controllers/social.controller.js";

const router = Router();

router.post("/auth/google/verify", authLimiter(10), socialController.googleVerify);
router.get("/protected-social", auth_middleware, socialController.protectedSocial);

export default router;
