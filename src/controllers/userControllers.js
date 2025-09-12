import { sql } from "../config/db.js";
import { clerkClient } from '@clerk/express';
import { createClerkClient } from '@clerk/backend';

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
        const {id, name, email, phone_number } = req.body;

        // Validate required fields
        if (!id || !name || !email) {
            return res.status(400).json({ error: "ID, Name (username) and email are required" });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }

        // Validate phone number format if provided
        if (phone_number) {
            const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
            if (!phoneRegex.test(phone_number.replace(/[\s\-\(\)]/g, ''))) {
                return res.status(400).json({ error: "Invalid phone number format" });
            }
        }

        // Insert new user into the database (name is username, no separate username field)
        const user = await sql`INSERT INTO users (id, name, email, phone_number) VALUES (${id}, ${name}, ${email}, ${phone_number}) RETURNING *`;
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
        const { name, email, phone_number } = req.body;
        
        // Check if user exists
        const userExists = await sql`SELECT * FROM users WHERE id = ${id}`;
        if (userExists.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Validate that at least one field is provided and not empty
        if ((!name || name.trim() === '') && (!email || email.trim() === '') && (!phone_number || phone_number.trim() === '')) {
            return res.status(400).json({ error: "At least one field must be provided and not empty" });
        }
        
        // Validate email format if email is provided
        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: "Invalid email format" });
            }
        }

        // Validate phone number format if provided
        if (phone_number) {
            const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
            if (!phoneRegex.test(phone_number.replace(/[\s\-\(\)]/g, ''))) {
                return res.status(400).json({ error: "Invalid phone number format" });
            }
        }
        
        // Build dynamic update query based on provided fields
        let updateQuery;
        const updateFields = [];
        const updateValues = [];
        
        if (name) {
            updateFields.push('name');
            updateValues.push(name);
        }
        if (email) {
            updateFields.push('email');
            updateValues.push(email);
        }
        if (phone_number) {
            updateFields.push('phone_number');
            updateValues.push(phone_number);
        }
        
        // Build the SET clause dynamically
        const setClause = updateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');
        updateQuery = sql.unsafe(`UPDATE users SET ${setClause} WHERE id = $${updateFields.length + 1} RETURNING *`, [...updateValues, id]);
        
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

// POST /api/users/profile-image: Upload profile image to Clerk
export async function uploadProfileImage(req, res) {
    try {
        // Get user ID from req.auth (set by clerkMiddleware)
        const { userId } = req.auth;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Convert buffer to base64 for Clerk API
        const base64Image = req.file.buffer.toString('base64');
        const dataUrl = `data:${req.file.mimetype};base64,${base64Image}`;

        // Upload to Clerk using the specific profile image method
        const updatedUser = await clerkClient.users.updateUserProfileImage(userId, {
            file: dataUrl
        });

        // Also sync with local database if user exists
        try {
            const existingUser = await sql`SELECT * FROM users WHERE id = ${userId}`;
            if (existingUser.length > 0) {
                // User exists in local DB, no need to create
                console.log('User exists in local database, image updated in Clerk');
            } else {
                // Create user in local database with basic info
                const clerkUser = await clerkClient.users.getUser(userId);
                await sql`INSERT INTO users (id, name, email) VALUES (${userId}, ${clerkUser.firstName || ''}, ${clerkUser.emailAddresses[0]?.emailAddress || ''})`;
                console.log('Created user in local database');
            }
        } catch (dbError) {
            console.log('Database sync error (non-critical):', dbError.message);
        }

        res.json({
            message: 'Profile image uploaded successfully',
            imageUrl: updatedUser.imageUrl
        });

    } catch (error) {
        console.error('Error uploading profile image:', error);
        
        if (error.status === 401) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        res.status(500).json({ error: 'Failed to upload profile image' });
    }
}

// PUT /api/users/profile: Update profile details in Clerk
export async function updateProfile(req, res) {
    try {
        // Get user ID from req.auth (set by clerkMiddleware)
        const { userId } = req.auth;
        
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { firstName, lastName, phoneNumber } = req.body;

        // Validate that at least one field is provided
        if (!firstName && !lastName && !phoneNumber) {
            return res.status(400).json({ error: 'At least one field must be provided' });
        }

        // Prepare update data for Clerk
        const updateData = {};
        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (phoneNumber) updateData.phoneNumber = phoneNumber;

        console.log('Updating Clerk user:', userId, 'with data:', updateData);

        // Update user in Clerk
        const updatedUser = await clerkClient.users.updateUser(userId, updateData);

        // Also update or create user in local database for consistency
        try {
            // Check if user exists in local database
            const existingUser = await sql`SELECT * FROM users WHERE id = ${userId}`;
            
            if (existingUser.length > 0) {
                // Update existing user
                await sql`UPDATE users SET name = ${firstName || ''}, email = ${updatedUser.emailAddresses[0]?.emailAddress || ''}, phone_number = ${phoneNumber || ''} WHERE id = ${userId}`;
            } else {
                // Create new user in local database
                await sql`INSERT INTO users (id, name, email, phone_number) VALUES (${userId}, ${firstName || ''}, ${updatedUser.emailAddresses[0]?.emailAddress || ''}, ${phoneNumber || ''})`;
            }
        } catch (dbError) {
            console.log('Database sync error (non-critical):', dbError.message);
            // Don't fail the request if database sync fails
        }

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: updatedUser.id,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                emailAddresses: updatedUser.emailAddresses,
                phoneNumbers: updatedUser.phoneNumbers,
                imageUrl: updatedUser.imageUrl
            }
        });

    } catch (error) {
        console.error('Error updating profile:', error);
        
        if (error.status === 401) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        if (error.status === 404) {
            return res.status(404).json({ error: 'User not found in Clerk' });
        }
        
        res.status(500).json({ error: 'Failed to update profile' });
    }
}