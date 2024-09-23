import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();
const prisma = new PrismaClient();
const router = express.Router();

const checkAdmin = (req, res, next) => {
  const { role } = req.user;
  if (role !== 'ADMIN') {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
};

const getAllTasks = async (req, res) => {
  const { status, sortBy, order = 'asc', page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const orderOptions = {
    dueDate: 'dueDate',
    createdAt: 'createdAt',
    status: 'status',
  };

  try {
    const tasks = await prisma.task.findMany({
      where: status ? { status } : {},
      orderBy: {
        [orderOptions[sortBy] || 'createdAt']: order,
      },
      skip,
      take: Number(limit),
    });
    const totalTasks = await prisma.task.count();
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

// Get a task by ID
const getTaskById = async (req, res) => {
  const { id } = req.params;
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Invalid task ID' });
  }
  try {
    const task = await prisma.task.findUnique({
      where: { id: Number(id) },
    });
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
  const { title, description, dueDate, status, userId } = req.body;
  try {
    if (!title || !userId) {
      return res.status(400).json({ error: 'Title and User ID are required' });
    }

    const parsedDueDate = dueDate ? new Date(dueDate) : null;
    if (dueDate && isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({ error: 'Valid due date is required' });
    }

    const newTask = await prisma.task.create({
      data: {
        title,
        description,
        dueDate: parsedDueDate,
        status: status || 'pending',
        userId: Number(userId),
      },
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
};

// Update a task by ID
const updateTask = async (req, res) => {
  const { id } = req.params;
  const { title, description, dueDate, status } = req.body;

  try {
    const existingTask = await prisma.task.findUnique({
      where: { id: Number(id) },
    });
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updatedTask = await prisma.task.update({
      where: { id: Number(id) },
      data: {
        title: title || existingTask.title,
        description: description || existingTask.description,
        dueDate: dueDate ? new Date(dueDate) : existingTask.dueDate,
        status: status || existingTask.status,
      },
    });

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
};

// Delete a task by ID
const deleteTask = async (req, res) => {
  const { id } = req.params;
  try {
    const task = await prisma.task.findUnique({
      where: { id: Number(id) },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.task.delete({
      where: { id: Number(id) },
    });

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

// Mark a task as completed
const markTaskAsCompleted = async (req, res) => {
  const { id } = req.params;

  try {
    const task = await prisma.task.findUnique({
      where: { id: Number(id) },
    });
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
const getUserTask = async (req, res) => {
  const { userId } = req.params;
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: Number(userId) },
    });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks for user', error);
    res.status(500).json({ error: 'Failed to fetch tasks for user' });
  }
};

// Routes
router.get('/tasks', getAllTasks);
router.get('/tasks/:id', getTaskById);
router.get('/user/:userId/tasks', getUserTask);
router.post('/tasks', createTask);
router.put('/tasks/:id', updateTask);
router.patch('/tasks/:id/complete', markTaskAsCompleted);
router.delete('/tasks/:id', checkAdmin, deleteTask);

export default router;
