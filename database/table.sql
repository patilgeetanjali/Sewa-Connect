
USE sevaconnect;

-- 1. Service categories
CREATE TABLE IF NOT EXISTS service_categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Services offered by providers
CREATE TABLE IF NOT EXISTS services (
    service_id INT AUTO_INCREMENT PRIMARY KEY,
    provider_id INT NOT NULL,
    category_id INT NOT NULL,
    price_per_day DECIMAL(10,2) NOT NULL,
    description TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_services_provider
        FOREIGN KEY (provider_id)
        REFERENCES users(user_id),

    CONSTRAINT fk_services_category
        FOREIGN KEY (category_id)
        REFERENCES service_categories(category_id),

    CONSTRAINT chk_service_price
        CHECK (price_per_day >= 0),

    INDEX idx_services_provider (provider_id),
    INDEX idx_services_category (category_id)
) ENGINE=InnoDB;

-- 3. Customer bookings
CREATE TABLE IF NOT EXISTS bookings (
    booking_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    service_id INT NOT NULL,
    provider_id INT NOT NULL,
    booking_date DATE NOT NULL,
    service_address VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    status ENUM(
        'pending',
        'accepted',
        'rejected',
        'in_progress',
        'completed',
        'cancelled'
    ) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_bookings_customer
        FOREIGN KEY (customer_id)
        REFERENCES users(user_id),

    CONSTRAINT fk_bookings_service
        FOREIGN KEY (service_id)
        REFERENCES services(service_id),

    CONSTRAINT fk_bookings_provider
        FOREIGN KEY (provider_id)
        REFERENCES users(user_id),

    CONSTRAINT chk_booking_price
        CHECK (price >= 0),

    INDEX idx_bookings_customer (customer_id),
    INDEX idx_bookings_provider (provider_id),
    INDEX idx_bookings_status (status),
    INDEX idx_bookings_date (booking_date)
) ENGINE=InnoDB;

-- 4. Payments
CREATE TABLE IF NOT EXISTS payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM(
        'cash',
        'upi',
        'card',
        'other'
    ) NOT NULL DEFAULT 'cash',
    payment_status ENUM(
        'pending',
        'paid',
        'failed',
        'refunded'
    ) NOT NULL DEFAULT 'pending',
    transaction_reference VARCHAR(150),
    paid_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_payments_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(booking_id),

    CONSTRAINT chk_payment_amount
        CHECK (amount >= 0)
) ENGINE=InnoDB;

-- Add initial service categories
INSERT IGNORE INTO service_categories (category_name, description)
VALUES
    ('Electrician', 'Electrical repairs and installation'),
    ('Plumber', 'Plumbing repairs and maintenance'),
    ('Painter', 'Painting and wall finishing'),
    ('Driver', 'Driving services'),
    ('Other', 'Other household services');
    
