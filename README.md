# Auth Service

A reusable authentication service for rapid web application development. Provides JWT-based authentication and Google OAuth, designed to run as a standalone microservice that other services authenticate against via JWKS.

## Features

### RS256 JWT Authentication

Access tokens are signed with a 2048-bit RSA private key (RS256). Any service that needs to verify tokens fetches the public key from `/.well-known/jwks.json` and validates locally — no round-trip to the auth service on every request.

- **Access token** — short-lived (1 hour), included in API responses as `access_token`
- **Refresh token** — long-lived (7 days), stored in an HttpOnly cookie; used to obtain a new access token via `POST /refresh`

JWT payload:

```json
{
  "id": 1,
  "email": "user@example.com",
  "name": "Full Name",
  "avatar_url": "https://...",
  "iat": 1700000000,
  "exp": 1700003600
}
```

### Refresh Token Rotation with Redis JTI Tracking

Each refresh token embeds a UUID `jti` (JWT ID) claim. On issue, the JTI is stored in Redis with a 7-day TTL. On every `POST /refresh`:

1. The incoming refresh token is verified and its JTI is looked up in Redis.
2. If found, the old JTI is deleted and a new refresh token (with a new JTI) is issued.
3. If the JTI is missing (already used or expired), the request is rejected.

This prevents refresh token reuse: a stolen token can only be used once before it is invalidated.

### Logout with Token Invalidation

`POST /logout` reads the refresh token cookie, extracts its JTI, and deletes it from Redis immediately — even if the token has not expired yet. The cookie is then cleared.

### Google OAuth (ID Token verification)

The frontend obtains a Google ID token via the Google Sign-In flow and sends it to `POST /auth/google/verify`. The service verifies the token server-side using `google-auth-library`, then:

- If the Google account has never been seen: creates a new `User` and `SocialLogin` record.
- If the email already exists as a local account: links the Google identity to it and marks the email as verified.
- Issues the same access + refresh token pair as a local login.

### JWKS Endpoint

`GET /.well-known/jwks.json` exports the RSA public key as a JSON Web Key Set. Downstream services (e.g., the Laravel backend) can fetch this once and cache it to validate tokens without contacting the auth service on every request.

### Rate Limiting

`POST /register`, `POST /login`, and `POST /auth/google/verify` are limited to **10 requests per 15-minute window** per IP, using `express-rate-limit`. The service respects `X-Forwarded-For` when deployed behind a reverse proxy (`app.set('trust proxy', 1)`).

### Input Validation

Registration and login inputs are validated with `express-validator`:

| Field | Rule |
|-------|------|
| `email` | Valid email format, normalized |
| `password` | String, 8–72 characters |
| `fullname` | Optional string, max 50 characters |

Invalid requests receive a `422` response with a structured errors array.

### Account Status

All login paths (local and Google) check `is_active` on the user record. Disabled accounts receive a `403` response. The `POST /refresh` endpoint re-checks this on every token rotation.

### Secure Password Hashing

Passwords are hashed with bcrypt (cost factor 10). The raw password is never stored or logged.

### HttpOnly Cookies

Refresh tokens are set as `HttpOnly`, `Secure`, `SameSite=None` cookies. The domain is controlled by `COOKIE_DOMAIN` to support cross-subdomain deployments.

---

## Prerequisites

- Node.js v18+
- MariaDB
- Redis

## Installation

1. Install dependencies:

```bash
npm install
```

2. Generate RSA key pair:

```bash
openssl genrsa -out id_rsa_priv.pem 2048
openssl rsa -in id_rsa_priv.pem -pubout -out id_rsa_pub.pem
```

Keys must be placed in the project root (same directory as `index.js`).

3. Copy and fill in the environment file:

```bash
cp .env.example .env
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | Port the service listens on (e.g. `8086`) |
| `FRONTEND_URL` | Yes | Allowed CORS origin for the frontend |
| `BACKEND_URL` | Yes | Allowed CORS origin for the backend service |
| `COOKIE_DOMAIN` | Yes | Domain for the refresh token cookie (e.g. `.example.com`) |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `REDIS_HOST` | Yes | Redis host (default: `redis-cache`) |
| `REDIS_PORT` | No | Redis port (default: `6379`) |
| `REDIS_USERNAME` | No | Redis username (if ACL is enabled) |
| `REDIS_PASSWORD` | No | Redis password (if ACL is enabled) |
| `MARIADB_HOST` | Yes | MariaDB host |
| `MARIADB_PORT` | No | MariaDB port (default: `3306`) |
| `MARIADB_USER` | Yes | MariaDB username |
| `MARIADB_PASSWORD` | Yes | MariaDB password |
| `MARIADB_DATABASE` | Yes | MariaDB database name |

## Database

Uses MariaDB via Sequelize. Tables are created automatically on first run.

| Table | Purpose |
|-------|---------|
| `users` | Local accounts (email, hashed password, profile) |
| `social_logins` | Links Google identities to user records |

## Running

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

## API Endpoints

### JWT Authentication

#### `POST /register`

Create a new local account.

**Body:** `{ "email": "...", "password": "...", "fullname": "..." }`

**Responses:** `201 Created` / `422 Unprocessable Entity` / `500 Internal Server Error`

---

#### `POST /login`

Authenticate with email and password.

**Body:** `{ "email": "...", "password": "..." }`

**Response:**
```json
{ "access_token": "<jwt>", "message": "Login successfully" }
```
Sets a `refreshToken` HttpOnly cookie.

---

#### `POST /refresh`

Exchange a valid refresh token cookie for a new access token and a rotated refresh token.

**Response:**
```json
{ "access_token": "<jwt>", "message": "Refresh expired token successfully" }
```

---

#### `POST /logout`

Invalidate the current refresh token and clear the cookie.

---

#### `GET /me`

Return the authenticated user's profile. Requires `Authorization: Bearer <access_token>`.

**Response:**
```json
{ "id": 1, "email": "...", "name": "...", "avatar_url": "..." }
```

---

#### `GET /.well-known/jwks.json`

Return the RSA public key as a JSON Web Key Set for downstream token validation.

---

### Google OAuth

#### `POST /auth/google/verify`

Verify a Google ID token obtained by the frontend and issue auth tokens.

**Body:** `{ "idToken": "<google_id_token>" }`

**Response:**
```json
{ "access_token": "<jwt>", "message": "Login successfully" }
```
Sets a `refreshToken` HttpOnly cookie.
