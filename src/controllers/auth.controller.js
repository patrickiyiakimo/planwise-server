//create the register and login functions for the server and forgotten password, reset password, and refresh token functions with the use of json web tokens and bcrypt for password hashing and resend for email notification and password reset emails and also use indexing for the database to improve performance. I am using postgreSQL

const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

// Register a new user
const register = async (req, res) => {
  const { fullname, email, password, confirm_password } = req.body;
    if (!fullname || !email || !password || !confirm_password) {
    return res.status(400).json({ message: "All fields are required" });
  }
    if (password !== confirm_password) {
    return res.status(400).json({ message: "Passwords do not match" });
  }
    try {
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = await pool.query(
        "INSERT INTO users (fullname, email, password) VALUES ($1, $2, $3) RETURNING *",
        [fullname, email, hashedPassword]
    );
    const token = jwt.sign({ id: newUser.rows[0].id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.status(201).json({ message: "User registered successfully", data: newUser.rows[0], token });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Login a user
const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }
    try {
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    res.status(200).json({ message: "Login successful", data: user.rows[0], token });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  const { email } = req.body;
    if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }
    try {
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }
    const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    await resend.emails.send({
      from: "noreply@planwise.com",
      to: email,
      subject: "Password Reset",
      html: `<p>Click <a href="http://localhost:3000/reset-password/${token}">here</a> to reset your password</p>`,
    });
    res.status(200).json({ message: "Password reset email sent" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  const { token, new_password, confirm_new_password } = req.body;
    if (!token || !new_password || !confirm_new_password) {
    return res.status(400).json({ message: "All fields are required" });
  }
    if (new_password !== confirm_new_password) {
    return res.status(400).json({ message: "Passwords do not match" });
  }
    try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await pool.query("SELECT * FROM users WHERE id = $1", [decoded.id]);
    if (user.rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, decoded.id]);
    res.status(200).json({ message: "Password reset successful" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
};