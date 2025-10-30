import { sql } from "../config/db.js";
import multer from 'multer';

// Configure multer to store files in memory
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Helper to convert buffer to data URL
function bufferToDataUrl(mimeType, buffer) {
    const base64 = buffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
}

// GET /api/users/:id/transactions: Fetch all transactions for a user
export async function getTransactions(req, res) {
    try {
        const userId = req.userId;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false,
                error: 'User ID is required',
                details: 'No user ID provided in request'
            });
        }
        
        console.log('Fetching transactions for user:', userId);
        
        const transactions = await sql`
            SELECT 
                id,
                user_id,
                amount,
                currency,
                type,
                category,
                tags,
                merchant,
                reference,
                description,
                transaction_date,
                created_at,
                updated_at
            FROM user_transactions 
            WHERE user_id = ${userId}
            ORDER BY transaction_date DESC, created_at DESC
        `;
        
        console.log(`Found ${transactions.length} transactions for user ${userId}`);
        
        res.json({
            success: true,
            data: transactions,
            count: transactions.length
        });
    } catch (error) {
        console.error("Error fetching transactions", error);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch transactions",
            details: error.message || 'Database error occurred'
        });
    }
}

// GET /api/users/:id/transactions/summary: Get summary of user's transactions
export async function getTransactionSummary(req, res) {
    try {
        const userId = req.userId;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false,
                error: 'User ID is required',
                details: 'No user ID provided in request'
            });
        }
        
        console.log('Fetching transaction summary for user:', userId);

        // Get basic summary (total count and amount)
        const basicSummary = await sql`
            SELECT
                COUNT(*) AS total_transactions,
                COALESCE(SUM(amount), 0) AS total_amount
            FROM user_transactions
            WHERE user_id = ${userId}
        `;

        // Get breakdown by type with balance calculation (current day only)
        const typeBreakdown = await sql`
            SELECT
                type,
                COUNT(*) as count,
                SUM(amount) as total
            FROM user_transactions
            WHERE user_id = ${userId} AND transaction_date = CURRENT_DATE
            GROUP BY type
            ORDER BY type
        `;

        // Get breakdown by category (current day only)
        const categoryBreakdown = await sql`
            SELECT
                category,
                COUNT(*) as count,
                SUM(amount) as total
            FROM user_transactions
            WHERE user_id = ${userId} AND category IS NOT NULL AND transaction_date = CURRENT_DATE
            GROUP BY category
            ORDER BY category
        `;

        // Calculate today's income and expenses from type breakdown
        let todayIncome = 0;
        let todayExpenses = 0;

        typeBreakdown.forEach(item => {
            if (item.type === 'credit') {
                todayIncome += parseFloat(item.total || 0);
            } else if (item.type === 'debit') {
                todayExpenses += parseFloat(item.total || 0);
            }
        });

        // Get total balance (all time)
        const totalBalanceQuery = await sql`
            SELECT
                COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) as total_income,
                COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) as total_expenses
            FROM user_transactions
            WHERE user_id = ${userId}
        `;

        const totalIncome = totalBalanceQuery[0]?.total_income || 0;
        const totalExpenses = totalBalanceQuery[0]?.total_expenses || 0;
        const totalBalance = totalIncome - totalExpenses;

        // Combine all results
        const result = {
            total_transactions: basicSummary[0]?.total_transactions || 0,
            total_amount: basicSummary[0]?.total_amount || 0,
            balance: totalBalance,           // Total balance (all time)
            income: todayIncome,            // Today's income only
            expenses: todayExpenses,        // Today's expenses only
            total_income: totalIncome,      // Total income (all time)
            total_expenses: totalExpenses,  // Total expenses (all time)
            by_type: typeBreakdown,
            by_category: categoryBreakdown
        };

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error("Error fetching transactions summary", error);
        res.status(500).json({ 
            success: false,
            error: "Failed to fetch transactions summary",
            details: error.message || 'Database error occurred'
        });
    }
}

// GET /api/users/:id/transactions/:transaction_id: Fetch a single transaction by ID
export async function getTransactionById(req, res) {
    try {
        const userId = req.userId;
        const { transaction_id } = req.params;
        const transaction = await sql`SELECT * FROM user_transactions WHERE id = ${transaction_id} AND user_id = ${userId}`;
        res.json(transaction);
    } catch (error) {
        console.error("Error fetching transaction", error);
        res.status(500).json({ error: "Failed to fetch transaction" });
    }
}

// POST /api/users/:id/transactions: Create a new transaction for a user with optional receipt upload
export const createTransaction = [
    upload.single('receipt'),
    async function handleCreateTransaction(req, res) {
        try {
            const userId = req.userId;
            console.log('Transaction data:', req.body);
            console.log('File uploaded:', req.file ? 'Yes' : 'No');
            
            const { amount, currency, type, category, tags, description, reference, transaction_date } = req.body;

            // Validate required fields: amount must be a positive number
            if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
                return res.status(400).json({ error: "Amount is required and must be a positive number" });
            }

            // Validate transaction type
            if (!type || !['debit', 'credit'].includes(type)) {
                return res.status(400).json({ error: "Type is required and must be either 'debit' or 'credit'" });
            }

            // Check if user exists
            const userExists = await sql`SELECT id FROM users WHERE id = ${userId}`;
            if (userExists.length === 0) {
                return res.status(404).json({ error: "User not found" });
            }

            // Handle receipt upload if file is provided
            let receiptUrl = null;
            let receiptFilename = null;
            
            if (req.file) {
                const mimeType = req.file.mimetype || 'image/jpeg';
                receiptUrl = bufferToDataUrl(mimeType, req.file.buffer);
                receiptFilename = req.file.originalname || `receipt_${Date.now()}.jpg`;
            }

            // Set default values for optional fields
            const currencyValue = currency || 'INR';
            const tagsValue = tags || [];

            // Insert new transaction into the database
            const transaction = await sql`
                INSERT INTO user_transactions (
                    user_id, amount, currency, type, category, tags, description, reference, receipt_url, receipt_filename, transaction_date
                ) VALUES (
                    ${userId}, ${amount}, ${currencyValue}, ${type}, ${category}, ${tagsValue}, ${description}, ${reference}, ${receiptUrl}, ${receiptFilename}, ${transaction_date || new Date().toISOString().split('T')[0]}
                ) RETURNING *
            `;
            
            res.json({
                message: "Transaction created successfully",
                transaction: transaction[0],
                receiptUploaded: !!req.file
            });
        } catch (error) {
            console.error("Error creating transaction", error); 
            res.status(500).json({ error: "Failed to create transaction" });
        }
    }
];


// DELETE /api/users/:id/transactions/:transaction_id: Delete a single transaction by ID
export async function deleteTransaction(req, res) {
    try {
        const userId = req.userId;
        const { transaction_id } = req.params;
        
        // Check if transaction exists and belongs to the user
        const transactionExists = await sql`SELECT * FROM user_transactions WHERE id = ${transaction_id} AND user_id = ${userId}`;
        if (transactionExists.length === 0) {
            return res.status(404).json({ error: "Transaction not found or doesn't belong to this user" });
        }
        
        const result = await sql`DELETE FROM user_transactions WHERE id = ${transaction_id} AND user_id = ${userId} RETURNING *`;
        
        res.json({
            message: "Transaction deleted successfully",
            deletedTransaction: result[0]
        });
    }
    catch (error) {
        console.error("Error deleting transaction", error);
        res.status(500).json({ error: "Failed to delete transaction" });
    }
}
// Bulk delete transactions for a user based on an array of transaction IDs
export async function bulkDeleteTransactions(req, res) {
    try {
        const userId = req.userId;
        const { transaction_ids } = req.body;

        // Validate input
        if (!Array.isArray(transaction_ids) || transaction_ids.length === 0) {
            return res.status(400).json({ error: "transaction_ids must be a non-empty array" });
        }

        // Check if user exists
        // const userExists = await sql`SELECT * FROM users WHERE id = ${id}`;
        // if (userExists.length === 0) {
        //     return res.status(404).json({ error: "User not found" });
        // }

        // Check which transactions exist and belong to the user
        const foundTransactions = await sql`
            SELECT id FROM user_transactions 
            WHERE user_id = ${userId} AND id = ANY(${transaction_ids})
        `;

        const foundIds = foundTransactions.map(t => t.id);
        const notFoundIds = transaction_ids.filter(tid => !foundIds.includes(tid));

        // Delete the found transactions
        const deleted = await sql`
            DELETE FROM user_transactions 
            WHERE user_id = ${userId} AND id = ANY(${foundIds})
            RETURNING *
        `;

        res.json({
            message: "Bulk delete completed",
            deletedTransactions: deleted,
            notFoundTransactionIds: notFoundIds
        });
    } catch (error) {
        console.error("Error bulk deleting transactions", error);
        res.status(500).json({ error: "Failed to bulk delete transactions" });
    }
}


// PUT /api/users/:id/transactions/:transaction_id: Update a single transaction by ID
export async function updateTransaction(req, res) {
    try {
        const { transaction_id } = req.params;
        const { amount, currency, type, status, category, tags, merchant, reference, description, transaction_date } = req.body;
        
        // Update the transaction
        await sql`
            UPDATE user_transactions 
            SET 
                amount = ${amount}, 
                currency = ${currency || 'INR'}, 
                type = ${type}, 
                status = ${status || 'completed'}, 
                category = ${category}, 
                tags = ${tags || []}, 
                merchant = ${merchant || ''}, 
                reference = ${reference || ''}, 
                description = ${description || ''},
                transaction_date = ${transaction_date || new Date().toISOString().split('T')[0]}
            WHERE id = ${transaction_id}
        `;
        
        // Fetch and return the updated transaction
        const updatedTransaction = await sql`
            SELECT 
                id, 
                amount, 
                currency, 
                type, 
                status, 
                category, 
                tags, 
                merchant, 
                reference, 
                description,
                transaction_date,
                created_at,
                updated_at
            FROM user_transactions 
            WHERE id = ${transaction_id}
        `;
        
        res.json({
            success: true,
            data: updatedTransaction[0]
        });
    }
    catch (error) {
        console.error("Error updating transaction", error);
        res.status(500).json({ 
            success: false,
            error: "Failed to update transaction" 
        });
    }
}
