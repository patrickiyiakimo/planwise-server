const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const rateLimiter = require("../middlewares/rateLimiter");


router.post("/register", authController.register);
router.post("/login", rateLimiter, authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authController.logout);

module.exports = router;
