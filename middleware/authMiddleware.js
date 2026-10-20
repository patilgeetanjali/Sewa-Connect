
import jwt from "jsonwebtoken";

export function authenticateToken(req, res, next) {
    const token = req.cookies?.authToken;

    if (!token) {
        return res.status(401).json({
            message: "Please log in first."
        });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.clearCookie("authToken", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/"
        });

        return res.status(401).json({
            message: "Session expired. Please log in again."
        });
    }
}

export function authorizeRoles(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                message: "You do not have permission to access this resource."
            });
        }

        next();
    };
}
