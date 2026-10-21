import express from "express";
import pool from "../config/database.js";

const router = express.Router();

const validCategories = [
    "Plumber",
    "Cook",
    "Driver",
    "Carpenter",
    "Painter",
    "Electrician"
];

router.get("/", async (req, res) => {
    try {
        const category = String(req.query.category || "").trim();

        if (!validCategories.includes(category)) {
            return res.status(400).json({
                message: "Please select a valid service category."
            });
        }

        const [providers] = await pool.execute(
            `SELECT
                s.service_id,
                u.user_id,
                u.name,
                sc.category_name,
                s.price_per_day,
                s.description
             FROM services s
             JOIN users u ON u.user_id = s.provider_id
             JOIN service_categories sc
                ON sc.category_id = s.category_id
             WHERE sc.category_name = ?
               AND sc.is_active = TRUE
               AND s.is_available = TRUE
               AND u.role = 'provider'
               AND u.status = 'active'
             ORDER BY u.name ASC`,
            [category]
        );

        return res.json({ providers });
    } catch (error) {
        console.error("Public provider lookup error:", error.message);

        return res.status(500).json({
            message: "Unable to load service providers."
        });
    }
});

export default router;