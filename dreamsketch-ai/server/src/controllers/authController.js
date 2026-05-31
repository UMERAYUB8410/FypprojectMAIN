import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { sendEmail } from "../services/sendEmail.js";

// ------------------------------------
// 🧾 REGISTER USER (Send Verification OTP)
// ------------------------------------
export const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ msg: "All fields are required" });
    }

    // Check existing user
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ msg: "Email already exists" });
    }

    // Hash password
    const hashedPwd = await bcrypt.hash(password, 10);

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create user (NOT verified yet)
    await User.create({
      username,
      email,
      password: hashedPwd,
      resetCode: verificationCode,
      verified: false,
    });

    // Send verification email
    await sendEmail(
      email,
      "Verify your DreamSketch account",
      `Your verification code is: ${verificationCode}`
    );

    res.status(201).json({
      msg: "Registration successful. Verification code sent to email.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ------------------------------------
// ✅ VERIFY EMAIL (OTP)
// ------------------------------------
export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.resetCode !== code) {
      return res.status(400).json({ msg: "Invalid verification code" });
    }

    user.verified = true;
    user.resetCode = null;
    await user.save();

    res.json({ msg: "Account verified successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ------------------------------------
// 🔐 LOGIN USER
// ------------------------------------
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // Check email verification
    if (!user.verified) {
      return res.status(403).json({ msg: "Please verify your email first" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ BUG 1 FIX: Standardized auth response
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ------------------------------------
// 🔁 REQUEST PASSWORD RESET (OTP)
// ------------------------------------
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Email not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = otp;
    user.resetCodeExpiry = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();

    await sendEmail(
      email,
      "DreamSketch Password Reset Code",
      `Your password reset code is: ${otp}`
    );

    res.json({ msg: "OTP sent to email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};

// ------------------------------------
// 🔐 RESET PASSWORD
// ------------------------------------
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.resetCode !== otp) {
      return res.status(400).json({ msg: "Invalid OTP" });
    }

    if (Date.now() > user.resetCodeExpiry) {
      return res.status(400).json({ msg: "OTP expired" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetCode = null;
    user.resetCodeExpiry = null;
    await user.save();

    res.json({ msg: "Password reset successful" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Server error" });
  }
};
