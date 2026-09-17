export const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error: "Validation Error",
      messages,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      error: "Duplicate Error",
      message: `${field} already exists`,
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      error: "Invalid ID",
      message: `Invalid ${err.path}: ${err.value}`,
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
};

export default errorHandler;