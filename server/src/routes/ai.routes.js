// // const express = require("express");
// // const { analyzePrompt } = require("../controllers/analyzePrompt.controller");

// // const router = express.Router();

// // router.post("/analyze", analyzePrompt);

// // module.exports = router;


// import express from "express";
// import { analyzePrompt } from "../controllers/ai.controller.js";
// import { protect } from "../middleware/authMiddleware.js";
// import User from "../models/User.js";

// const router = express.Router();

// // 🔐 Protected AI route
// router.post("/analyze", protect, analyzePrompt, async (req, res) => {
//   try {
//     const { prompt } = req.body;

//     if (!prompt) {
//       return res.status(400).json({ success: false, message: "Prompt required" });
//     }

//     // 🧠 AI LOGIC (already working)
//     const analysis = await analyzeWithAI(prompt); // your existing function

//     // 🔥 SAVE PROJECT
//     req.user.projects.push({
//       prompt,
//       analysis,
//       status: "analyzed",
//     });

//     await req.user.save();

//     res.json({
//       success: true,
//       data: analysis,
//       projectId: req.user.projects.at(-1)._id,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, message: "AI analysis failed" });
//   }
// });
// export default router;


import express from "express";
import { analyzePrompt } from "../controllers/ai.controller.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🔐 Protected AI route
router.post("/analyze", protect, analyzePrompt);

export default router;
