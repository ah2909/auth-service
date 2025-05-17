CREATE TABLE users  (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255),  -- Nullable for social logins
  username VARCHAR(50),
  full_name VARCHAR(50),
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE
);

-- Social Logins Table
CREATE TABLE social_logins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  provider ENUM('google', 'facebook', 'twitter') NOT NULL,
  provider_user_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);