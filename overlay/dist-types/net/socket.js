import { io } from "socket.io-client";
export function connectToServer() {
    const socket = io(import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000", {
        autoConnect: true,
    });
    socket.on("connect", () => console.info("Server connected", socket.id));
    socket.on("disconnect", (reason) => console.info("Server disconnected", reason));
    socket.on("connect_error", (error) => console.warn("Server connection error", error.message));
}
