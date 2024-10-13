import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './src/api/auth.js';
import profileRoutes from './src/api/profile.js';
import taskRoutes from './src/api/tasks.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'Hello from server!' });
    });


app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/tasks', taskRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});