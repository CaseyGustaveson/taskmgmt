import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api', (req, res) => {
  res.json({ message: 'Hello from server!' });
});

app.get('/', (req, res) => { 
    res.send('Hello from server!');
    });

    app.use((err, req, res, next) => {
        console.error(err.stack);   
        res.status(500).send('Something broke!');
        });

export default app;