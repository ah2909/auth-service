import { Router } from "express"
import { auth_middleware } from "../middlewares/middlewares.js"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import User from "../models/User.js"
import { publicKey, privateKey } from "../../index.js"
import { exportJWK } from 'jose';
import { createPublicKey } from 'crypto';

const JWTRouter = Router();



JWTRouter.get('/protected', auth_middleware, (req, res) => {
    res.send('Welcome to the protected route');
});

JWTRouter.get("/", function(req, res) {
    return res.send("Hello World");
});

JWTRouter.post('/register', async (req, res) => {
    try {
        let body = req.body;
        const hash = await bcrypt.hash(body.password, 10);
        await User.create({
            email: body.email,
            password_hash: hash,
            full_name: body.fullname || null
        })
        res.json({
            message: 'Register successfully'
        }, 201)
    } catch (error) {
        console.log(error.message)
        res.json({
            error_message: error.message
        }, 400)
    } 
    
});

JWTRouter.post('/login', async (req, res) => {
    try {
        let body = req.body;
        let user = await User.findOne({
            where: {
                email: body.email
            }
        })

        if(!user) {
            res.json({
                message: "Wrong email or password"
            })
            return
        }
        
        let data = user.dataValues;
        const match = await bcrypt.compare(body.password, data.password_hash);
        if(match) {
            const accessToken = jwt.sign( 
                { 
                    id: data.id, 
                    email: data.email, 
                    name: data.full_name, 
                    avatar_url: data?.avatar_url 
                },
                privateKey, 
                { 
                    expiresIn: '1h',
                    algorithm: 'RS256' 
                });
            const refreshToken = jwt.sign( 
                { 
                    id: data.id, 
                    email: data.email, 
                    name: data.full_name, 
                    avatar_url: data?.avatar_url 
                }, 
                privateKey, 
                { 
                    expiresIn: '7d',
                    algorithm: 'RS256'
                });
                
            res
            .clearCookie('refreshToken', { 
                httpOnly: true,
                path: '/',
                secure: true,      
                sameSite: 'none',
                maxAge: 0,
                domain: process.env.FRONTEND_URL
            })
            .cookie('refreshToken', refreshToken, { 
                httpOnly: true,
                path: '/',
                secure: true,
                sameSite: 'none',
                maxAge: 7 * 24 * 60 * 60 * 1000,
                domain: process.env.FRONTEND_URL
            })
            .json({
                user_id: data.id,
                access_token: accessToken,
                refresh_token: refreshToken,
                message: "Login successfully"
            });
        }
        else {
            res.json({
                message: "Wrong email or password"
            })
        }    
    } catch (error) {
        console.log(error.message)
        res.json({
            error_message: error.message
        })
    }
    
});

JWTRouter.post('/refresh', (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    
    if (!refreshToken) {
        console.log('No refresh token provided');
        res
        .clearCookie('refreshToken', { 
            httpOnly: true,
            path: '/',
            secure: true,
            sameSite: 'none',
            maxAge: 0,
            domain: process.env.FRONTEND_URL
        })
        .status(401).json({
            message: 'Access Denied. No refresh token provided.'
        });
        return;
    }
  
    try {
        const decoded = jwt.verify(refreshToken, publicKey, { algorithms: ['RS256'] })

        const accessToken = jwt.sign(
            decoded, 
            privateKey, 
            { algorithm: 'RS256' }
        );
        const newRefreshToken = jwt.sign(
            decoded, 
            privateKey, 
            { algorithm: 'RS256' }
        );

        res
        .cookie('refreshToken', newRefreshToken, { 
            httpOnly: true,
            path: '/',
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            domain: process.env.FRONTEND_URL
        })
        .json({
            access_token: accessToken,
            refresh_token: newRefreshToken,
            message: "Refresh expired token successfully"
        });
    } catch (error) {
        console.log(error.message)
        res
        .clearCookie('refreshToken', { 
            httpOnly: true,
            path: '/',
            secure: true,
            sameSite: 'none',
            maxAge: 0,
            domain: process.env.FRONTEND_URL
        })
        .status(403).json({
            message: 'Invalid refresh token.'
        })
    }
});

JWTRouter.get('/logout', (req, res) => {
    res.clearCookie('refreshToken', { 
        httpOnly: true,
        path: '/',
        secure: true,
        sameSite: 'none',
        maxAge: 0,
        domain: process.env.FRONTEND_URL
    });
    res.json({
        message: 'Logout successfully'
    });
});

JWTRouter.get('/.well-known/jwks.json', async (req, res) => {
    try {
        const keyObject = createPublicKey(publicKey);
        const jwk = await exportJWK(keyObject);
        res.json({ keys: [jwk] });
    } catch (error) {
        console.error('Error exporting JWK:', error.message);
        res.status(500).json({ error: 'Failed to generate JWK' });
    }
});

export default JWTRouter;