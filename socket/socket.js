// socket/socket.js
import { Server } from 'socket.io';

/**
 * Initializes and configures Socket.IO
 * @param {http.Server} server - Express server wrapped with http
 */
export const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        'http://localhost:5173',
        'https://vigilo.onrender.com',
        'https://vigilo.vercel.app',
      ],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on('join', (userId) => {
      socket.join(userId); // Join personal room
      console.log(`📥 User ${userId} joined room ${userId}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};
