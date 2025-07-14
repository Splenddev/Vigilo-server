import { Server } from 'socket.io';

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

    // Personal room
    socket.on('join', (userId) => {
      socket.join(userId);
      console.log(`📥 User ${userId} joined personal room`);
    });

    // Group room
    socket.on('joinGroup', (groupId) => {
      socket.join(groupId);
      console.log(`📥 Socket ${socket.id} joined group room ${groupId}`);
    });

    socket.on('leaveGroup', (groupId) => {
      socket.leave(groupId);
      console.log(`📤 Socket ${socket.id} left group room ${groupId}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};
