import mongoose from "mongoose";

const floorPlanSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  prompt: {
    type: String,
    required: true
  },
  analysis: {
    type: Object,
    required: true
  },
  svg: {
    type: String,
    required: true
  },
  plan: {
    type: Object,
    required: true
  },
  model3D: {
    type: Object,
    required: false
  },
  thumbnail: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Index for faster queries
floorPlanSchema.index({ userId: 1, createdAt: -1 });

const FloorPlan = mongoose.model("FloorPlan", floorPlanSchema);

export default FloorPlan;
