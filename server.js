// server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Sample response on home page
app.get("/", (req, res) => {
  res.send("Real-time game backend is running");
});

// Real-time socket logic
io.on("connection", (socket) => {
  console.log(`🔌 New user connected: ${socket.id}`);

  // Sample room creation logic
  socket.on("createRoom", (playerName) => {
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    socket.join(roomCode);
    socket.emit("roomCreated", { roomCode, isHost: true });
  });

  socket.on("joinRoom", ({ roomCode, playerName }) => {
    socket.join(roomCode);
    socket.emit("roomJoined", { roomCode, isHost: false });
    socket.to(roomCode).emit("playerJoined", { playerName });
  });

  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 8081;
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
