import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import routes from "./routes/index.js";
import { config } from "./config/index.js";

const app = express();

app.set("trust proxy", 1);
app.use(cors({
    origin: [config.frontendUrl, config.backendUrl],
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(routes);

export default app;
