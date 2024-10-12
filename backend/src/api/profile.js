import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const prisma = new PrismaClient();
const router = express.Router(); // Ensure the router is correctly instantiated

// Middleware for authentication
const authToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401); // No token, return 401 Unauthorized
    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET); // Verify token
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });
        if (!user) return res.sendStatus(403); // User not found, return 403 Forbidden

        req.user = user; // Attach user to request
        next(); // Proceed to the next middleware
    } catch (error) {
        console.error('Error verifying token:', error);
        res.sendStatus(403); // Token verification failed, return 403 Forbidden
    }
};

// Endpoint to get user profile
const getProfile = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });
        if (!user) {
            return res.sendStatus(404); // User not found, return 404 Not Found
        }
        res.json(user); // Send the user data as a response
    } catch (error) {
        console.error('Error fetching user profile', error);
        res.sendStatus(500); // Internal server error
    }
};

// Endpoint to update user profile
const updateProfile = async (req, res) => {
    const { name, email, password } = req.body;
    console.log('Update profile for user:', req.user.id);

    const updateData = {};
    if (name) updateData.name = name; // Add name if provided
    if (email) updateData.email = email; // Add email if provided
    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10); // Hash the password
        updateData.password = hashedPassword; // Add hashed password to update data
    }
    try {
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData, // Pass the update data
        });
        res.json(updatedUser); // Send the updated user data as a response
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: error.message }); // Internal server error
    }
};

// Define routes
router.get('/profile', authToken, getProfile); // Get user profile
router.put('/profile', authToken, updateProfile); // Update user profile

export default router; // Export the router for use in the main application
