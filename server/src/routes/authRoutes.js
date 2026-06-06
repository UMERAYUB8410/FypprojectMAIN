import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendEmail } from "../services/sendEmail.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ======================================================
   🧭 REGISTER USER (Email + Password)
====================================================== */
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate 6-digit email verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create user (NOT VERIFIED YET)
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      resetCode: verificationCode,
      resetCodeExpiry: Date.now() + 10 * 60 * 1000, // 10 minutes
      verified: false,
    });

    // Send verification email
    await sendEmail(
      email,
      "Verify your account",
      `Your verification code is: ${verificationCode}`
    );

    res.json({ message: "Verification code sent to email" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ======================================================
   ✅ VERIFY EMAIL
====================================================== */
router.post("/verify", async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.resetCode !== code) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    // Check code expiry
    if (user.resetCodeExpiry < Date.now()) {
      return res.status(400).json({ message: "Verification code expired" });
    }

    user.verified = true;
    user.resetCode = null;
    user.resetCodeExpiry = null;

    await user.save();

    res.json({ message: "Account verified successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ======================================================
   🔑 LOGIN USER
====================================================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Explicitly include password
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (!user.verified) {
      return res.status(403).json({ message: "Account not verified" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      username: user.username,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ======================================================
   🚀 FORGOT PASSWORD (Send OTP)
====================================================== */
router.post("/forgot", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetCode = resetCode;
    user.resetCodeExpiry = Date.now() + 10 * 60 * 1000;

    await user.save();

    await sendEmail(
      email,
      "Password Reset",
      `Your password reset code is: ${resetCode}`
    );

    res.json({ message: "Reset code sent to email" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ======================================================
   🔁 RESET PASSWORD
====================================================== */
router.post("/reset", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user || user.resetCode !== code) {
      return res.status(400).json({ message: "Invalid reset code" });
    }

    if (user.resetCodeExpiry < Date.now()) {
      return res.status(400).json({ message: "Reset code expired" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetCode = null;
    user.resetCodeExpiry = null;

    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/* ======================================================
   👤 GET CURRENT USER
====================================================== */
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.username,
        email: user.email,
        verified: user.verified,
        googleId: user.googleId,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

export default router;
