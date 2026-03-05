const jwt = require("jsonwebtoken");

/**
 * Middleware to authenticate JWT token from cookies or Authorization header
 * This verifies that the user is logged in before accessing protected routes
 */
const authenticateToken = (req, res, next) => {
    // Try to get token from cookie first (most secure)
    let token = req.cookies?.access_token;
    
    // If not in cookie, check Authorization header (for mobile apps or custom clients)
    const authHeader = req.headers['authorization'];
    if (!token && authHeader) {
        token = authHeader.split(' ')[1]; // Format: "Bearer TOKEN"
    }

    if (!token) {
        return res.status(401).json({ 
            message: "Access token required. Please log in." 
        });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Attach user info to request object
        req.user = { 
            id: decoded.id 
        };
        
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: "Token expired. Please log in again." 
            });
        }
        
        if (err.name === 'JsonWebTokenError') {
            return res.status(403).json({ 
                message: "Invalid token. Please log in again." 
            });
        }
        
        console.error("Auth middleware error:", err);
        return res.status(500).json({ 
            message: "Authentication error" 
        });
    }
};

/**
 * Optional middleware to check if user is authenticated
 * Doesn't return error if not authenticated, just sets req.user = null
 * Useful for routes that can work with or without authentication
 */
const optionalAuth = (req, res, next) => {
    try {
        let token = req.cookies?.access_token;
        const authHeader = req.headers['authorization'];
        
        if (!token && authHeader) {
            token = authHeader.split(' ')[1];
        }

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = { id: decoded.id };
        } else {
            req.user = null;
        }
        
        next();
    } catch (err) {
        // If token is invalid, just set user to null
        req.user = null;
        next();
    }
};

/**
 * Middleware to refresh access token using refresh token
 * Can be used to implement token refresh functionality
 */
const refreshAccessToken = async (req, res) => {
    try {
        const refreshToken = req.cookies?.refresh_token;
        
        if (!refreshToken) {
            return res.status(401).json({ 
                message: "Refresh token required" 
            });
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        
        // Generate new access token
        const newAccessToken = jwt.sign(
            { id: decoded.id },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        // Set new access token in cookie
        res.cookie("access_token", newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 15 * 60 * 1000
        });

        res.json({ 
            message: "Token refreshed successfully" 
        });
    } catch (err) {
        console.error("Token refresh error:", err);
        
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: "Refresh token expired. Please log in again." 
            });
        }
        
        res.status(403).json({ 
            message: "Invalid refresh token" 
        });
    }
};

module.exports = {
    authenticateToken,
    optionalAuth,
    refreshAccessToken
};