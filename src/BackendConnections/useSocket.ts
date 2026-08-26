import { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { serverURL } from "./FetchBackendServices";
import { getAccessToken } from "../utils/authStorage";

interface UseSocketReturn {
  socket: Socket | null;
  emitEvent: (eventName: string, data?: any) => void;
  onEvent: (eventName: string, callback: (...args: any[]) => void) => () => void;
  offEvent: (eventName: string, callback?: (...args: any[]) => void) => void;
  connected: boolean;
}

let sharedSocket: Socket | null = null;
let sharedUrl = "";

function resolveUrl(serverUrl?: string): string {
  return (
    serverUrl ||
    import.meta.env.VITE_API_URL ||
    serverURL ||
    "http://localhost:3000"
  );
}

function getSharedSocket(url: string): Socket {
  if (sharedSocket && sharedUrl === url) return sharedSocket;
  if (sharedSocket) {
    sharedSocket.removeAllListeners();
    sharedSocket.disconnect();
  }
  sharedUrl = url;
  sharedSocket = io(url, {
    transports: ["websocket", "polling"],
    withCredentials: true,
    auth: { token: getAccessToken() || undefined },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true,
  });
  return sharedSocket;
}

export const useSocket = (
  serverUrl = import.meta.env.VITE_API_URL,
): UseSocketReturn => {
  const url = resolveUrl(serverUrl);
  const [socket, setSocket] = useState<Socket | null>(() => getSharedSocket(url));
  const [connected, setConnected] = useState(!!sharedSocket?.connected);
  const pendingEmits = useRef<Array<{ event: string; data: any }>>([]);

  useEffect(() => {
    const instance = getSharedSocket(url);
    setSocket(instance);
    setConnected(instance.connected);

    const flush = () => {
      pendingEmits.current.forEach(({ event, data }) => instance.emit(event, data));
      pendingEmits.current = [];
    };

    const onConnect = () => {
      setConnected(true);
      flush();
    };
    const onDisconnect = () => setConnected(false);

    instance.on("connect", onConnect);
    instance.on("disconnect", onDisconnect);
    if (instance.connected) onConnect();

    return () => {
      instance.off("connect", onConnect);
      instance.off("disconnect", onDisconnect);
    };
  }, [url]);

  const emitEvent = useCallback((eventName: string, data?: any) => {
    const instance = socket || sharedSocket;
    if (instance?.connected) {
      instance.emit(eventName, data);
    } else {
      pendingEmits.current.push({ event: eventName, data });
    }
  }, [socket]);

  const onEvent = useCallback(
    (eventName: string, callback: (...args: any[]) => void) => {
      const instance = socket || sharedSocket;
      if (!instance) return () => {};
      instance.on(eventName, callback);
      return () => {
        instance.off(eventName, callback);
      };
    },
    [socket],
  );

  const offEvent = useCallback(
    (eventName: string, callback?: (...args: any[]) => void) => {
      const instance = socket || sharedSocket;
      if (!instance) return;
      if (callback) instance.off(eventName, callback);
      else instance.removeAllListeners(eventName);
    },
    [socket],
  );

  return {
    socket,
    emitEvent,
    onEvent,
    offEvent,
    connected,
  };
};
