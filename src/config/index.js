// Centralized environment configuration and shared constants.
// Validates required env vars once at startup and exposes a typed config object.

const REQUIRED_ENV = ["FRONTEND_URL", "BACKEND_URL"];

for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`Fatal: ${REQUIRED_ENV.join(" and ")} must be set`);
        process.exit(1);
    }
}

export const config = {
    port: process.env.PORT,
    frontendUrl: process.env.FRONTEND_URL,
    backendUrl: process.env.BACKEND_URL,
    cookieDomain: process.env.COOKIE_DOMAIN,
    googleClientId: process.env.GOOGLE_CLIENT_ID,
};

// Refresh-token lifetime, shared by the JWT `expiresIn`, the cookie maxAge,
// and the Redis JTI TTL so they can never drift apart.
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const JTI_TTL = REFRESH_TOKEN_TTL_SECONDS; // seconds
export const ACCESS_TOKEN_EXPIRES_IN = "1h";
export const REFRESH_TOKEN_EXPIRES_IN = "7d";

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export const cookieOptions = {
    httpOnly: true,
    path: "/",
    secure: true,
    sameSite: "none",
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
    domain: config.cookieDomain,
};

export const clearCookieOptions = { ...cookieOptions, maxAge: 0 };
