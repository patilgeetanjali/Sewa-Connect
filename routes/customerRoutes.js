import express from "express";
import pool from "../config/database.js";
import {
    authenticateToken,
    authorizeRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Get customer profile
router.get(
    "/profile",
    authenticateToken,
    authorizeRoles("customer"),
    async (req, res) => {
        try {
            const [rows] = await pool.execute(
                `SELECT user_id, name, email, phone, address
                 FROM users
                 WHERE user_id = ? AND role = 'customer'`,
                [req.user.user_id]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    message: "Customer not found"
                });
            }

            res.json(rows[0]);
        } catch (error) {
            console.error(error);
            res.status(500).json({
                message: "Unable to fetch profile"
            });
        }
    }
);

// Update customer address only
router.put(
    "/profile/address",
    authenticateToken,
    authorizeRoles("customer"),
    async (req, res) => {
        try {
            const { address } = req.body;

            if (typeof address !== "string" || !address.trim()) {
                return res.status(400).json({
                    message: "Please enter a valid address"
                });
            }

            const [result] = await pool.execute(
                `UPDATE users
                 SET address = ?
                 WHERE user_id = ? AND role = 'customer'`,
                [address.trim(), req.user.user_id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Customer not found"
                });
            }

            res.json({
                message: "Address updated successfully"
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                message: "Unable to update address"
            });
        }
    }
);

// Search available services, optionally by category
router.get(
    "/services",
    authenticateToken,
    authorizeRoles("customer"),
    async (req, res) => {
        try {
            const { category } = req.query;

            let sql = `
                SELECT
                    s.service_id,
                    s.category_id,
                    sc.category_name,
                    s.provider_id,
                    u.name AS provider_name,
                    u.phone AS provider_phone,
                    s.price_per_day,
                    s.description
                FROM services s
                JOIN service_categories sc
                    ON s.category_id = sc.category_id
                JOIN users u
                    ON s.provider_id = u.user_id
                WHERE s.is_available = TRUE
                  AND sc.is_active = TRUE
                  AND u.role = 'provider'
                  AND u.status = 'active'
            `;

            const params = [];

            if (category) {
                sql += " AND sc.category_name = ?";
                params.push(category);
            }

            sql += " ORDER BY sc.category_name, s.price_per_day";

            const [services] = await pool.execute(sql, params);
            res.json(services);
        } catch (error) {
            console.error(error);
            res.status(500).json({
                message: "Unable to fetch services"
            });
        }
    }
);

// Get available service categories
router.get(
    "/categories",
    authenticateToken,
    authorizeRoles("customer"),
    async (req, res) => {
        try {
            const [categories] = await pool.execute(
                `SELECT category_id, category_name, description
                 FROM service_categories
                 WHERE is_active = TRUE
                 ORDER BY category_name`
            );

            res.json(categories);
        } catch (error) {
            console.error(error);
            res.status(500).json({
                message: "Unable to fetch categories"
            });
        }
    }
);

// Create a booking
router.post(
    "/bookings",
    authenticateToken,
    authorizeRoles("customer"),
    async (req, res) => {
        try {
            const { serviceId, bookingDate, serviceAddress, description } = req.body;

            if (
                !Number.isInteger(Number(serviceId)) ||
                !bookingDate ||
                !serviceAddress?.trim()
            ) {
                return res.status(400).json({
                    message: "Service, booking date and address are required"
                });
            }

            // Validate the date format and ensure it is not in the past
            if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
                return res.status(400).json({
                    message: "Invalid booking date"
                });
            }

            
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bookingDate);

            if (!match) {
                return res.status(400).json({
                message: "Invalid booking date"
                });
            }

            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);

            const parsedDate = new Date(Date.UTC(year, month - 1, day));

            if (
                parsedDate.getUTCFullYear() !== year ||
                parsedDate.getUTCMonth() !== month - 1 ||
                parsedDate.getUTCDate() !== day
            ) {
            return res.status(400).json({
                message: "Invalid booking date"
                });
            }

            const now = new Date();

            const todayString = [
                now.getFullYear(),
                String(now.getMonth() + 1).padStart(2, "0"),
                String(now.getDate()).padStart(2, "0")
            ].join("-");

            if (bookingDate < todayString) {
                return res.status(400).json({
                    message: "Choose today or a future date"
                });
            }


            // Get the actual price and provider from the database
            const [services] = await pool.execute(
                `SELECT s.service_id, s.provider_id, s.price_per_day
                 FROM services s
                 JOIN users u ON u.user_id = s.provider_id
                 JOIN service_categories sc ON sc.category_id = s.category_id
                 WHERE s.service_id = ?
                   AND s.is_available = TRUE
                   AND u.role = 'provider'
                   AND u.status = 'active'
                   AND sc.is_active = TRUE`,
                [Number(serviceId)]
            );

            if (services.length === 0) {
                return res.status(404).json({
                    message: "This service is not currently available"
                });
            }

            const service = services[0];

            const [result] = await pool.execute(
                `INSERT INTO bookings
                 (customer_id, service_id, provider_id, booking_date,
                  service_address, description, price)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.user.user_id,
                    service.service_id,
                    service.provider_id,
                    bookingDate,
                    serviceAddress.trim(),
                    description?.trim() || null,
                    service.price_per_day
                ]
            );

            res.status(201).json({
                message: "Booking request submitted successfully",
                bookingId: result.insertId
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                message: "Unable to create booking"
            });
        }
    }
);

// View this customer's booking history
router.get(
    "/bookings",
    authenticateToken,
    authorizeRoles("customer"),
    async (req, res) => {
        try {
            const [bookings] = await pool.execute(
                `SELECT
                    b.booking_id,
                    b.booking_date,
                    b.service_address,
                    b.description,
                    b.price,
                    b.status,
                    b.created_at,
                    sc.category_name,
                    u.name AS provider_name
                 FROM bookings b
                 JOIN services s ON s.service_id = b.service_id
                 JOIN service_categories sc ON sc.category_id = s.category_id
                 JOIN users u ON u.user_id = b.provider_id
                 WHERE b.customer_id = ?
                 ORDER BY b.created_at DESC`,
                [req.user.user_id]
            );

            res.json(bookings);
        } catch (error) {
            console.error(error);
            res.status(500).json({
                message: "Unable to fetch booking history"
            });
        }
    }
);

export default router;