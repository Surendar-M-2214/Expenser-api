import express from "express";
import multer from "multer";

import { getUsers, getUserById, createUser, deleteUser, updateUser, uploadProfileImage, updateProfile } from "../controllers/userControllers.js";

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
// GET /api/users//:id: Fetch a single user by ID
router.get("/:id", getUserById);
// POST /api/users/: Create a new user
router.post("/", createUser);
// DELETE /api/users//:id: Delete a user by ID
router.delete("/:id", deleteUser);
// PUT /api/users//:id: Update a user by ID
router.put("/:id", updateUser);
// POST /api/users/profile-image: Upload profile image
router.post("/profile-image", upload.single('file'), uploadProfileImage);
// PUT /api/users/profile: Update profile details
router.put("/profile", updateProfile);


export default router;
