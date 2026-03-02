//create the routes for the server and use the controller functions for the register, login, forgotten password, reset password, and refresh token endpoints
const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");


router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
// router.post("/refresh-token", authController.refreshToken);

module.exports = router;



// const express = require("express");
// const router = express.Router();

// const authController = require("../controllers/authController");

// // 🔴 EVERY handler below MUST exist and be a function
// router.post("/register", authController.register);
// router.post("/login", authController.login);
// // router.post("/forgot-password", authController.forgotPassword);
// router.post("/reset-password", authController.resetPassword);
// // router.post("/refresh-token", authController.refreshToken);

// module.exports = router;