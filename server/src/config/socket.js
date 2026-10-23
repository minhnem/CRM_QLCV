import { Server } from 'socket.io';

let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      //  origin: (origin, callback) => callback(null, true),
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`⚡ Client connected via Socket.IO: ${socket.id}`);

    // Join user room for private notifications
    socket.on('join_user', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
      }
    });

    // Join project room for project-specific task real-time updates
    socket.on('join_project', (projectId) => {
      if (projectId) {
        socket.join(`project:${projectId}`);
      }
    });

    // Join channel room (department or project)
    socket.on('channel:join', ({ channelType, channelId }) => {
      if (channelType && channelId) {
        const room = `channel:${channelType}:${channelId}`;
        socket.join(room);
        console.log(`💬 Socket ${socket.id} joined ${room}`);
      }
    });

    socket.on('channel:leave', ({ channelType, channelId }) => {
      if (channelType && channelId) {
        const room = `channel:${channelType}:${channelId}`;
        socket.leave(room);
        console.log(`💬 Socket ${socket.id} left ${room}`);
      }
    });

    socket.on('disconnect', () => {
      // client disconnected
    });
  });

  return io;
};

export const getIO = () => {
  return io;
};

// Broadcast new chat message to channel room
export const broadcastChannelMessage = (channelType, channelId, message) => {
  if (!io) return;
  const room = `channel:${channelType}:${channelId}`;
  io.to(room).emit('message:new', message);
};

// Helper broadcast functions
export const notifyTaskUpdated = (task) => {
  if (!io) return;
  if (task.project) {
    io.to(`project:${task.project}`).emit('task:updated', task);
  }
  io.emit('task:changed', task);
};

export const notifyTaskCreated = (task) => {
  if (!io) return;
  if (task.project) {
    io.to(`project:${task.project}`).emit('task:created', task);
  }
  io.emit('task:changed', task);
};

export const notifyTaskDeleted = (taskId, projectId) => {
  if (!io) return;
  if (projectId) {
    io.to(`project:${projectId}`).emit('task:deleted', taskId);
  }
  io.emit('task:changed', { _id: taskId, deleted: true });
};
