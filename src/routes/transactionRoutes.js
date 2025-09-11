import express from "express";
import { sql } from "../config/db.js";
import { getTransactions, getTransactionSummary, getTransactionById, createTransaction, deleteTransaction, bulkDeleteTransactions, updateTransaction } from "../controllers/transactionControllers.js";

const router = express.Router();

// GET /api/users/:id/transactions: Fetch all transactions for a user
router.get("/", getTransactions);
// GET /api/users/:id/transactions/summary: Get summary of user's transactions
router.get("/summary", getTransactionSummary);
// GET /api/users/:id/transactions/:transaction_id: Fetch a single transaction by ID
router.get("/:transaction_id", getTransactionById);
// POST /api/users/:id/transactions: Create a new transaction for a user   
router.post("/", createTransaction);
// DELETE /api/users/:id/transactions/:transaction_id: Delete a single transaction by ID
router.delete("/:transaction_id", deleteTransaction);
// Bulk delete transactions for a user based on an array of transaction IDs
router.delete("/", bulkDeleteTransactions);
// PUT /api/users/:id/transactions/:transaction_id: Update a single transaction by ID
router.put("/:transaction_id", updateTransaction);

export default router;