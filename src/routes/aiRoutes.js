import express from "express";
import { gemini } from "../config/gemini.js";
import { sql } from "../config/db.js";

const router = express.Router();

// AI chat endpoint with transaction data
router.post("/chat", async (req, res) => {
  try {
    const { message, userId } = req.body;

    // Validate input
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: "Message is required"
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required"
      });
    }

    // Get user's transaction data
    let transactionData = {};
    try {
      // Get recent transactions (last 3 months)
      const transactions = await sql`
        SELECT 
          amount, 
          type, 
          category, 
          description, 
          transaction_date,
          currency
        FROM user_transactions 
        WHERE user_id = ${userId} 
          AND transaction_date >= CURRENT_DATE - INTERVAL '3 months'
        ORDER BY transaction_date DESC
        LIMIT 100
      `;

      // Get spending summary by category
      const categorySummary = await sql`
        SELECT 
          category,
          COUNT(*) as transaction_count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
        FROM user_transactions 
        WHERE user_id = ${userId} 
          AND type = 'debit'
          AND transaction_date >= CURRENT_DATE - INTERVAL '3 months'
        GROUP BY category
        ORDER BY total_amount DESC
      `;

      // Get monthly spending trend
      const monthlyTrend = await sql`
        SELECT 
          DATE_TRUNC('month', transaction_date) as month,
          SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as expenses,
          SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as income
        FROM user_transactions 
        WHERE user_id = ${userId} 
          AND transaction_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', transaction_date)
        ORDER BY month DESC
      `;

      // Get top merchants/descriptions
      const topMerchants = await sql`
        SELECT 
          description,
          COUNT(*) as frequency,
          SUM(amount) as total_spent
        FROM user_transactions 
        WHERE user_id = ${userId} 
          AND type = 'debit'
          AND transaction_date >= CURRENT_DATE - INTERVAL '3 months'
        GROUP BY description
        ORDER BY total_spent DESC
        LIMIT 10
      `;

      transactionData = {
        recentTransactions: transactions,
        categorySummary: categorySummary,
        monthlyTrend: monthlyTrend,
        topMerchants: topMerchants
      };
    } catch (dbError) {
      console.error("Database error:", dbError);
      // Continue without transaction data
    }

    // Create a comprehensive financial context prompt
    const financialContext = `You are a helpful AI financial assistant analyzing the user's transaction data. 

    User's Question: "${message}"

    User's Transaction Data (last 3 months):
    ${JSON.stringify(transactionData, null, 2)}

    Based on this data, provide personalized financial insights and advice. Focus on:
    1. Spending patterns and areas of overspending
    2. Investment opportunities based on spending habits
    3. Budget recommendations
    4. Financial health assessment
    5. Specific actionable advice

    If the user asks about specific categories, merchants, or time periods, use the actual data to provide accurate insights.
    Be specific and reference actual amounts and patterns from their data.
    Keep responses conversational but data-driven.`;

    // Get AI response
    const aiResponse = await gemini(financialContext);

    // Return the response
    res.json({
      success: true,
      data: {
        message: aiResponse,
        timestamp: new Date().toISOString(),
        dataUsed: Object.keys(transactionData).length > 0
      }
    });

  } catch (error) {
    console.error("AI Chat Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process AI request. Please try again."
    });
  }
});

// Get live market data
router.get("/market-data", async (req, res) => {
  try {
    // In a real application, you would fetch from actual market APIs
    // For now, we'll return mock data that updates every few minutes
    const marketData = {
      stocks: {
        nifty50: {
          value: 24500 + Math.floor(Math.random() * 200 - 100),
          change: (Math.random() * 2 - 1).toFixed(2),
          changePercent: (Math.random() * 4 - 2).toFixed(2)
        },
        sensex: {
          value: 80500 + Math.floor(Math.random() * 500 - 250),
          change: (Math.random() * 3 - 1.5).toFixed(2),
          changePercent: (Math.random() * 3 - 1.5).toFixed(2)
        },
        bankNifty: {
          value: 52000 + Math.floor(Math.random() * 300 - 150),
          change: (Math.random() * 2.5 - 1.25).toFixed(2),
          changePercent: (Math.random() * 3.5 - 1.75).toFixed(2)
        }
      },
      commodities: {
        gold: {
          value: 75000 + Math.floor(Math.random() * 1000 - 500),
          change: (Math.random() * 200 - 100).toFixed(2),
          changePercent: (Math.random() * 2 - 1).toFixed(2),
          unit: "per 10g"
        },
        silver: {
          value: 95000 + Math.floor(Math.random() * 2000 - 1000),
          change: (Math.random() * 500 - 250).toFixed(2),
          changePercent: (Math.random() * 3 - 1.5).toFixed(2),
          unit: "per kg"
        }
      },
      crypto: {
        bitcoin: {
          value: 4500000 + Math.floor(Math.random() * 100000 - 50000),
          change: (Math.random() * 50000 - 25000).toFixed(2),
          changePercent: (Math.random() * 5 - 2.5).toFixed(2)
        },
        ethereum: {
          value: 280000 + Math.floor(Math.random() * 20000 - 10000),
          change: (Math.random() * 10000 - 5000).toFixed(2),
          changePercent: (Math.random() * 6 - 3).toFixed(2)
        }
      },
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: marketData
    });

  } catch (error) {
    console.error("Market data error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch market data"
    });
  }
});

// Health check endpoint for AI service
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "AI service is running",
    timestamp: new Date().toISOString()
  });
});

export default router;
