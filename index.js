import express from "express";
import cors from 'cors';
import cookieParser from "cookie-parser";
import JWTRouter from "./src/routes/jwt.routes.js";
import socialRouter from "./src/routes/social.routes.js";
import { sequelize } from "./src/sequelize.js";

if (!process.env.FRONTEND_URL || !process.env.BACKEND_URL) {
    console.error('Fatal: FRONTEND_URL and BACKEND_URL must be set');
    process.exit(1);
}

const app = express();

app.set('trust proxy', 1);
app.use(cors({
    origin: [process.env.FRONTEND_URL, process.env.BACKEND_URL],
    credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(JWTRouter);
app.use(socialRouter);

/*
payload JWT
{
  "id": user_id,
  "email": ,
  "name": ,
  "avatar_url": ,
  "iat": ,
  "exp":
}
*/
await sequelize.sync();

app.listen(process.env.PORT, function () {
    console.log(`Listening on port ${process.env.PORT}`);
});
