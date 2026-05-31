// const express = require("express");
// const multer = require("multer");
// const { speechToText } = require("../../../backend/src/controllers/speechToText.controller");

// const router = express.Router();
// const upload = multer({ dest: "uploads/" });

// router.post("/to-text", upload.single("audio"), speechToText);

// module.exports = router;


import express from "express";
import { speechToText } from "../controllers/speech.controllers.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/speech-to-text", protect, speechToText);

export default router;
