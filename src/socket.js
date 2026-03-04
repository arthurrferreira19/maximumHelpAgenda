const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const User = require("./models/User");
const Conversation = require("./models/Conversation");

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: true, credentials: true }
  });

  // Auth middleware (JWT)
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || "").replace(/^Bearer\s+/i, "");

      if (!token) return next(new Error("Token ausente"));

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub).select("-senhaHash");
      if (!user || !user.ativo) return next(new Error("Usuário inválido/inativo"));

      socket.user = user;
      next();
    } catch (e) {
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = String(socket.user._id);

    // sala do próprio usuário (para notificações diretas)
    socket.join(`user:${userId}`);

    // entrar nas conversas que o usuário participa
    try {
      const convs = await Conversation.find({ "members.user": userId }).select("_id");
      convs.forEach((c) => socket.join(`conv:${c._id}`));
    } catch (e) {
      // ignore
    }

    socket.on("chat:join", async ({ conversationId }) => {
      if (!conversationId) return;
      socket.join(`conv:${conversationId}`);
    });

    socket.on("chat:leave", async ({ conversationId }) => {
      if (!conversationId) return;
      socket.leave(`conv:${conversationId}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.IO não inicializado");
  return io;
}

module.exports = { initSocket, getIO };
