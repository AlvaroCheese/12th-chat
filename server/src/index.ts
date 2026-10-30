import Fastify from "fastify";
import { Server } from "socket.io";
import { env } from "./config/env.js";

const app = Fastify({ logger: true });
const io = new Server(app.server, { cors: { origin: true } });

app.get("/health", async () => ({ ok: true }));

io.on("connection", (socket) => {
  app.log.info({ socketId: socket.id }, "Overlay connected");
  socket.on("disconnect", () => {
    app.log.info({ socketId: socket.id }, "Overlay disconnected");
  });
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });
