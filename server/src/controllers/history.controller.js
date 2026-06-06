import FloorPlan from "../models/FloorPlan.js";

// Save a new floor plan
export const saveFloorPlan = async (req, res) => {
  try {
    const { prompt, analysis, svg, plan, model3D } = req.body;
    const userId = req.user._id;

    if (!prompt || !analysis || !svg || !plan) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    const floorPlan = new FloorPlan({
      userId,
      prompt,
      analysis,
      svg,
      plan,
      model3D
    });

    await floorPlan.save();

    res.status(201).json({
      success: true,
      message: "Floor plan saved successfully",
      data: floorPlan
    });
  } catch (err) {
    console.error("Save floor plan error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to save floor plan"
    });
  }
};

// Get all floor plans for a user
export const getUserFloorPlans = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 20, skip = 0 } = req.query;

    const floorPlans = await FloorPlan.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select("-svg -model3D"); // Exclude large fields for list view

    const total = await FloorPlan.countDocuments({ userId });

    res.json({
      success: true,
      data: floorPlans,
      total,
      hasMore: skip + floorPlans.length < total
    });
  } catch (err) {
    console.error("Get floor plans error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve floor plans"
    });
  }
};

// Get a single floor plan by ID
export const getFloorPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const floorPlan = await FloorPlan.findOne({ _id: id, userId });

    if (!floorPlan) {
      return res.status(404).json({
        success: false,
        message: "Floor plan not found"
      });
    }

    res.json({
      success: true,
      data: floorPlan
    });
  } catch (err) {
    console.error("Get floor plan error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve floor plan"
    });
  }
};

// Delete a floor plan
export const deleteFloorPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const floorPlan = await FloorPlan.findOneAndDelete({ _id: id, userId });

    if (!floorPlan) {
      return res.status(404).json({
        success: false,
        message: "Floor plan not found"
      });
    }

    res.json({
      success: true,
      message: "Floor plan deleted successfully"
    });
  } catch (err) {
    console.error("Delete floor plan error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to delete floor plan"
    });
  }
};
