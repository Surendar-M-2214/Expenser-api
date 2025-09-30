// Import required modules
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";
import { initDB } from "./config/db.js";
import { ratelimiter } from "./middleware/ratelimiter.js";
import usersRoute from "./routes/usersRoutes.js";
import transactionRoute from "./routes/transactionRoutes.js";
import financialRoute from "./routes/financialRoutes.js";
import aiRoute from "./routes/aiRoutes.js";
import fileUploadRoute from "./routes/fileUploadRoutes.js";
// Load environment variables from .env file
dotenv.config();

// Set the port from environment or default to 3000
const port = process.env.PORT || 3000;

// Initialize Express app
const app = express();

// Middleware to parse JSON bodies with increased size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:19006', 'exp://192.168.1.100:8081'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-clerk-auth-token']
}));

// Configure Clerk middleware with environment variables
console.log('=== CLERK CONFIG DEBUG ===');
console.log('CLERK_PUBLISHABLE_KEY exists:', !!process.env.CLERK_PUBLISHABLE_KEY);
console.log('CLERK_SECRET_KEY exists:', !!process.env.CLERK_SECRET_KEY);
console.log('CLERK_PUBLISHABLE_KEY preview:', process.env.CLERK_PUBLISHABLE_KEY ? process.env.CLERK_PUBLISHABLE_KEY.substring(0, 20) + '...' : 'Not set');

app.use(clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
}));

app.use(ratelimiter);
/**
 * Initialize the database and ensure required tables and indexes exist.
 */


// Root endpoint: Welcome message


 
app.get("/", async (req, res) => {
    res.send("<h1 style='color:blue;text-align:center;font-size:30px;'>Welcome to the Transactions API</h1>");
});

app.use("/api/users", usersRoute);
app.use("/api/users/:id/transactions", (req, res, next) => {
  // Store the user ID from the parent route so it's available in child routes
  req.userId = req.params.id;
  next();
}, transactionRoute);
app.use("/api/users/:id/finance", (req, res, next) => {
  // Store the user ID from the parent route so it's available in child routes
  req.userId = req.params.id;
  next();
}, financialRoute);
app.use("/api/ai", aiRoute);
app.use("/api/upload", fileUploadRoute);

// 404 handler for unmatched routes
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found',
        details: `The requested route ${req.originalUrl} was not found on this server`
    });
});

// Handle 413 Payload Too Large errors specifically
app.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            error: 'Payload Too Large',
            details: 'Request body size exceeds the maximum allowed limit of 10MB. Please reduce the size of your data and try again.'
        });
    }
    next(error);
});

// Global error handler to ensure JSON responses
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    
    // Ensure we always return JSON, never HTML
    if (!res.headersSent) {
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: error.message || 'An unexpected error occurred'
        });
    }
});

// Get financial summary by day, week, month, year using transaction_date



// Initialize the database and start the server
initDB()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
            console.log("Database initialized successfully");
         
        });
    })
    .catch((e) => console.error("Failed to initialize database", e));
