import express from "express";
import { gemini } from "../config/gemini.js";
import { sql } from "../config/db.js";

const router = express.Router();

// AI chat endpoint with transaction data and conversation history
router.post("/chat", async (req, res) => {
  try {
    const { message, userId, conversationHistory = [] } = req.body;

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

    // Create conversation context
    const conversationContext = conversationHistory.length > 0 ? `
    Previous Conversation:
    ${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
    
    ` : '';

    // Create a comprehensive financial context prompt
    const financialContext = `You are a helpful AI financial assistant. You can have normal conversations and answer any questions, not just financial ones.

    ${conversationContext}Current User Question: "${message}"

    ${Object.keys(transactionData).length > 0 ? `
    User's Transaction Data (last 3 months) - Only use this data if the user specifically asks about their spending, transactions, or financial analysis:
    ${JSON.stringify(transactionData, null, 2)}
    ` : `
    Note: No transaction data available for this user.
    `}

    You can help with:
    - General financial advice and education
    - Investment strategies and options
    - Budgeting and money management
    - Tax planning and optimization
    - Insurance and risk management
    - Retirement planning
    - Debt management and consolidation
    - Real estate and property investment
    - Cryptocurrency and digital assets
    - Business finance and entrepreneurship
    - Economic trends and market analysis
    - Personal finance tools and apps
    - Financial goal setting and planning
    - Credit scores and loan applications
    - Emergency fund planning
    - General conversations and questions
    - Any other topics the user wants to discuss

    IMPORTANT INSTRUCTIONS:
    - Be conversational and friendly, not just financial-focused
    - Answer the user's question directly, whether it's financial or not
    - Only reference transaction data if the user specifically asks about their spending or financial analysis
    - Use informal, conversational tone
    - Minimize emojis - use only 1-2 if absolutely necessary
    - Use **bold** formatting for key points and numbers
    - If it's a financial question, provide helpful advice
    - If it's a general question, answer normally
    - Keep responses under 200 words unless complex analysis is needed
    - Be helpful and encouraging in your responses
    - Don't force financial advice into non-financial questions`;

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
