import express from "express";

import { getFinancialSummary, getFinancialBreakdown } from "../controllers/financeControllers.js";


const router = express.Router();
// Get financial summary by day, week, month, year using transaction_date
router.get("/summary", getFinancialSummary);   

// Get detailed financial breakdown by day, week, month, year using transaction_date
router.get("/breakdown", getFinancialBreakdown);
export default router;