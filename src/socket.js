import { io } from 'socket.io-client';

export const initSocket = async () => {
    const options = {
        'force new connection': true,
        reconnectionAttempts: Infinity,
        timeout: 10000,
        transports: ['websocket'],
    };
    
    // Ensure backend URL is properly configured
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    
    try {
        const socket = io(backendUrl, options);
        return socket;
    } catch (err) {
        console.error("Socket connection failed:", err);
        throw err;
    }
};