
import express from "express";
import pool from "../config/database.js";
import {
    authenticateToken,
    authorizeRoles
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticateToken, authorizeRoles("admin"));

// Verify the admin still exists and has an active account.
router.use(async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT user_id
             FROM users
             WHERE user_id = ? AND role = 'admin' AND status = 'active'`,
            [req.user.user_id]
        );

        if (rows.length === 0) {
            return res.status(403).json({
                message: "Active admin access is required."
            });
        }

        next();
    } catch (error) {
        next(error);
    }
});

// Dashboard summary
router.get("/summary", async (req, res, next) => {
    try {
        const [[users]] = await pool.query(
            `SELECT
                COUNT(*) AS total_users,
                SUM(role = 'customer') AS customers,
                SUM(role = 'provider') AS providers,
                SUM(role = 'provider' AND status = 'pending') AS pending_providers
             FROM users`
        );

        const [[categories]] = await pool.query(
            `SELECT COUNT(*) AS total_categories,
                    SUM(is_active = TRUE) AS active_categories
             FROM service_categories`
        );

        res.json({ users, categories });
    } catch (error) {
        next(error);
    }
});

// List provider registrations awaiting a decision
router.get("/providers/pending", async (req, res, next) => {
    try {
        const [providers] = await pool.query(
            `SELECT user_id, name, email, phone, address,
                    service_category, experience_years, created_at
             FROM users
             WHERE role = 'provider' AND status = 'pending'
             ORDER BY created_at ASC`
        );

        res.json({ providers });
    } catch (error) {
        next(error);
    }
});

// Approve or reject a provider
router.patch("/providers/:id/decision", async (req, res, next) => {
    try {
        const providerId = Number(req.params.id);
        const { decision } = req.body;

        if (
            !Number.isInteger(providerId) ||
            providerId < 1 ||
            !["approve", "reject"].includes(decision)
        ) {
            return res.status(400).json({
                message: "Invalid provider ID or decision."
            });
        }

        const newStatus = decision === "approve" ? "active" : "rejected";

        const [result] = await pool.query(
            `UPDATE users
             SET status = ?
             WHERE user_id = ?
               AND role = 'provider'
               AND status = 'pending'`,
            [newStatus, providerId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Pending provider not found. Refresh the list."
            });
        }

        res.json({
            message: decision === "approve"
                ? "Provider approved successfully."
                : "Provider registration rejected.",
            status: newStatus
        });
    } catch (error) {
        next(error);
    }
});

// Search/list users. Password hashes are never returned.
router.get("/users", async (req, res, next) => {
    try {
        const search = String(req.query.search || "").trim().slice(0, 100);
        const role = String(req.query.role || "").trim();
        const status = String(req.query.status || "").trim();

        if (role && !["customer", "provider", "admin"].includes(role)) {
            return res.status(400).json({ message: "Invalid role filter." });
        }

        if (
            status &&
            !["active", "pending", "rejected", "inactive"].includes(status)
        ) {
            return res.status(400).json({ message: "Invalid status filter." });
        }

        const conditions = [];
        const params = [];

        if (search) {
            conditions.push("(name LIKE ? OR email LIKE ? OR phone LIKE ?)");
            const term = `%${search}%`;
            params.push(term, term, term);
        }

        if (role) {
            conditions.push("role = ?");
            params.push(role);
        }

        if (status) {
            conditions.push("status = ?");
            params.push(status);
        }

        const where = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

        const [users] = await pool.query(
            `SELECT user_id, name, email, phone, role, status,
                    address, service_category, created_at
             FROM users
             ${where}
             ORDER BY created_at DESC
             LIMIT 300`,
            params
        );

        res.json({ users });
    } catch (error) {
        next(error);
    }
});

// Activate or deactivate customer/provider accounts.
// Admin accounts cannot be changed through this endpoint.
router.patch("/users/:id/status", async (req, res, next) => {
    try {
        const userId = Number(req.params.id);
        const { status } = req.body;

        if (!Number.isInteger(userId) || userId < 1) {
            return res.status(400).json({ message: "Invalid user ID." });
        }

        if (!["active", "inactive"].includes(status)) {
            return res.status(400).json({
                message: "Status must be active or inactive."
            });
        }

        if (userId === Number(req.user.user_id)) {
            return res.status(400).json({
                message: "You cannot change your own account status here."
            });
        }

        const [result] = await pool.query(
            `UPDATE users
             SET status = ?
             WHERE user_id = ?
               AND role IN ('customer', 'provider')
               AND status IN ('active', 'inactive')`,
            [status, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Active/inactive customer or provider not found."
            });
        }

        res.json({
            message: `User ${status === "active" ? "activated" : "deactivated"} successfully.`,
            status
        });
    } catch (error) {
        next(error);
    }
});

// List all categories, including inactive ones
router.get("/categories", async (req, res, next) => {
    try {
        const [categories] = await pool.query(
            `SELECT category_id, category_name, description,
                    is_active, created_at
             FROM service_categories
             ORDER BY category_name`
        );

        res.json({ categories });
    } catch (error) {
        next(error);
    }
});

// Add a category
router.post("/categories", async (req, res, next) => {
    try {
        const categoryName =
            typeof req.body.category_name === "string"
                ? req.body.category_name.trim()
                : "";

        const description =
            typeof req.body.description === "string"
                ? req.body.description.trim()
                : "";

        if (!categoryName || categoryName.length > 100) {
            return res.status(400).json({
                message: "Category name is required and must be at most 100 characters."
            });
        }

        if (description.length > 255) {
            return res.status(400).json({
                message: "Description must be at most 255 characters."
            });
        }

        const [result] = await pool.query(
            `INSERT INTO service_categories (category_name, description)
             VALUES (?, ?)`,
            [categoryName, description || null]
        );

        res.status(201).json({
            message: "Category created successfully.",
            category_id: result.insertId
        });
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "That category already exists."
            });
        }

        next(error);
    }
});

// Activate/deactivate a category without deleting existing service records
router.patch("/categories/:id/status", async (req, res, next) => {
    try {
        const categoryId = Number(req.params.id);
        const { is_active: isActive } = req.body;

        if (
            !Number.isInteger(categoryId) ||
            categoryId < 1 ||
            typeof isActive !== "boolean"
        ) {
            return res.status(400).json({
                message: "Invalid category ID or active status."
            });
        }

        const [result] = await pool.query(
            `UPDATE service_categories
             SET is_active = ?
             WHERE category_id = ?`,
            [isActive, categoryId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Category not found."
            });
        }

        res.json({
            message: isActive
                ? "Category activated."
                : "Category deactivated."
        });
    } catch (error) {
        next(error);
    }
});

export default router;
