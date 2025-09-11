import express from "express";

import { getUsers, getUserById, createUser, deleteUser, updateUser } from "../controllers/userControllers.js";

const router = express.Router();
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


export default router;
