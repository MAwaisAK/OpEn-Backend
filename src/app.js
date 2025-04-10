// src/index.js
import 'dotenv/config';
import './clients/db';
import express from 'express';
import Boom from 'boom';
import cors from 'cors';
import limiter from './rate-limiter';
import routes from './routes';
import mongoose from 'mongoose';
import './utils/subs.js'; // Ensure correct path
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { registerSocketHandlers } from './socketHandlers/index.js';
import { registerAudioCallHandlers } from './socketHandlers/audioHandlers.js';
import { user } from './utils/users';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "https://opulententrepreneurs.business", // Allowed domain
    methods: ["GET", "POST"]
  }
});

// Register socket handlers on connection
io.on('connection', (socket) => {
  console.log('New user connected');
  registerSocketHandlers(socket, io);
  registerAudioCallHandlers(socket, io, user);

  socket.on('disconnect', () => {
    console.log('User disconnected');
    if (user) {
      io.to(user.room).emit('updateUserList', user.getUserList(user.room));
    }// Optionally, handle user removal from the Users instance here if needed.
  });
});

// Middleware
app.use(cors({
  origin: "https://opulententrepreneurs.business", // Allow only this domain
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
}));

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(process.cwd(), './uploads')));

import { Readable } from 'stream';

app.get('/proxy-download', async (req, res, next) => {
  const { fileUrl } = req.query;
  if (!fileUrl) {
    return res.status(400).json({ error: "Missing fileUrl query parameter" });
  }
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return res.status(500).json({ error: "Failed to fetch file" });
    }
    // Set the necessary CORS and content type headers.
    res.setHeader('Access-Control-Allow-Origin', 'https://opulententrepreneurs.business');
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    
    // Convert the web ReadableStream to a Node.js Readable stream.
    const nodeStream = Readable.fromWeb(response.body);
    nodeStream.pipe(res);
  } catch (error) {
    next(error);
  }
});

// API Routes
app.use(routes);

// Custom 404 Middleware
app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/socket.io/')) {
    return next(); // Let Socket.io handle its own requests
  }
  return next(Boom.notFound(`The requested route '${req.originalUrl}' does not exist.`));
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err);
  if (err.isBoom) {
    return res.status(err.output.statusCode).json(err.output.payload);
  }
  return res.status(500).json({ error: 'Internal Server Error' });
});

// MongoDB Connection with Retry Logic
const mongoURI = process.env.MONGO_URI;
let retries = 0;
const maxRetries = 5;
const retryDelay = 10000; // 10 seconds

const connectWithRetry = () => {
  mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
    .then(() => console.log('MongoDB connected successfully'))
    .catch((err) => {
      console.error('MongoDB connection failed:', err);
      if (retries < maxRetries) {
        retries += 1;
        console.log(`Retrying MongoDB connection... Attempt ${retries}/${maxRetries}`);
        setTimeout(connectWithRetry, retryDelay);
      } else {
        console.error('Max retries reached. Running without database connection.');
      }
    });
};

httpServer.listen(4000, () => console.log('Server is running on port 4000'));

// Attempt initial MongoDB connection
connectWithRetry();
