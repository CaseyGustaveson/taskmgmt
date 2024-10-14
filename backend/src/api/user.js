import express from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';

dotenv.config();

const prisma = new PrismaClient();
const router = express.Router();

// Middleware for authentication
const authToken = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        console.log('No token provided');
        return res.sendStatus(401); // Unauthorized
    }

    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

        if (!user) {
            console.log('User not found');
            return res.sendStatus(403); // Forbidden
        }

        req.user = { ...user, role: decoded.role }; // Attach user and role to request
        next(); // Proceed to the next middleware
    } catch (error) {
        console.error('Error verifying token', error);
        res.sendStatus(403); // Forbidden
    }
};

// Fetch the authenticated user's data
const getUser = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        if (!user) return res.sendStatus(404); // Not found
        res.json(user);
    } catch (error) {
        console.error('Error fetching user', error);
        res.sendStatus(500); // Internal server error
    }
};

// Create a new user
const createUser = async (req, res) => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: { name, email, password: hashedPassword, role },
        });
        res.status(201).json(newUser); // Created
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update the authenticated user's role
const updateUserRole = async (req, res) => {
    const { role } = req.body;

    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can update roles' });
    }

    try {
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: { role },
        });
        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: error.message });
    }
};

// Update user data
const updateUser = async (req, res) => {
    const { name, email, password } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    try {
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData,
        });
        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: error.message });
    }
};

// Define routes
router.post('/', createUser); // Create a new user
router.get('/', authToken, getUser); // Get authenticated user's data
router.put('/', authToken, updateUser); // Update authenticated user's data
router.post('/role', authToken, updateUserRole); // Update user role (only for admins)

export default router; // Export the router for use in the main application
