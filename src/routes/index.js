import { Router } from "express";
import jwtRoutes from "./jwt.routes.js";
import socialRoutes from "./social.routes.js";

const router = Router();

router.use(jwtRoutes);
router.use(socialRoutes);

export default router;
