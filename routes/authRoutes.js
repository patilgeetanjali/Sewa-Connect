
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/database.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validRoles = ["customer", "provider"];
const validCategories = [
    "Electrician",
    "Plumber",
    "Painter",
    "Driver",
    "Other"
];

function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

function publicUser(user) {
    return {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        address: user.address,
        service_category: user.service_category,
        experience_years: user.experience_years,
        status: user.status
    };
}

function setAuthCookie(res, user) {
    const token = jwt.sign(
        {
            user_id: user.user_id,
            role: user.role
        },
        process.env.JWT_SECRET,
        { expiresIn: "2h" }
    );

    res.cookie("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 2 * 60 * 60 * 1000,
        path: "/"
    });
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
    try {
        const name = clean(req.body.name);
        const email = clean(req.body.email).toLowerCase();
        const phone = clean(req.body.phone);
        const password = req.body.password;
        const confirmPassword = req.body.confirmPassword;
        const role = clean(req.body.role).toLowerCase();
        const address = clean(req.body.address);
        const serviceCategory = clean(req.body.serviceCategory);
        const experienceRaw = req.body.experienceYears;

        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                message: "Name, email, phone, and password are required."
            });
        }

        if (!validEmail.test(email)) {
            return res.status(400).json({
                message: "Enter a valid email address."
            });
        }

        if (!validRoles.includes(role)) {
            return res.status(400).json({
                message: "Select Customer or Service Provider."
            });
        }

        if (typeof password !== "string" ||
            password.length < 8 ||
            password.length > 72) {
            return res.status(400).json({
                message: "Password must contain 8 to 72 characters."
            });
        }

        if (confirmPassword !== undefined &&
            password !== confirmPassword) {
            return res.status(400).json({
                message: "Passwords do not match."
            });
        }

        if (phone.length < 7 || phone.length > 20) {
            return res.status(400).json({
                message: "Enter a valid phone number."
            });
        }

        let category = null;
        let experience = null;
        let status = "active";

        if (role === "provider") {
            if (!validCategories.includes(serviceCategory)) {
                return res.status(400).json({
                    message: "Select a valid service category."
                });
            }

            experience = Number(experienceRaw);

            if (
                experienceRaw === undefined ||
                experienceRaw === "" ||
                !Number.isInteger(experience) ||
                experience < 0 ||
                experience > 60
            ) {
                return res.status(400).json({
                    message: "Experience must be between 0 and 60 years."
                });
            }

            category = serviceCategory;
            status = "pending";
        }

        const [existing] = await pool.execute(
            "SELECT user_id FROM users WHERE email = ?",
            [email]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const [result] = await pool.execute(
            `INSERT INTO users
            (name, email, phone, password_hash, role, address,
             service_category, experience_years, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                email,
                phone,
                passwordHash,
                role,
                address || null,
                category,
                experience,
                status
            ]
        );

        return res.status(201).json({
            message: role === "provider"
                ? "Registration successful. Your account is awaiting admin approval."
                : "Registration successful. You can now log in.",
            user: {
                user_id: result.insertId,
                name,
                email,
                phone,
                role,
                address: address || null,
                service_category: category,
                experience_years: experience,
                status
            }
        });
    } catch (error) {
        console.error("Registration error:", error.message);

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                message: "An account with this email already exists."
            });
        }

        return res.status(500).json({
            message: "Registration failed due to a server error."
        });
    }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
    try {
        const email = clean(req.body.email).toLowerCase();
        const password = req.body.password;

        if (!email || typeof password !== "string" || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const [rows] = await pool.execute(
            `SELECT user_id, name, email, phone, password_hash,
                    role, address, service_category,
                    experience_years, status
             FROM users
             WHERE email = ?
             LIMIT 1`,
            [email]
        );

        if (rows.length === 0) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        const user = rows[0];
        const passwordMatches = await bcrypt.compare(
            password,
            user.password_hash
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid email or password."
            });
        }

        if (user.status === "inactive" || user.status === "rejected") {
            return res.status(403).json({
                message: "This account is not currently allowed to log in."
            });
        }

        if (user.role === "provider" && user.status !== "active") {
            return res.status(403).json({
                message: "Your provider account is awaiting admin approval."
            });
        }

        setAuthCookie(res, user);

        return res.json({
            message: "Login successful.",
            user: publicUser(user)
        });
    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            message: "Login failed due to a server error."
        });
    }
});

// GET /api/auth/me
router.get("/me", authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT user_id, name, email, phone, role, address,
                    service_category, experience_years, status
             FROM users WHERE user_id = ? LIMIT 1`,
            [req.user.user_id]
        );

        if (rows.length === 0) {
            res.clearCookie("authToken", { path: "/" });

            return res.status(401).json({
                message: "Account not found."
            });
        }

        const user = rows[0];

        if (
            user.status === "inactive" ||
            user.status === "rejected" ||
            (user.role === "provider" && user.status !== "active")
        ) {
            res.clearCookie("authToken", { path: "/" });

            return res.status(403).json({
                message: "Your account cannot currently access the platform."
            });
        }

        return res.json({ user: publicUser(user) });
    } catch (error) {
        console.error("Session lookup error:", error.message);

        return res.status(500).json({
            message: "Unable to check your session."
        });
    }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
    res.clearCookie("authToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
    });

    return res.json({ message: "Logged out successfully." });
});

export default router;
