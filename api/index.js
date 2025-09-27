// Import required modules
import express from "express";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";
import { initDB } from "../src/config/db.js";
import { ratelimiter } from "../src/middleware/ratelimiter.js";
import usersRoute from "../src/routes/usersRoutes.js";
import transactionRoute from "../src/routes/transactionRoutes.js";
import financialRoute from "../src/routes/financialRoutes.js";
import aiRoute from "../src/routes/aiRoutes.js";
import fileUploadRoute from "../src/routes/fileUploadRoutes.js";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

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

// Root endpoint: Welcome message
app.get("/", async (req, res) => {
    res.send("<h1 style='color:blue;text-align:center;font-size:30px;'>Welcome to the Transactions API</h1>");
});

// API routes
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

// Initialize the database
let dbInitialized = false;

const initializeDatabase = async () => {
  if (!dbInitialized) {
    try {
      await initDB();
      dbInitialized = true;
      console.log("Database initialized successfully");
    } catch (error) {
      console.error("Failed to initialize database", error);
    }
  }
};

// Initialize database on first request
app.use(async (req, res, next) => {
  await initializeDatabase();
  next();
});

// Export the app for Vercel
export default app;
