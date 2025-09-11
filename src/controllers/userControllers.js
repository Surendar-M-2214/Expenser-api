import { sql } from "../config/db.js";

// GET /api/users/: Fetch all users
export async function getUsers(req, res) {
    try {
        const users = await sql`SELECT * FROM users`;
        res.json(users);
    } catch (error) {
        console.error("Error fetching users", error);
        res.status(500).json({ error: "Failed to fetch users" });
    }
}   

// GET /api/users/:id: Fetch a single user by ID
export async function getUserById(req, res) {
    try {
        const { id } = req.params;
        const user = await sql`SELECT * FROM users WHERE id = ${id}`;
        res.json(user);
    } catch (error) {
        console.error("Error fetching user", error);
        res.status(500).json({ error: "Failed to fetch user" });
    }
}

// POST /api/users/: Create a new user
export async function createUser(req, res) {
    try {
        const { name, email } = req.body;

        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({ error: "Name and email are required" });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        // Insert new user into the database
        const user = await sql`INSERT INTO users (name, email) VALUES (${name}, ${email}) RETURNING *`;
        res.json(user);
    } catch (error) {
        console.error("Error creating user", error);
        res.status(500).json({ error: "Failed to create user" });
    }
}
// PUT /api/users/:id: Update a user by ID
export async function updateUser(req, res) {
    try {
        const { id } = req.params;
        const { name, email } = req.body;
        
        // Check if user exists
        const userExists = await sql`SELECT * FROM users WHERE id = ${id}`;
        if (userExists.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Validate that at least one field is provided and not empty
        if ((!name || name.trim() === '') && (!email || email.trim() === '')) {
            return res.status(400).json({ error: "At least one field (name or email) must be provided and not empty" });
        }
        
        // Validate email format if email is provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: "Invalid email format" });
            }
        }
        
        // Build dynamic update query based on provided fields
        let updateQuery;
    
        
        if (name && email) {
            // Both fields provided
            updateQuery = sql`UPDATE users SET name = ${name}, email = ${email} WHERE id = ${id} RETURNING *`;
        } else if (name) {
            // Only name provided
            updateQuery = sql`UPDATE users SET name = ${name} WHERE id = ${id} RETURNING *`;
        } else {
            // Only email provided
            updateQuery = sql`UPDATE users SET email = ${email} WHERE id = ${id} RETURNING *`;
        }
        
        const result = await updateQuery;
        
        res.json({
            message: "User updated successfully",
            updatedUser: result[0]
        });
    }
    catch (error) {
        console.error("Error updating user", error);
        res.status(500).json({ error: "Failed to update user" });
    }
}

// DELETE /api/users/:id: Delete a user by ID
export async function deleteUser(req, res) {
    try {
        const { id } = req.params;
        
        // First check if user exists
        const userExists = await sql`SELECT id FROM users WHERE id = ${id}`;
        if (userExists.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Get count of transactions before deletion
        const transactionCount = await sql`SELECT COUNT(*) as count FROM user_transactions WHERE user_id = ${id}`;
        
        // Explicitly delete all transactions first (since CASCADE isn't working properly)
        await sql`DELETE FROM user_transactions WHERE user_id = ${id}`;
        
        // Then delete the user
        const result = await sql`DELETE FROM users WHERE id = ${id} RETURNING *`;
        
        // Verify that all transactions were deleted
        const remainingTransactions = await sql`SELECT COUNT(*) as count FROM user_transactions WHERE user_id = ${id}`;
        
        res.json({
            message: "User and all associated transactions deleted successfully",
            deletedUser: result[0],
            deletedTransactionsCount: transactionCount[0].count,
            remainingTransactionsCount: remainingTransactions[0].count
        });
    }
    catch (error) {
        console.error("Error deleting user", error);
        res.status(500).json({ error: "Failed to delete user" });
    }
}