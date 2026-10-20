
CREATE DATABASE IF NOT EXISTS sevaconnect;

USE sevaconnect;

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer', 'provider', 'admin')
        NOT NULL DEFAULT 'customer',
    address VARCHAR(255),
    service_category VARCHAR(100),
    experience_years INT,
    status ENUM('active', 'pending', 'rejected', 'inactive')
        NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

SELECT user_id, name, email, role, status, created_at
FROM users;
