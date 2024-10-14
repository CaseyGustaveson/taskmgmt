import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import express from 'express';
import { authToken, isAdmin } from './auth.js';

dotenv.config();
const prisma = new PrismaClient();
const router = express.Router();

// Middleware to check if user is an admin
const checkAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
};

// Build filter conditions based on query parameters
const buildFilterConditions = (query) => {
  const conditions = {};

  if (query.status) {
    conditions.status = query.status;
  }

  if (query.search) {
    conditions.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
      { userId: { equals: Number(query.search) } },
      { recurring: { contains: query.search, mode: 'insensitive' } },
      { priority: { contains: query.search, mode: 'insensitive' } },
    ];

    // Handle search as date
    const searchDate = new Date(query.search);
    if (!isNaN(searchDate.getTime())) {
      conditions.OR.push(
        { dueDate: { equals: searchDate } },
        { createdAt: { equals: searchDate } },
      );
    }
  }

  return conditions;
};

// Get all tasks with filtering and pagination
const getAllTasks = async (req, res) => {
  const { sortBy = 'createdAt', order = 'asc', page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const tasks = await prisma.task.findMany({
      where: buildFilterConditions(req.query),
      orderBy: { [sortBy]: order },
      skip,
      take: Number(limit),
    });

    const totalTasks = await prisma.task.count({
      where: buildFilterConditions(req.query),
    });

    res.json({
      tasks,
      page: Number(page),
      totalPages: Math.ceil(totalTasks / Number(limit)),
      totalTasks,
    });
  } catch (error) {
    console.error('Error fetching tasks', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

// Get a single task by ID
const getTaskById = async (req, res) => {
  const { id } = req.params;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }

  try {
    const task = await prisma.task.findUnique({ where: { id: Number(id) } });
    if (task) {
      res.json(task);
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (error) {
    console.error('Error fetching task', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
};

// Create a new task
const createTask = async (req, res) => {
  const { title, userId } = req.body;

  if (!title || !userId) {
    return res.status(400).json({ error: 'Title and User ID are required' });
  }

  try {
    const newTask = await prisma.task.create({
      data: {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        createdAt: new Date(),
      },
    });
    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

// Update an existing task
const updateTask = async (req, res) => {
  const { id } = req.params;

  try {
    const existingTask = await prisma.task.findUnique({ where: { id: Number(id) } });
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updatedTask = await prisma.task.update({
      where: { id: Number(id) },
      data: { ...req.body },
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

// Delete a task
const deleteTask = async (req, res) => {
  const { id } = req.params;

  try {
    const task = await prisma.task.findUnique({ where: { id: Number(id) } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.task.delete({ where: { id: Number(id) } });
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

// Mark task as completed
const markTaskAsCompleted = async (req, res) => {
  const { id } = req.params;

  try {
    const task = await prisma.task.findUnique({ where: { id: Number(id) } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updatedTask = await prisma.task.update({
      where: { id: Number(id) },
      data: { status: 'completed' },
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error marking task as completed', error);
    res.status(500).json({ error: 'Failed to mark task as completed' });
  }
};

// Get tasks for a specific user
const getUserTasks = async (req, res) => {
  const { userId } = req.params;

  try {
    const tasks = await prisma.task.findMany({ where: { userId: Number(userId) } });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks for user', error);
    res.status(500).json({ error: 'Failed to fetch tasks for user' });
  }
};

// Route Definitions
router.use(authToken); // Apply the authToken middleware to all routes
router.get('/', getAllTasks);
router.get('/:id', getTaskById);
router.get('/user/:userId/tasks', getUserTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.patch('/:id/complete', markTaskAsCompleted);
router.delete('/:id', checkAdmin, deleteTask);

export default router;
