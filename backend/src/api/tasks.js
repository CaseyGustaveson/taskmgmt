import { PrismaClient } from '@prisma/client'; // Importing PrismaClient to communicate with the database (PostgreSQL in this case)
import dotenv from 'dotenv'; // Importing dotenv to manage environment variables, especially for sensitive data like API keys or database credentials
import express from 'express'; // Importing Express to create routes and manage requests and responses for our REST API
import { authToken, isAdmin } from './auth.js'; // Importing custom middlewares for authentication and admin role validation

// Load environment variables from .env file into process.env (e.g., database credentials)
dotenv.config();
const prisma = new PrismaClient(); // Instantiate PrismaClient for making database queries (e.g., CRUD operations)
const router = express.Router(); // Create an Express Router to define routes related to task management

// Middleware to check if the authenticated user has an 'ADMIN' role
const checkAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') { // Check if the role of the user attached to req (by authToken middleware) is not 'ADMIN'
    return res.status(403).json({ error: 'Unauthorized' }); // Respond with a 403 Forbidden if the user is not an admin
  }
  next(); // If user is an admin, proceed to the next middleware or route handler
};

// Helper function to build dynamic filter conditions for task queries based on request parameters
const buildFilterConditions = (query) => {
  const conditions = {}; // Initialize an empty object to hold the filter conditions

  // Check if a 'status' query parameter exists, and if so, filter tasks by status (e.g., 'completed', 'pending')
  if (query.status) {
    conditions.status = query.status;
  }

  // Check if a 'search' query parameter exists, and if so, perform case-insensitive partial matches on multiple fields
  if (query.search) {
    conditions.OR = [ // Use OR to match any of the conditions below
      { title: { contains: query.search, mode: 'insensitive' } }, // Search for the term in the task's title
      { description: { contains: query.search, mode: 'insensitive' } }, // Search for the term in the task's description
      { userId: { equals: Number(query.search) } }, // Search for tasks by user ID if the search query is numeric
      { recurring: { contains: query.search, mode: 'insensitive' } }, // Search for recurring tasks with a similar name
      { priority: { contains: query.search, mode: 'insensitive' } }, // Search for tasks by priority level
    ];

    // If the search query can be parsed into a valid date, add conditions to filter by dueDate or createdAt
    const searchDate = new Date(query.search);
    if (!isNaN(searchDate.getTime())) { // Check if the query can be interpreted as a valid date
      conditions.OR.push( // Add more conditions to search for tasks created or due on this date
        { dueDate: { equals: searchDate } },
        { createdAt: { equals: searchDate } },
      );
    }
  }

  return conditions; // Return the constructed filter conditions object
};

// Route handler for fetching all tasks, with support for filtering, sorting, and pagination
const getAllTasks = async (req, res) => {
  // Extract sorting, ordering, pagination, and limit options from query parameters, with default values if not provided
  const { sortBy = 'createdAt', order = 'asc', page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit); // Calculate the number of tasks to skip, based on the page number

  try {
    // Fetch tasks from the database, applying filters, sorting, and pagination
    const tasks = await prisma.task.findMany({
      where: buildFilterConditions(req.query), // Apply the dynamically generated filter conditions
      orderBy: { [sortBy]: order }, // Sort tasks by the specified field (e.g., 'createdAt') and order (asc/desc)
      skip, // Skip a certain number of tasks for pagination (e.g., 0 for the first page)
      take: Number(limit), // Limit the number of tasks returned per page
    });

    // Count the total number of tasks that match the filters to calculate the total number of pages
    const totalTasks = await prisma.task.count({
      where: buildFilterConditions(req.query), // Apply the same filter conditions to count tasks
    });

    // Respond with the paginated tasks, total task count, and total number of pages
    res.json({
      tasks, // Array of tasks for the current page
      page: Number(page), // Current page number
      totalPages: Math.ceil(totalTasks / Number(limit)), // Total number of pages (ceil ensures partial pages count)
      totalTasks, // Total number of tasks matching the filters
    });
  } catch (error) {
    console.error('Error fetching tasks', error); // Log any error that occurs during the database query
    res.status(500).json({ error: 'Failed to fetch tasks' }); // Respond with a 500 Internal Server Error if the operation fails
  }
};

// Route handler for fetching a single task by its ID
const getTaskById = async (req, res) => {
  const { id } = req.params; // Extract the task ID from the request URL parameters

  // Validate that the ID is a number; if not, return a 400 Bad Request response
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid task ID' }); // Task ID must be a valid number
  }

  try {
    // Fetch the task with the specified ID from the database
    const task = await prisma.task.findUnique({ where: { id: Number(id) } });
    if (task) {
      res.json(task); // If task is found, return the task data
    } else {
      res.status(404).json({ error: 'Task not found' }); // If task is not found, return a 404 Not Found error
    }
  } catch (error) {
    console.error('Error fetching task', error); // Log any error that occurs during the database query
    res.status(500).json({ error: 'Failed to fetch task' }); // Respond with a 500 Internal Server Error if the operation fails
  }
};

// Route handler for creating a new task
const createTask = async (req, res) => {
  const { title, userId } = req.body; // Extract task title and userId from the request body

  // Check if required fields (title and userId) are provided; if not, return a 400 Bad Request error
  if (!title || !userId) {
    return res.status(400).json({ error: 'Title and User ID are required' }); // Both fields are mandatory
  }

  try {
    // Create a new task in the database with the provided data
    const newTask = await prisma.task.create({
      data: {
        ...req.body, // Use all data from the request body
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null, // Convert dueDate to a Date object if provided
        createdAt: new Date(), // Automatically set the createdAt field to the current date and time
      },
    });
    res.status(201).json(newTask); // Respond with the newly created task and a 201 Created status
  } catch (error) {
    console.error('Error creating task', error); // Log any error that occurs during task creation
    res.status(500).json({ error: 'Failed to create task' }); // Respond with a 500 Internal Server Error if the operation fails
  }
};

// Route handler for updating an existing task by its ID
const updateTask = async (req, res) => {
  const { id } = req.params; // Extract the task ID from the request URL parameters

  try {
    // Fetch the existing task from the database to check if it exists
    const existingTask = await prisma.task.findUnique({ where: { id: Number(id) } });
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' }); // If task doesn't exist, return a 404 Not Found error
    }

    // Update the task in the database with the new data provided in the request body
    const updatedTask = await prisma.task.update({
      where: { id: Number(id) }, // Find the task by its ID
      data: { ...req.body }, // Use all the new data from the request body for the update
    });

    res.json(updatedTask); // Respond with the updated task
  } catch (error) {
    console.error('Error updating task', error); // Log any error that occurs during task update
    res.status(500).json({ error: 'Failed to update task' }); // Respond with a 500 Internal Server Error if the operation fails
  }
};

// Route handler for deleting a task by its ID
const deleteTask = async (req, res) => {
  const { id } = req.params; // Extract the task ID from the request URL parameters

  try {
    // Fetch the task by its ID to check if it exists
    const task = await prisma.task.findUnique({ where: { id: Number(id) } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' }); // If task doesn't exist, return a 404 Not Found error
    }

    // Delete the task from the database
    await prisma.task.delete({ where: { id: Number(id) } });
    res.json({ message: 'Task deleted successfully' }); // Respond with a success message after deletion
  } catch (error) {
    console.error('Error deleting task', error); // Log any error that occurs during task deletion
    res.status(500).json({ error: 'Failed to delete task' }); // Respond with a 500 Internal Server Error if the operation fails
  }
};

// Route handler for marking a task as completed by updating its status
const markTaskAsCompleted = async (req, res) => {
  const { id } = req.params; // Extract the task ID from the request URL parameters

  try {
    // Fetch the task by its ID to check if it exists
    const task = await prisma.task.findUnique({ where: { id: Number(id) } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' }); // If task doesn't exist, return a 404 Not Found error
    }

    // Update the task's status to 'completed'
    const updatedTask = await prisma.task.update({
      where: { id: Number(id) }, // Find the task by its ID
      data: { status: 'completed' }, // Update only the status field to 'completed'
    });

    res.json(updatedTask); // Respond with the updated task
  } catch (error) {
    console.error('Error marking task as completed', error); // Log any error that occurs during the update
    res.status(500).json({ error: 'Failed to mark task as completed' }); // Respond with a 500 Internal Server Error if the operation fails
  }
};

// Route handler for fetching tasks assigned to a specific user
const getUserTasks = async (req, res) => {
  const { userId } = req.params; // Extract the user ID from the request URL parameters

  try {
    // Fetch all tasks assigned to the user with the specified user ID
    const tasks = await prisma.task.findMany({ where: { userId: Number(userId) } });
    res.json(tasks); // Respond with the list of tasks for that user
  } catch (error) {
    console.error('Error fetching tasks for user', error); // Log any error that occurs during the query
    res.status    .status(500).json({ error: 'Failed to fetch tasks for user' }); // Respond with a 500 Internal Server Error if the operation fails
  }
};

// Route Definitions
router.use(authToken); // Apply the authToken middleware to all routes in this router to ensure only authenticated users can access these routes

// Route for getting all tasks, with optional filtering, sorting, and pagination
router.get('/', getAllTasks);

// Route for getting a single task by its ID
router.get('/:id', getTaskById);

// Route for getting all tasks assigned to a specific user
router.get('/user/:userId/tasks', getUserTasks);

// Route for creating a new task
router.post('/', createTask);

// Route for updating an existing task by its ID
router.put('/:id', updateTask);

// Route for marking a task as completed by updating its status
router.patch('/:id/complete', markTaskAsCompleted);

// Route for deleting a task by its ID, accessible only to users with the 'ADMIN' role
router.delete('/:id', checkAdmin, deleteTask); // checkAdmin middleware ensures only admins can delete tasks

export default router; // Export the router to be used in the main server file

