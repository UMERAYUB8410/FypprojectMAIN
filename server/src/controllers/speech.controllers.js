export const speechToText = async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Speech converted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: "Speech processing failed" });
  }
};
