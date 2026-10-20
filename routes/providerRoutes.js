
import express from "express";
import pool from "../config/database.js";
import {
    authenticateToken,
    authorizeRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken, authorizeRoles("provider"));

async function requireApprovedProvider(req, res, next) {
    try {
        const [rows] = await pool.query(
            `SELECT status
             FROM users
             WHERE user_id = ? AND role = 'provider'`,
            [req.user.user_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Provider account not found."
            });
        }

        if (rows[0].status !== "active") {
            return res.status(403).json({
                message: "Your provider account is not approved yet."
            });
        }

        next();
    } catch (error) {
        next(error);
    }
}

// Provider profile and approval status
router.get("/profile", async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT user_id, name, email, role, status, service_category
             FROM users
             WHERE user_id = ? AND role = 'provider'`,
            [req.user.user_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Provider profile not found."
            });
        }

        res.json({ provider: rows[0] });
    } catch (error) {
        next(error);
    }
});

// List active service categories
router.get("/categories", async (req, res, next) => {
    try {
        const [categories] = await pool.query(
            `SELECT category_id, category_name, description
             FROM service_categories
             WHERE is_active = TRUE
             ORDER BY category_name`
        );

        res.json({ categories });
    } catch (error) {
        next(error);
    }
});

// All services belonging to this provider
router.get("/services", requireApprovedProvider, async (req, res, next) => {
    try {
        const [services] = await pool.query(
            `SELECT s.service_id, s.category_id,
                    c.category_name, s.price_per_day,
                    s.description, s.is_available, s.created_at
             FROM services s
             JOIN service_categories c
               ON c.category_id = s.category_id
             WHERE s.provider_id = ?
             ORDER BY s.created_at DESC`,
            [req.user.user_id]
        );

        res.json({ services });
    } catch (error) {
        next(error);
    }
});

// Add a service
router.post("/services", requireApprovedProvider, async (req, res, next) => {
    try {
        const categoryId = Number(req.body.category_id);
        const price = req.body.price_per_day;
        const description =
            typeof req.body.description === "string"
                ? req.body.description.trim()
                : "";

        if (!Number.isInteger(categoryId) || categoryId < 1) {
            return res.status(400).json({
                message: "Please select a valid category."
            });
        }

        if (
            price === undefined ||
            price === null ||
            String(price).trim() === "" ||
            !Number.isFinite(Number(price)) ||
            Number(price) < 0 ||
            Number(price) > 99999999.99
        ) {
            return res.status(400).json({
                message: "Enter a valid daily price."
            });
        }

        if (description.length > 2000) {
            return res.status(400).json({
                message: "Description must be 2000 characters or fewer."
            });
        }

        const [categories] = await pool.query(
            `SELECT category_id
             FROM service_categories
             WHERE category_id = ? AND is_active = TRUE`,
            [categoryId]
        );

        if (categories.length === 0) {
            return res.status(400).json({
                message: "Selected category is unavailable."
            });
        }

        const [result] = await pool.query(
            `INSERT INTO services
                (provider_id, category_id, price_per_day, description)
             VALUES (?, ?, ?, ?)`,
            [
                req.user.user_id,
                categoryId,
                Number(price),
                description || null
            ]
        );

        res.status(201).json({
            message: "Service added successfully.",
            service_id: result.insertId
        });
    } catch (error) {
        next(error);
    }
});

// Enable or disable a provider's own service
router.patch(
    "/services/:id/availability",
    requireApprovedProvider,
    async (req, res, next) => {
        try {
            const serviceId = Number(req.params.id);
            const isAvailable = req.body.is_available;

            if (
                !Number.isInteger(serviceId) ||
                serviceId < 1 ||
                typeof isAvailable !== "boolean"
            ) {
                return res.status(400).json({
                    message: "Invalid service or availability value."
                });
            }

            const [result] = await pool.query(
                `UPDATE services
                 SET is_available = ?
                 WHERE service_id = ? AND provider_id = ?`,
                [isAvailable, serviceId, req.user.user_id]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Service not found."
                });
            }

            res.json({
                message: isAvailable
                    ? "Service is now available."
                    : "Service is now unavailable."
            });
        } catch (error) {
            next(error);
        }
    }
);

// View bookings for this provider only
router.get("/bookings", async (req, res, next) => {
    try {
        const [bookings] = await pool.query(
            `SELECT b.booking_id, b.booking_date,
                    b.service_address, b.description,
                    b.price, b.status, b.created_at,
                    u.name AS customer_name,
                    s.service_id,
                    c.category_name
             FROM bookings b
             JOIN users u ON u.user_id = b.customer_id
             JOIN services s ON s.service_id = b.service_id
             JOIN service_categories c ON c.category_id = s.category_id
             WHERE b.provider_id = ?
             ORDER BY b.created_at DESC`,
            [req.user.user_id]
        );

        res.json({ bookings });
    } catch (error) {
        next(error);
    }
});

// Update booking status with allowed transitions
router.patch("/bookings/:id/status", async (req, res, next) => {
    try {
        const bookingId = Number(req.params.id);
        const newStatus = req.body.status;

        if (!Number.isInteger(bookingId) || bookingId < 1) {
            return res.status(400).json({
                message: "Invalid booking ID."
            });
        }

        const allowedTransitions = {
            pending: ["accepted", "rejected"],
            accepted: ["in_progress"],
            in_progress: ["completed"]
        };

        const [rows] = await pool.query(
            `SELECT status
             FROM bookings
             WHERE booking_id = ? AND provider_id = ?`,
            [bookingId, req.user.user_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                message: "Booking not found."
            });
        }

        const currentStatus = rows[0].status;

        if (
            !allowedTransitions[currentStatus] ||
            !allowedTransitions[currentStatus].includes(newStatus)
        ) {
            return res.status(400).json({
                message: "This booking status change is not allowed."
            });
        }

        const [result] = await pool.query(
            `UPDATE bookings
             SET status = ?
             WHERE booking_id = ?
               AND provider_id = ?
               AND status = ?`,
            [
                newStatus,
                bookingId,
                req.user.user_id,
                currentStatus
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({
                message: "Booking status changed. Refresh and try again."
            });
        }

        res.json({
            message: "Booking status updated successfully.",
            status: newStatus
        });
    } catch (error) {
        next(error);
    }
});

export default router;
