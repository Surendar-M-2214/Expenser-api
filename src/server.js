// Import required modules
import express from "express";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";
import { initDB } from "./config/db.js";
import { ratelimiter } from "./middleware/ratelimiter.js";
import usersRoute from "./routes/usersRoutes.js";
import transactionRoute from "./routes/transactionRoutes.js";
import financialRoute from "./routes/financialRoutes.js";
// Load environment variables from .env file
dotenv.config();

// Set the port from environment or default to 3000
const port = process.env.PORT || 3000;

// Initialize Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Configure Clerk middleware with environment variables
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
