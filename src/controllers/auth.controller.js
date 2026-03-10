const pool = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

// Register a new user
  const register = async (req, res) => {
  const { fullname, email, password, confirm_password, accept_terms } = req.body;

  if (!fullname || !email || !password || !confirm_password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Validate password format
  if (password !== confirm_password) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  //add validation for accepted_terms
  if (!accept_terms) {
    return res.status(400).json({ message: "You must accept the terms and conditions" });
  }

  try {
    // Check if user exists
    const userExists = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await pool.query(
      "INSERT INTO users (fullname, email, password, accept_terms) VALUES ($1, $2, $3, $4) RETURNING id, fullname, email",
      [fullname, email, hashedPassword, accept_terms]
    );

    const userId = newUser.rows[0].id;

    // Create tokens
    const accessToken = jwt.sign(
      { id: userId },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { id: userId },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    // Set cookies
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // secure: false,          // disable secure locally for testing
      sameSite: "strict",
      maxAge: 15 * 60 * 1000
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // secure: false,          // disable secure locally for testing
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      message: "User registered successfully",
      data: newUser.rows[0]
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Login user with remember me functionality
const login = async (req, res) => {
  const { email, password, remember_me } = req.body;

  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    // Check if user exists
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    
    if (user.rows.length === 0) {
      return res.status(400).json({ message: "User do not exist" });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.rows[0].password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Set expiration times based on remember_me
    const accessTokenExpiry = "15m"; // Always 15 minutes for access token
    const refreshTokenExpiry = remember_me ? "30d" : "7d"; // 30 days if remembered, 7 days if not
    
    // Convert expiry to milliseconds for cookie maxAge
    const accessTokenMaxAge = 15 * 60 * 1000; // 15 minutes in milliseconds
    const refreshTokenMaxAge = remember_me 
      ? 30 * 24 * 60 * 60 * 1000  // 30 days in milliseconds
      : 7 * 24 * 60 * 60 * 1000;   // 7 days in milliseconds

    // Create access token (short-lived)
    const accessToken = jwt.sign(
      { id: user.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: accessTokenExpiry }
    );

    // Create refresh token with conditional expiration
    const refreshToken = jwt.sign(
      { id: user.rows[0].id },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: refreshTokenExpiry }
    );

    // Set access token in HttpOnly cookie
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // secure: false,       // disable secure locally for testing
      sameSite: "strict",
      maxAge: accessTokenMaxAge
    });

    // Set refresh token in HttpOnly cookie with conditional expiry
    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // secure: false,        // disable secure locally for testing
      sameSite: "strict",
      maxAge: refreshTokenMaxAge
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user.rows[0];

    res.status(200).json({
      message: "User logged in successfully",
      data: userWithoutPassword
    });

  } catch (err) {
    console.error("Login error:", err.message);
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

//refresh token
const refreshToken = async (req, res) => {
  const refreshToken = req.cookies.refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token missing" });
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    // Issue new access token
    const newAccessToken = jwt.sign(
      { id: decoded.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN } // e.g., "15m"
    );

    // Set new access token in HttpOnly cookie
    res.cookie("access_token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // secure: false,          // disable secure locally for testing
      sameSite: "strict",
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
    res.status(200).json({ message: "Access token refreshed" });
  } catch (err) {
    console.error(err.message);
    return res.status(403).json({ message: "Invalid refresh token" });
  }
};

//logout function to clear the refresh token cookie
const logout = async (req, res) => {
  res.clearCookie("access_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  });
  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  });
  res.status(200).json({ message: "User logged out successfully" });
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout
};