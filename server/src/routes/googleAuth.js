import express from "express";
import jwt from "jsonwebtoken";
import passport from "passport";
import { OAuth2Client } from "google-auth-library";
import "../config/passportGoogle.js"; // Passport Google strategy config
import User from "../models/User.js";

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// -------------------------------
// 🔹 1. Google Login (Passport Redirect Flow)
// -------------------------------
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: `${process.env.FRONTEND_URL}/login` }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.redirect(`${process.env.FRONTEND_URL}/?token=${token}`);
  }
);

// -------------------------------
// 🔹 2. Google One-Tap / Token-Based Login
// -------------------------------
router.post("/google/token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }    
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { name, email, sub } = ticket.getPayload();

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        username: name,
        email,
        googleId: sub,
        assword: null,          // 🔥 force null
        authProvider: "google",  // 🔥 track source
        verified: true,
      });
    }

    const jwtToken = jwt.sign(
      { id: user._id, email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token: jwtToken, username: user.username });
  } catch (error) {
    console.error("Google token login error:", error);
    res.status(500).json({ message: "Google login failed" });
  }
});

export default router;