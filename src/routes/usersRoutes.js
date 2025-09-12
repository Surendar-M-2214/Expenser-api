import express from "express";
import multer from "multer";

import { getUsers, getUserById, createUser, deleteUser, updateUser, uploadProfileImage, updateProfile, checkUsernameAvailability } from "../controllers/userControllers.js";

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// GET /api/users/: Fetch all users
router.get("/", getUsers);
// POST /api/users/: Create a new user
router.post("/", createUser);

// SPECIFIC ROUTES (must come before parameterized routes)
// POST /api/users/check-username: Check username availability
router.post("/check-username", checkUsernameAvailability);
// POST /api/users/profile-image: Upload profile image
router.post("/profile-image", upload.single('file'), uploadProfileImage);
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
