import express from "express";
import cors from 'cors'
import JWTRouter from "./src/routes/jwt.routes.js";
import socialRouter from "./src/routes/social.routes.js";
import fs from "node:fs"
import cookieParser from "cookie-parser"

const app = express();
export const privateKey = fs.readFileSync('id_rsa_priv.pem', 'utf8');
export const publicKey = fs.readFileSync('id_rsa_pub.pem', 'utf8');

app.use(cors({
  origin: [process.env.FRONTEND_URL, process.env.BACKEND_URL],
  credentials: true,
}))
app.use(cookieParser())
app.use(express.json())
app.use(JWTRouter);
app.use(socialRouter)

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

app.listen(process.env.PORT, function(){
    console.log(`Listening on port ${process.env.PORT}`);
});