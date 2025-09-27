import express from "express";
import { uploadFile, bulkUploadTransactions, getUploadHistory } from "../controllers/fileUploadControllers.js";

const router = express.Router();

// Health check endpoint for upload service
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Upload service is running",
    timestamp: new Date().toISOString()
  });
});

// POST /api/upload/file - Upload and process a file
router.post("/file", uploadFile);

// POST /api/upload/bulk - Bulk upload processed transactions
router.post("/bulk", bulkUploadTransactions);

// GET /api/upload/history/:userId - Get upload history for a user
router.get("/history/:userId", getUploadHistory);

export default router;
