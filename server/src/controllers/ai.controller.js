// // const openai = require("../../../backend/src/services/openai.service");

// // exports.analyzePrompt = async (req, res) => {
// //   try {
// //     const { prompt } = req.body;

// //     if (!prompt || prompt.length < 10) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Prompt too short",
// //       });
// //     }

// //     const completion = await openai.chat.completions.create({
// //       model: "gpt-4.1",
// //       messages: [
// //         {
// //           role: "system",
// //           content: `
// // You are a professional residential architect and planner.

// // Convert the user's house description into STRICT JSON format.
// // Validate architectural feasibility.
// // Reject impossible or illogical designs and requirements.
// // Return JSON only.
// //           `,
// //         },
// //         {
// //           role: "user",
// //           content: prompt,
// //         },
// //       ],
// //       temperature: 0.2,
// //     });

// //     const aiResponse = completion.choices[0].message.content;

// //     res.json({
// //       success: true,
// //       data: JSON.parse(aiResponse),
// //     });
// //   } catch (error) {
// //     res.status(500).json({
// //       success: false,
// //       message: "AI analysis failed",
// //       error: error.message,
// //     });
// //   }
// // };


// export const analyzePrompt = async (req, res) => {
//   try {
//     const { prompt } = req.body;

//     if (!prompt) {
//       return res.status(400).json({ message: "Prompt is required" });
//     }

//     // temporary response (AI logic baad mai)
//     res.json({
//       success: true,
//       message: "Prompt analyzed successfully",
//       prompt,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "AI analysis failed" });
//   }
// };


import { analyzeHousePrompt } from "../services/openai.service.js";

// ✅ BUG 2 FIX: Enforce JSON schema validation
function validateAIResponse(data) {
  // Ensure required structure exists
  if (!data.plot || typeof data.plot.width !== 'number' || typeof data.plot.length !== 'number') {
    throw new Error("Invalid plot dimensions");
  }
  if (!Array.isArray(data.rooms)) {
    throw new Error("Rooms must be an array");
  }
  return true;
}

export const analyzePrompt = async (req, res) => {
  try {
    const { prompt } = req.body;
    const user = req.user;

    if (!prompt) {
      return res.status(400).json({ success: false, message: "Prompt is required" });
    }

    // 🧠 NLP happens here
    let analysis = await analyzeHousePrompt(prompt);
    
    // ✅ BUG 2: Validate AI response schema
    try {
      validateAIResponse(analysis);
    } catch (validationErr) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid house layout: " + validationErr.message 
      });
    }

    // 💾 Save project in user profile
    user.projects.push({
      prompt,
      analysis,
      stage: "analyzed",
      createdAt: new Date(),
    });

    await user.save();

    res.json({
      success: true,
      data: analysis,
      projectId: user.projects.at(-1)._id,
    });
  } catch (err) {
    console.error("AI ERROR:", err);
    res.status(500).json({ success: false, message: "AI analysis failed" });
  }
};
