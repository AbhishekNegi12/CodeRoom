import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import path from 'path';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import ACTIONS from './src/Actions.js';
import cors from 'cors';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure CORS for both Express and Socket.IO
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
};

app.use(cors(corsOptions));

// Socket.IO Server with proper CORS configuration
const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'], // Fallback to polling if needed
  pingTimeout: 60000, // Increase timeout for debugging
  pingInterval: 25000
});

// Define __filename and __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.render('index', { title: 'Real-time Code Editor' });
});

// Socket.IO Logic
const userSocketMap = {};

function getAllConnectedClients(roomId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? Array.from(room).map(socketId => ({
    socketId,
    username: userSocketMap[socketId]
  })) : [];
}

io.on('connection', (socket) => {
  console.log('✅ Socket connected:', socket.id);

  // Handle connection errors
  socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
  });

  socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
    try {
      if (!roomId || !username) {
        throw new Error('Room ID and username are required');
      }

      userSocketMap[socket.id] = username;
      socket.join(roomId);

      const clients = getAllConnectedClients(roomId);
      clients.forEach(({ socketId }) => {
        io.to(socketId).emit(ACTIONS.JOINED, {
          clients,
          username,
          socketId: socket.id
        });
      });
    } catch (error) {
      console.error('JOIN error:', error.message);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on(ACTIONS.CODE_CHANGE, ({ roomId, code }) => {
    socket.to(roomId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on(ACTIONS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(ACTIONS.CODE_CHANGE, { code });
  });

  socket.on('disconnecting', () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.to(roomId).emit(ACTIONS.DISCONNECTED, {
        socketId: socket.id,
        username: userSocketMap[socket.id]
      });
    });
    delete userSocketMap[socket.id];
    console.log(`🚪 Socket disconnected: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Server listening
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running at http://localhost:${PORT}`);
  console.log(`⚡ Socket.IO is running on port ${PORT}`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('Server error:', error);
});