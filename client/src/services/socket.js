import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(window.location.origin, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to Socket.IO server:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('⚠️ Disconnected from Socket.IO server');
    });
  }
  return socket;
};
