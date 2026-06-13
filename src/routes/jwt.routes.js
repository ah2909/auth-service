import { Router } from "express";
import { body } from "express-validator";
import { authLimiter } from "../middlewares/rateLimit.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { auth_middleware } from "../middlewares/auth.middleware.js";
import * as jwtController from "../controllers/jwt.controller.js";

const router = Router();

const registerValidators = [
    body("email").isEmail().normalizeEmail(),
    body("password").isString().isLength({ min: 8, max: 72 }).withMessage("Password must be 8-72 characters"),
    body("fullname").optional().isString().trim().isLength({ max: 50 }),
];

const loginValidators = [
    body("email").isEmail().normalizeEmail(),
    body("password").isString().isLength({ max: 72 }),
];

router.get("/", jwtController.root);
router.get("/protected", auth_middleware, jwtController.protectedRoute);
router.post("/register", authLimiter(5), registerValidators, validate, jwtController.register);
router.post("/login", authLimiter(5), loginValidators, validate, jwtController.login);
router.post("/refresh", jwtController.refresh);
router.post("/logout", jwtController.logout);
router.get("/me", auth_middleware, jwtController.me);
router.get("/.well-known/jwks.json", jwtController.jwks);

export default router;
