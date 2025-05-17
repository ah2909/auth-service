# Auth Service

A reusable authentication service template for rapid web application development. This service provides a complete authentication solution with JWT tokens and social login integration, serving as a foundation for building secure web applications. You can integrate with your frontend and get started easily.

## Features

- JWT-based authentication
- Google OAuth integration
- Refresh expired token
- HttpOnly cookies for refresh tokens
- Secure password hashing with bcrypt
- RS256 asymmetric key encryption

## Prerequisites

- Node.js (v16 or higher)
- MariaDB
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Generate RSA key pair for JWT:
```bash
# Generate private key
openssl genrsa -out id_rsa_priv.pem 2048

# Generate public key
openssl rsa -in id_rsa_priv.pem -pubout -out id_rsa_pub.pem
```

4. Create `.env` file follow `.env.example`:

## Database Setup

The service uses MariaDB with Sequelize ORM. Tables will be automatically created on first run.

### Main Tables:
- users
- social_logins

## Usage

Start the development server:
```bash
npm start
```

## API Endpoints

### JWT Authentication
- `POST /register` - Register new user
- `POST /login` - Login with email/password

### Social Authentication
- `POST /auth/google` - Google OAuth authentication