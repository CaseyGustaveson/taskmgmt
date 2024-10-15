// Importing necessary modules
import express from 'express'; // Importing Express to handle routing and server requests
import bcrypt from 'bcrypt'; // Importing bcrypt for password hashing and comparison
import jwt from 'jsonwebtoken'; // Importing jsonwebtoken to create and verify JWT tokens
import { PrismaClient } from '@prisma/client'; // Importing PrismaClient for database interaction
import dotenv from 'dotenv'; // Importing dotenv to load environment variables from a .env file

// Load environment variables from .env file
dotenv.config();

const prisma = new PrismaClient(); // Create a new PrismaClient instance to query the database
const router = express.Router(); // Create an Express router instance to define routes

// Middleware to authenticate a user based on the provided JWT token
export const authToken = async (req, res, next) => {
    const authHeader = req.headers['authorization']; // Get the authorization header from the request
    const token = authHeader && authHeader.split(' ')[1]; // Extract the token from the authorization header (Bearer scheme)

    if (!token) {
        console.log('No token provided'); // Log when no token is provided
        return res.sendStatus(401); // Respond with 401 Unauthorized if no token is found
    }

    try {
        // Verify the JWT token using the secret stored in environment variables
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET); 
        console.log('Decoded token:', decoded); // Log the decoded token for debugging

        // Fetch the user from the database using the userId extracted from the decoded token
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId }, // Query the user by ID
        });

        if (!user) {
            console.log('User not found'); // Log when the user doesn't exist
            return res.sendStatus(403); // Respond with 403 Forbidden if user not found
        }

        // Attach the user information to the req object for future middleware or route handlers
        req.user = {
            id: user.id, // User ID
            name: user.name, // User's name
            email: user.email, // User's email
            role: decoded.role, // User's role from the decoded token
        };

        console.log('User authenticated:', req.user); // Log the authenticated user
        next(); // Call the next middleware function in the stack
    } catch (error) {
        console.error('Error verifying token', error); // Log any error that occurs during token verification
        res.sendStatus(403); // Respond with 403 Forbidden if token verification fails
    }
};

// Middleware to check if the authenticated user has admin privileges
export const isAdmin = (req, res, next) => {
    console.log('Checking admin access for user:', req.user); // Log the user details being checked for admin access
    if (req.user && req.user.role === 'ADMIN') { 
        next(); // If the user is an admin, proceed to the next middleware or route handler
    } else {
        res.status(403).json({ error: 'Admin Access Required' }); // Respond with 403 Forbidden if user is not an admin
    }
};

// Route handler for user registration
const register = async (req, res) => {
    console.log('Request Body', req.body); // Log the request body for debugging
    const { email, password, name, role } = req.body; // Destructure the registration fields from the request body

    // Check if required fields are present in the request body
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing required fields' }); // Respond with 400 Bad Request if fields are missing
    }

    try {
        // Hash the password before storing it in the database
        const hashedPassword = await bcrypt.hash(password, 10); 

        // Create a new user in the database with the provided information
        const user = await prisma.user.create({
            data: {
                email, // User's email
                password: hashedPassword, // Hashed password for security
                name, // User's name
                role: role || 'USER', // Set the role to 'USER' by default if not provided
            },
        });

        // Create a JWT token for the newly registered user
        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: '1h', // Token will expire in 1 hour
        });

        res.status(201).json({ token }); // Respond with the generated token and a 201 Created status
    } catch (error) {
        console.error('Error during registration', error); // Log any error that occurs during registration
        res.status(500).json({ error: 'Registration Failed' }); // Respond with 500 Internal Server Error if registration fails
    }
};

// Route handler for user login
const login = async (req, res) => {
    const { email, password } = req.body; // Destructure the email and password from the request body

    try {
        // Find the user in the database by their email
        const user = await prisma.user.findUnique({
            where: { email }, // Query the user by their email
        });

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' }); // Respond with 401 Unauthorized if user not found
        }

        // Compare the provided password with the stored hashed password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: 'Invalid email or password' }); // Respond with 401 Unauthorized if passwords don't match
        }

        // Create a JWT token for the logged-in user
        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: '1h', // Token will expire in 1 hour
        });

        res.status(200).json({ token, role: user.role }); // Respond with the token and user's role, along with 200 OK status
    } catch (error) {
        console.error('Error during login', error); // Log any error that occurs during login
        res.status(500).json({ error: 'Login Failed' }); // Respond with 500 Internal Server Error if login fails
    }
};

// Placeholder route handler for logging out a user (functionality can be implemented later)
const logout = async (req, res) => {
    // Implement logout functionality here (e.g., token invalidation)
    res.sendStatus(200); // Respond with 200 OK as a placeholder
};

// Placeholder route handler for refreshing a user's JWT token (functionality can be implemented later)
const refreshToken = async (req, res) => {
    // Implement refresh token functionality here (e.g., issuing a new token)
    res.sendStatus(200); // Respond with 200 OK as a placeholder
};

// Register routes for user authentication and token handling
router.post('/register', register); // Route for user registration
router.post('/login', login); // Route for user login
router.post('/logout', logout); // Route for logging out a user
router.post('/refresh', refreshToken); // Route for refreshing a token

export default router; // Export the router so it can be used in the main application
