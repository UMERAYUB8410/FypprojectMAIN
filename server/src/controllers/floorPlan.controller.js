  import { generate2DFloorPlan, generateFloorPlanModel } from "../services/floorPlan2D.service.js";
  import { generate3DFloorPlan } from "../services/floorPlan3D.service.js";

  // ✅ BUG 2 FIX: Validate input before processing
  function validateAnalysis(analysis) {
    if (!analysis || typeof analysis !== 'object') {
      throw new Error('Invalid analysis object');
    }
    if (!analysis.plot || !analysis.rooms) {
      throw new Error('Missing plot or rooms data');
    }
    return true;
  }

  export const generate2D = async (req, res) => {
    try {
      const { analysis } = req.body;
      
      // ✅ BUG 2: Validate before generation
      validateAnalysis(analysis);

      const plan = generateFloorPlanModel(analysis);
      const svg = generate2DFloorPlan(analysis);

      res.json({
        success: true,
        svg,
        plan,
        message: "Floor plan generated successfully"
      });
    } catch (err) {
      console.error('Floor plan error:', err);
      res.status(400).json({ 
        success: false, 
        message: err.message || 'Failed to generate floor plan'
      });
    }
  };

  // Generate both 2D and 3D floor plans
  export const generateFloorPlans = async (req, res) => {
    try {
      const { analysis } = req.body;
      
      validateAnalysis(analysis);

      const plan = generateFloorPlanModel(analysis);
      const svg = generate2DFloorPlan(analysis);
      const model3D = generate3DFloorPlan(plan);

      res.json({
        success: true,
        svg,
        plan,
        model3D,
        message: "Floor plans generated successfully"
      });
    } catch (err) {
      console.error('Floor plan error:', err);
      res.status(400).json({ 
        success: false, 
        message: err.message || 'Failed to generate floor plans'
      });
    }
  };
