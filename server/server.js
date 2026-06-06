import express from "express";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import session from "express-session";
import passport from "passport";
import cookieParser from "cookie-parser";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, ".env") });

import { connectDB } from "./src/config/db.js";

// routes
import authRoutes from "./src/routes/authRoutes.js";
import googleAuthRoutes from "./src/routes/googleAuth.js";
import aiRoutes from "./src/routes/ai.routes.js";
import speechRoutes from "./src/routes/speech.routes.js";
import floorPlanRoutes from "./src/routes/floorPlan.routes.js";
import historyRoutes from "./src/routes/history.routes.js";

const app = express();

// -------------------------------
// 🔹 Database
// -------------------------------
connectDB();

// -------------------------------
// 🔹 Middleware
// -------------------------------
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// -------------------------------
// 🔹 Session (ONLY for Google OAuth)
// -------------------------------
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

// -------------------------------
// 🔹 Passport
// -------------------------------
app.use(passport.initialize());
app.use(passport.session());

// -------------------------------
// 🔹 Routes
// -------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/auth", googleAuthRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/speech", speechRoutes);
app.use("/api/floorplan", floorPlanRoutes);
app.use("/api/history", historyRoutes);

// -------------------------------
// 🔹 Health Check (important for viva)
// -------------------------------
app.get("/", (req, res) => {
  res.send("🚀 DreamSketch AI Backend Running");
});

// -------------------------------
// 🔹 Start Server
// -------------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on port ${PORT}`)
);

export default app;
