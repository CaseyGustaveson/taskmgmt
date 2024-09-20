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
    const authHeader = req.headers['authorization']; // Get the authorization header
    // Extract the token from the header (format: "Bearer <token>")
    const token = authHeader && authHeader.split(' ')[1]; 

    // If no token is found, send a 401 Unauthorized response
    if (!token) return res.sendStatus(401);
    try {
        // Verify the token using the secret stored in environment variables
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        // Find the user in the database using the decoded userId from the token
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId } 
        });
        // If the user does not exist, send a 403 Forbidden response
        if (!user) return res.sendStatus(403);
        
        // Attach the user to the request object for further use in the request cycle
        req.user = user;
        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        console.error('Error verifying token', error); // Log the error
        res.sendStatus(403); // Send a 403 Forbidden response if token verification fails
    }
};

// Middleware to check if the user has admin privileges
const isAdmin = (req, res, next) => {
    // Check if the user exists and has the 'ADMIN' role
    if (req.user && req.user.role === 'ADMIN') {
        next(); // Proceed if the user is an admin
    } else {
        res.sendStatus(403); // Send a 403 Forbidden response if not an admin
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
                role: role || 'USER' // Default role is 'USER' if not provided
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
    const { email, password } = req.body; // Destructure fields from the request body
    try {
        // Find the user by email
        const user = await prisma.user.findUnique({
            where: { email },
        });
        // If the user is not found, send a 401 Unauthorized response
        if (!user) return res.status(401).json({ error: 'Invalid email or password' });
        // Compare the provided password with the stored hashed password
        const passwordMatch = await bcrypt.compare(password, user.password);
        // If the password does not match, send a 401 Unauthorized response
        if (!passwordMatch) return res.status(401).json({ error: 'Invalid email or password' });

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

// Register routes for user registration and login
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refreshToken);

export default router; // Export the router for use in the main application
