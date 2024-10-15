import express from 'express'; // Importing Express for building the API
import bcrypt from 'bcrypt'; // Importing bcrypt for hashing passwords
import jwt from 'jsonwebtoken'; // Importing jsonwebtoken for creating and verifying tokens
import { PrismaClient } from '@prisma/client'; // Importing PrismaClient to interact with the database
import dotenv from 'dotenv'; // Importing dotenv to load environment variables

// Load environment variables from .env file
dotenv.config();
const prisma = new PrismaClient(); // Create a new instance of PrismaClient to access the database
const router = express.Router(); // Create a new Express router for handling routes

// Middleware to authenticate a user based on the provided token
export const authToken = async (req, res, next) => {
    const authHeader = req.headers['authorization']; // Get the 'Authorization' header
    const token = authHeader && authHeader.split(' ')[1]; // Extract the token from the header

    if (!token) {
        console.log('No token provided');
        return res.sendStatus(401); // No token, return 401 Unauthorized
    }
    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET); // Verify token using the secret
        console.log('Decoded token:', decoded); // Log decoded token for debugging

        // Look up the user in the database using the decoded userId from the token
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user) {
            console.log('User not found');
            return res.sendStatus(403); // User not found, return 403 Forbidden
        }

        // Attach the user's data (id, name, email, role) to req.user for access in future requests
        req.user = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: decoded.role, // Include role from decoded token
        };
        console.log('User authenticated:', req.user); // Log the authenticated user details
        next(); // Proceed to the next middleware
    } catch (error) {
        console.error('Error verifying token', error); // Log token verification errors
        res.sendStatus(403); // Return 403 Forbidden if token verification fails
    }
};

// Middleware to check if the user has admin privileges
export const isAdmin = (req, res, next) => {
    console.log('Checking admin access for user:', req.user); // Log the user being checked
    if (req.user && req.user.role === 'ADMIN') {
        next(); // Proceed if the user is an admin
    } else {
        res.status(403).json({ error: 'Admin Access Required' }); // Send a 403 Forbidden response if not an admin
    }
};

// Endpoint for user registration
const register = async (req, res) => {
    console.log('Request Body', req.body); // Log the request body for debugging
    const { email, password, name, role } = req.body; // Destructure fields from the request body

    // Check if required fields are present
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields' }); // Send a 400 Bad Request response if fields are missing
    }
    try {
        // Hash the password before storing it in the database
        const hashedPassword = await bcrypt.hash(password, 10);
        // Create a new user in the database with the provided data
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role: role || 'USER', // Default role is 'USER' if not provided
            },
        });
        // Create a token for the newly registered user
        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: '1h', // Token will expire in 1 hour
        });
        res.status(201).json({ token }); // Send the token back to the client with a 201 Created response
    } catch (error) {
        console.error('Error during registration', error); // Log the error
        res.status(500).json({ error: 'Registration Failed' }); // Send a 500 Internal Server Error response
    }
};

// Endpoint for user login
const login = async (req, res) => {
    const { email, password } = req.body; // Extract email and password from the request body
    try {
        // Find the user by email in the database
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user) return res.status(401).json({ error: 'Invalid email or password' }); // Return 401 if no user is found

        // Compare the provided password with the stored hashed password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) return res.status(401).json({ error: 'Invalid email or password' }); // Return 401 if password doesn't match

        // Create a token for the logged-in user
        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: '1h', // Token will expire in 1 hour
        });
        res.status(200).json({ token, role: user.role }); // Send the token and user role back to the client
    } catch (error) {
        console.error('Error during login', error); // Log the error
        res.status(500).json({ error: 'Login Failed' }); // Send a 500 Internal Server Error response
    }
};

// Endpoint for user logout (Placeholder - not implemented)
const logout = async (req, res) => {
    // Implement logout functionality
    res.sendStatus(200); // Send 200 OK status (Placeholder)
};

// Endpoint for refreshing the token (Placeholder - not implemented)
const refreshToken = async (req, res) => {
    // Implement refresh token functionality
    res.sendStatus(200); // Send 200 OK status (Placeholder)
};

// Register routes for user registration and login
router.post('/register', register); // Route for user registration
router.post('/login', login); // Route for user login
router.post('/logout', logout); // Route for user logout (Placeholder)
router.post('/refresh', refreshToken); // Route for refreshing token (Placeholder)

export default router; // Export the router for use in the main application
