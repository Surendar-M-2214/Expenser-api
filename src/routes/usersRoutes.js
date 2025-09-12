import express from "express";

import { getUsers, getUserById, createUser, deleteUser, updateUser, updateProfile, checkUsernameAvailability, testAuth } from "../controllers/userControllers.js";

const router = express.Router();

// GET /api/users/: Fetch all users
router.get("/", getUsers);
// POST /api/users/: Create a new user
router.post("/", createUser);

// SPECIFIC ROUTES (must come before parameterized routes)
// GET /api/users/test-auth: Test authentication
router.get("/test-auth", testAuth);
// POST /api/users/check-username: Check username availability
router.post("/check-username", checkUsernameAvailability);
// PUT /api/users/profile: Update profile details
router.put("/profile", updateProfile);

// PARAMETERIZED ROUTES (must come after specific routes)
// GET /api/users/:id: Fetch a single user by ID
router.get("/:id", getUserById);
// DELETE /api/users/:id: Delete a user by ID
router.delete("/:id", deleteUser);
// PUT /api/users/:id: Update a user by ID
router.put("/:id", updateUser);


export default router;
