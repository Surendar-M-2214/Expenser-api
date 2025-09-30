import { sql } from "../config/db.js";
import { clerkClient } from '@clerk/express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for file storage
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/profile-images');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer to store files on disk
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
            // Generate unique filename with timestamp
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            cb(null, `profile-${uniqueSuffix}${ext}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper to generate file URL
function generateFileUrl(filename) {
    return `/uploads/profile-images/${filename}`;
}

// Helper to delete old profile image file
async function deleteOldProfileImage(userId) {
    try {
        const result = await sql`SELECT profile_image FROM users WHERE id = ${userId}`;
        if (result.length > 0 && result[0].profile_image) {
            const oldImagePath = result[0].profile_image;
            // Only delete if it's a file path, not a data URL
            if (!oldImagePath.startsWith('data:')) {
                const fullPath = path.join(__dirname, '../../', oldImagePath);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    console.log('Deleted old profile image:', fullPath);
                }
            }
        }
    } catch (error) {
        console.error('Error deleting old profile image:', error);
        // Don't throw error, just log it
    }
}

// POST /api/users/profile-image: Upload profile image and store as data URL in DB
export const uploadProfileImage = [
    upload.single('image'),
    // Multer error handler
    (error, req, res, next) => {
        if (error instanceof multer.MulterError) {
            if (error.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({
                    success: false,
                    error: 'File too large',
                    details: 'Image file size exceeds the maximum allowed limit of 10MB. Please select a smaller image.'
                });
            }
        }
        next(error);
    },
    async function handleUpload(req, res) {
        try {
            const auth = await req.auth();
            const { userId } = auth || {};

            if (!userId) {
                return res.status(401).json({ 
                    success: false,
                    error: 'User not authenticated' 
                });
            }

            if (!req.file) {
                return res.status(400).json({ 
                    success: false,
                    error: 'No image file provided' 
                });
            }

            // Delete old profile image file
            await deleteOldProfileImage(userId);

            const filename = req.file.filename;
            const fileUrl = generateFileUrl(filename);

            // Update user's profile_image in DB with file path
            await sql`UPDATE users SET profile_image = ${fileUrl}, updated_at = NOW() WHERE id = ${userId}`;

            res.json({
                success: true,
                message: 'Profile image uploaded successfully',
                imageUrl: fileUrl
            });
        } catch (error) {
            console.error('Error uploading profile image:', error);
            res.status(500).json({ 
                success: false,
                error: 'Failed to upload profile image',
                details: error.message 
            });
        }
    }
];

// GET /api/users/test-auth: Test authentication endpoint
export async function testAuth(req, res) {
    try {
        console.log('=== TEST AUTH DEBUG ===');
        console.log('req.auth type:', typeof req.auth);
        console.log('req.headers.authorization:', req.headers.authorization ? 'Token present' : 'No token');
        console.log('Authorization header:', req.headers.authorization);
        
        // Call req.auth() as a function (new Clerk API)
        const auth = await req.auth();
        console.log('Auth result:', auth);
        console.log('Is authenticated:', auth.isAuthenticated);
        console.log('Token type:', auth.tokenType);
        console.log('Session status:', auth.sessionStatus);
        
        // Try to get token directly
        try {
            const token = await auth.getToken();
            console.log('Token from auth.getToken():', token ? 'Token exists' : 'No token');
            console.log('Token preview:', token ? token.substring(0, 50) + '...' : 'No token');
        } catch (tokenError) {
            console.log('Error getting token:', tokenError);
        }
        
        const { userId } = auth || {};
        console.log('User ID from auth:', userId);
        
        if (!userId) {
            return res.status(401).json({ 
                error: 'User not authenticated',
                auth: auth,
                headers: req.headers,
                debug: {
                    isAuthenticated: auth.isAuthenticated,
                    tokenType: auth.tokenType,
                    sessionStatus: auth.sessionStatus
                }
            });
        }
        
        res.json({
            message: 'Authentication successful',
            userId: userId,
            auth: auth,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Test auth error:', error);
        res.status(500).json({ error: 'Test auth failed' });
    }
}


// POST /api/users/check-username: Check if username is available
export async function checkUsernameAvailability(req, res) {
    try {
        const { username } = req.body;
        
        if (!username || username.trim() === '') {
            return res.status(400).json({ error: 'Username is required' });
        }

        // Check if username exists in database
        const existingUser = await sql`SELECT id FROM users WHERE username = ${username.trim()}`;
        
        if (existingUser.length > 0) {
            res.json({ available: false, message: 'Username is already taken' });
        } else {
            res.json({ available: true, message: 'Username is available' });
        }
    } catch (error) {
        console.error('Error checking username availability:', error);
        res.status(500).json({ error: 'Failed to check username availability' });
    }
}

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
        const {id, email, phone_number, firstName, lastName, username, profile_image } = req.body;

        // Validate required fields
        if (!id || !email) {
            return res.status(400).json({ error: "ID and email are required" });
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

        // Check if user already exists in Clerk (from signup flow)
        try {
            // Try to get the user from Clerk to verify they exist
            const clerkUser = await clerkClient.users.getUser(id);
            console.log('User exists in Clerk:', clerkUser.id);
            
            // Insert new user into the database
            // Use Clerk user ID as the id, no name field
            const user = await sql`INSERT INTO users (id, username, first_name, last_name, email, phone_number, profile_image) VALUES (${id}, ${username || ''}, ${firstName || ''}, ${lastName || ''}, ${email}, ${phone_number || ''}, ${profile_image || ''}) RETURNING *`;
            
            res.json({
                message: "User created successfully in database",
                user: user[0],
                clerkUser: {
                    id: clerkUser.id,
                    firstName: clerkUser.firstName,
                    lastName: clerkUser.lastName,
                    emailAddresses: clerkUser.emailAddresses,
                    phoneNumbers: clerkUser.phoneNumbers
                }
            });
        } catch (clerkError) {
            console.error('Error verifying user in Clerk:', clerkError);
            return res.status(500).json({ error: 'User not found in Clerk. Please sign up first.' });
        }
    } catch (error) {   
        console.error("Error creating user", error);
        res.status(500).json({ error: "Failed to create user" });
    }
}
// PUT /api/users/:id: Update a user by ID
export async function updateUser(req, res) {
    try {
        const auth = await req.auth()
        const { userId } = auth ;
        const { firstName, lastName, phoneNumber, email, phone_number, username, profile_image } = req.body;
        
        console.log('Update user request:', { userId, firstName, lastName, phoneNumber, email, phone_number, username, profile_image });
        
        // Check if user exists in database
        const userExists = await sql`SELECT * FROM users WHERE id = ${userId}`;
        if (userExists.length === 0) {
            return res.status(404).json({ error: "User not found in database" });
        }
        
        // Handle both old format (name, email, phone_number) and new format (firstName, lastName, phoneNumber)
        const dbUpdateFields = [];
        const dbUpdateValues = [];
        
        // Handle new profile format (firstName, lastName, phoneNumber, username, profile_image)
        if (firstName || lastName || phoneNumber || username || profile_image) {
            // Update in Clerk first
            if (firstName || lastName || phoneNumber) {
                const clerkUpdateData = {};
                if (firstName) clerkUpdateData.firstName = firstName;
                if (lastName) clerkUpdateData.lastName = lastName;
                if (phoneNumber) clerkUpdateData.phoneNumber = phoneNumber;
                
                try {
                    const updatedClerkUser = await clerkClient.users.updateUser(userId, clerkUpdateData);
                    console.log('Clerk user updated successfully:', updatedClerkUser.id);
                } catch (clerkError) {
                    console.error('Error updating user in Clerk:', clerkError);
                    return res.status(500).json({ error: 'Failed to update user in Clerk' });
                }
            }
            
            // Update in database
            if (firstName) {
                dbUpdateFields.push('first_name');
                dbUpdateValues.push(firstName);
            }
            if (lastName) {
                dbUpdateFields.push('last_name');
                dbUpdateValues.push(lastName);
            }
            if (phoneNumber) {
                dbUpdateFields.push('phone_number');
                dbUpdateValues.push(phoneNumber);
            }
            if (username) {
                dbUpdateFields.push('username');
                dbUpdateValues.push(username);
            }
            if (profile_image) {
                dbUpdateFields.push('profile_image');
                dbUpdateValues.push(profile_image);
            }
        }
        
        // Handle legacy format (email, phone_number)
        if (email || phone_number) {
            // Validate that at least one field is provided and not empty
            if ((!email || email.trim() === '') && (!phone_number || phone_number.trim() === '')) {
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
            
            if (email) {
                dbUpdateFields.push('email');
                dbUpdateValues.push(email);
            }
            if (phone_number) {
                dbUpdateFields.push('phone_number');
                dbUpdateValues.push(phone_number);
            }
        }
        
        // Update database if there are fields to update
        if (dbUpdateFields.length > 0) {
            const setClause = dbUpdateFields.map((field, index) => `${field} = $${index + 1}`).join(', ');
            const updateQuery = sql.unsafe(`UPDATE users SET ${setClause} WHERE id = $${dbUpdateFields.length + 1} RETURNING *`, [...dbUpdateValues, userId]);
            
            const result = await updateQuery;
            
            res.json({
                message: "User updated successfully in both database and Clerk",
                updatedUser: result[0]
            });
        } else {
            res.json({
                message: "No fields to update",
                updatedUser: userExists[0]
            });
        }
    }
    catch (error) {
        console.error("Error updating user", error);
        res.status(500).json({ error: "Failed to update user" });
    }
}

// DELETE /api/users/:id: Delete a user by ID
export async function deleteUser(req, res) {
    try {
        const auth = await req.auth()
        const { userId } = auth ;
        
        // First check if user exists
        const userExists = await sql`SELECT id FROM users WHERE id = ${userId}`;
        if (userExists.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Get count of transactions before deletion
        const transactionCount = await sql`SELECT COUNT(*) as count FROM user_transactions WHERE user_id = ${userId}`;
        
        // Explicitly delete all transactions first (since CASCADE isn't working properly)
        await sql`DELETE FROM user_transactions WHERE user_id = ${userId}`;
        
        // Then delete the user
        const result = await sql`DELETE FROM users WHERE id = ${userId} RETURNING *`;
        
        // Verify that all transactions were deleted
        const remainingTransactions = await sql`SELECT COUNT(*) as count FROM user_transactions WHERE user_id = ${userId}`;
        
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


// PUT /api/users/profile: Update profile details in database only
export async function updateProfile(req, res) {
    try {
        console.log('=== UPDATE PROFILE DEBUG ===');
        console.log('req.auth type:', typeof req.auth);
        console.log('req.headers.authorization:', req.headers.authorization ? 'Token present' : 'No token');
        
        // Call req.auth() as a function (new Clerk API) - ONLY for authentication
        const auth = await req.auth();
        console.log('Auth result:', auth);
        
        const { userId } = auth || {};
        console.log('User ID from auth:', userId);
        console.log('User ID type:', typeof userId);
        
        if (!userId) {
            console.log('ERROR: No userId found in req.auth');
            return res.status(401).json({ 
                success: false,
                error: 'User not authenticated',
                details: 'Authentication required to update profile'
            });
        }

        const { firstName, lastName, phoneNumber, username, profile_image } = req.body;
        
        console.log('Received update data:', { firstName, lastName, phoneNumber, username, profile_image });

        // Validate that at least one field is provided and not empty
        const hasValidField = (firstName && firstName.trim() !== '') || 
                             (lastName && lastName.trim() !== '') || 
                             (phoneNumber && phoneNumber.trim() !== '') ||
                             (username && username.trim() !== '') ||
                             (profile_image && profile_image.trim() !== '');
        
        if (!hasValidField) {
            return res.status(400).json({ 
                success: false,
                error: 'At least one field must be provided and not empty',
                details: 'Please provide at least one field to update',
                received: { firstName, lastName, phoneNumber, username, profile_image }
            });
        }

        // Update database with profile changes - DATABASE IS THE SINGLE SOURCE OF TRUTH
        const dbUpdateFields = [];
        const dbUpdateValues = [];
        
        if (firstName && firstName.trim() !== '') {
            dbUpdateFields.push('first_name = $' + (dbUpdateValues.length + 1));
            dbUpdateValues.push(firstName.trim());
        }
        if (lastName && lastName.trim() !== '') {
            dbUpdateFields.push('last_name = $' + (dbUpdateValues.length + 1));
            dbUpdateValues.push(lastName.trim());
        }
        if (username && username.trim() !== '') {
            dbUpdateFields.push('username = $' + (dbUpdateValues.length + 1));
            dbUpdateValues.push(username.trim());
        }
        if (phoneNumber && phoneNumber.trim() !== '') {
            dbUpdateFields.push('phone_number = $' + (dbUpdateValues.length + 1));
            dbUpdateValues.push(phoneNumber.trim());
        }
        if (profile_image && profile_image.trim() !== '') {
            dbUpdateFields.push('profile_image = $' + (dbUpdateValues.length + 1));
            dbUpdateValues.push(profile_image.trim());
        }
        
        // Always update the updated_at timestamp
        dbUpdateFields.push('updated_at = NOW()');
        
        // Update database - THIS IS THE ONLY PLACE WE STORE PROFILE DATA
        if (dbUpdateFields.length > 1) { // More than just updated_at
            try {
                // Build the query using tagged template literal
                const query = `UPDATE users SET ${dbUpdateFields.join(', ')} WHERE id = $${dbUpdateValues.length + 1}`;
                dbUpdateValues.push(userId);
                
                console.log('Updating database with:', { query, dbUpdateValues });
                
                // Use sql.query for parameterized queries
                await sql.query(query, dbUpdateValues);
                console.log('Database updated successfully for user:', userId);
            } catch (dbError) {
                console.error('Database update error:', dbError);
                return res.status(500).json({ 
                    success: false,
                    error: 'Database update failed',
                    details: 'Failed to update profile in database'
                });
            }
        }
        
        // Get updated profile data from database - SINGLE SOURCE OF TRUTH
        try {
            const updatedProfile = await sql`
                SELECT 
                    id,
                    first_name as "firstName",
                    last_name as "lastName", 
                    username,
                    phone_number as "phoneNumber",
                    profile_image as "profileImage",
                    email,
                    created_at as "createdAt",
                    updated_at as "updatedAt"
                FROM users 
                WHERE id = ${userId}
            `;
            
            if (updatedProfile.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found',
                    details: 'User profile not found in database'
                });
            }
            
            console.log('Profile updated successfully for user:', userId);
            
            res.json({
                success: true,
                message: 'Profile updated successfully',
                user: updatedProfile[0]
            });
            
        } catch (fetchError) {
            console.error('Error fetching updated profile:', fetchError);
            return res.status(500).json({
                success: false,
                error: 'Profile update successful but failed to fetch updated data',
                details: 'Profile was updated but could not retrieve the updated information'
            });
        }

    } catch (error) {
        console.error('Error updating profile:', error);
        
        // Ensure we always return JSON, never HTML
        if (error.status === 401) {
            return res.status(401).json({ 
                success: false,
                error: 'Invalid or expired token',
                details: error.message 
            });
        }
        
        // Handle specific error types
        if (error.name === 'ValidationError') {
            return res.status(400).json({ 
                success: false,
                error: 'Validation error',
                details: error.message 
            });
        }
        
        if (error.name === 'DatabaseError') {
            return res.status(500).json({ 
                success: false,
                error: 'Database error',
                details: 'Failed to update profile in database' 
            });
        }
        
        // Generic error response
        return res.status(500).json({ 
            success: false,
            error: 'Failed to update profile',
            details: error.message || 'An unexpected error occurred'
        });
    }
}

// GET /api/users/profile: Get user profile from database only
export async function getUserProfile(req, res) {
    try {
        console.log('=== GET USER PROFILE DEBUG ===');
        
        // Call req.auth() as a function (new Clerk API) - ONLY for authentication
        const auth = await req.auth();
        console.log('Auth result:', auth);
        
        const { userId } = auth || {};
        console.log('User ID from auth:', userId);
        
        if (!userId) {
            console.log('ERROR: No userId found in req.auth');
            return res.status(401).json({ 
                error: 'User not authenticated',
                auth: auth,
                headers: req.headers
            });
        }

        // Get user data from database
        const userData = await sql`
            SELECT id, username, first_name, last_name, email, phone_number, profile_image, created_at, updated_at
            FROM users 
            WHERE id = ${userId}
        `;
        
        if (userData.length === 0) {
            return res.status(404).json({ error: 'User not found in database' });
        }
        
        const user = userData[0];
        console.log('User profile from database:', user);
        
        res.json({
            message: 'User profile retrieved successfully',
            user: {
                id: user.id,
                username: user.username,
                firstName: user.first_name,
                lastName: user.last_name,
                email: user.email,
                phoneNumber: user.phone_number,
                profileImage: user.profile_image,
                createdAt: user.created_at,
                updatedAt: user.updated_at
            }
        });
        
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
}