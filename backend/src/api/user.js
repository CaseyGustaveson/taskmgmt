// Import necessary modules for the user authentication and management functionality
import express from 'express'; // Importing Express for handling HTTP requests and routing
import jwt from 'jsonwebtoken'; // Importing jsonwebtoken to create and verify JWT tokens
import { PrismaClient } from '@prisma/client'; // Importing PrismaClient for database interaction
import dotenv from 'dotenv'; // Importing dotenv to manage environment variables
import bcrypt from 'bcrypt'; // Importing bcrypt for password hashing and comparison

// Load environment variables from .env file (e.g., secret keys for JWT)
dotenv.config();

// Initialize PrismaClient to interact with the PostgreSQL database
const prisma = new PrismaClient();

// Create an Express router instance to define routes for user management
const router = express.Router();

// Middleware to authenticate requests by verifying the JWT token
const authToken = async (req, res, next) => {
    // Extract the token from the 'Authorization' header (Bearer token pattern)
    const token = req.headers['authorization']?.split(' ')[1];

    // Check if the token is missing
    if (!token) {
        console.log('No token provided'); // Log when no token is provided
        return res.sendStatus(401); // Respond with 401 Unauthorized
    }

    try {
        // Verify the JWT token using the secret key stored in environment variables
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        
        // Fetch the user from the database using the ID embedded in the token
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

        // Check if the user exists in the database
        if (!user) {
            console.log('User not found'); // Log when the user doesn't exist
            return res.sendStatus(403); // Respond with 403 Forbidden if user not found
        }

        // Attach the user information and their role to the request object for use in other routes
        req.user = { ...user, role: decoded.role };
        
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error('Error verifying token', error); // Log any error that occurs during token verification
        res.sendStatus(403); // Respond with 403 Forbidden if token verification fails
    }
};

// Route handler to fetch data for the currently authenticated user
const getUser = async (req, res) => {
    try {
        // Fetch the user's details from the database using the ID attached to the request object
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });

        // If the user doesn't exist, respond with a 404 Not Found
        if (!user) return res.sendStatus(404); // Not found

        // Respond with the user's data in JSON format
        res.json(user);
    } catch (error) {
        console.error('Error fetching user', error); // Log any error that occurs while fetching the user
        res.sendStatus(500); // Respond with 500 Internal Server Error
    }
};

// Route handler to create a new user (registration process)
const createUser = async (req, res) => {
    const { name, email, password, role } = req.body; // Destructure necessary fields from request body

    // Check if required fields are present
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password are required' }); // Respond with 400 Bad Request if fields are missing
    }

    try {
        // Hash the user's password for security before storing it in the database
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create a new user in the database with the provided information
        const newUser = await prisma.user.create({
            data: { name, email, password: hashedPassword, role },
        });

        // Respond with the newly created user and 201 Created status
        res.status(201).json(newUser);
    } catch (error) {
        console.error('Error creating user:', error); // Log any error that occurs during user creation
        res.status(500).json({ error: error.message }); // Respond with 500 Internal Server Error
    }
};

// Route handler to update the role of the authenticated user (Admin-only action)
const updateUserRole = async (req, res) => {
    const { role } = req.body; // Extract the new role from the request body

    // Check if the currently authenticated user has admin privileges
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only admins can update roles' }); // Respond with 403 Forbidden if not an admin
    }

    try {
        // Update the user's role in the database
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: { role }, // Update only the role field
        });

        // Respond with the updated user information
        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating user role:', error); // Log any error that occurs during role update
        res.status(500).json({ error: error.message }); // Respond with 500 Internal Server Error
    }
};

// Route handler to update the authenticated user's data (e.g., name, email, password)
const updateUser = async (req, res) => {
    const { name, email, password } = req.body; // Extract new data from the request body
    const updateData = {}; // Initialize an empty object to hold the updates

    // Conditionally add updated fields to the updateData object
    if (name) updateData.name = name; // Update name if provided
    if (email) updateData.email = email; // Update email if provided
    if (password) updateData.password = await bcrypt.hash(password, 10); // Hash and update password if provided

    try {
        // Update the authenticated user's data in the database
        const updatedUser = await prisma.user.update({
            where: { id: req.user.id }, // Query by the user's ID
            data: updateData, // Apply the updates
        });

        // Respond with the updated user data
        res.json(updatedUser);
    } catch (error) {
        console.error('Error updating user:', error); // Log any error that occurs during user update
        res.status(500).json({ error: error.message }); // Respond with 500 Internal Server Error
    }
};

// Define the routes for user management
router.post('/', createUser); // Route for creating a new user (registration)
router.get('/', authToken, getUser); // Route for fetching the authenticated user's data (requires authentication)
router.put('/', authToken, updateUser); // Route for updating the authenticated user's data (requires authentication)
router.post('/role', authToken, updateUserRole); // Route for updating a user's role (requires authentication and admin privilege)

// Export the router so it can be used in the main application
export default router;
