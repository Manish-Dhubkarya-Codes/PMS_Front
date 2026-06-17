import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketReturn {
  socket: Socket | null;
  emitEvent: (eventName: string, data: any) => void;
  onEvent: (eventName: string, callback: (...args: any[]) => void) => () => void;
  offEvent: (eventName: string, callback: (...args: any[]) => void) => void;
  connected: boolean;
}

export const useSocket = (serverUrl = 'https://api.cognicodeedutech.com'): UseSocketReturn => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const callbacksRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    const socketInstance = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      setConnected(true);
      console.log('Socket connected', socketInstance.id);
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      console.log('Socket disconnected');
    });

    return () => {
      socketInstance.disconnect();
      setSocket(null);
    };
  }, [serverUrl]);

  const emitEvent = useCallback((eventName: string, data: any) => {
    if (socket && connected) {
      socket.emit(eventName, data);
    }
  }, [socket, connected]);

  const onEvent = useCallback((eventName: string, callback: (...args: any[]) => void) => {
    if (!socket) return () => {};

    // Generate unique key once per call for proper tracking
    const key = `${eventName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const wrappedCallback = (...args: any[]) => callback(...args);
    callbacksRef.current.set(key, wrappedCallback);

    socket.on(eventName, wrappedCallback);

    // Return cleanup with captured key
    return () => {
      socket.off(eventName, wrappedCallback);
      callbacksRef.current.delete(key);
      console.log(`Removed listener for ${eventName} with key ${key}`);
    };
  }, [socket]);

  const offEvent = useCallback((eventName: string, callback: (...args: any[]) => void) => {
    if (socket) {
      socket.off(eventName, callback);
      console.log(`Off event: ${eventName}`);
    }
  }, [socket]);

  return {
    socket,
    emitEvent,
    onEvent,
    offEvent,
    connected,
  };
};