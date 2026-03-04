const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const chatService = require("../services/chatService");
const { getIO } = require("../socket");

function baseUrlFromReq(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  return `${proto}://${host}`;
}

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

const users = asyncHandler(async (req, res) => {
  const search = req.query.search || "";
  const list = await chatService.listUsers(search);
  res.json({ users: list });
});

const tickets = asyncHandler(async (req, res) => {
  const search = req.query.search || "";
  const scope = req.query.scope || "mine";
  const list = await chatService.searchTickets({ me: req.user, search, scope, limit: 20 });
  res.json({ tickets: list });
});

const createConversation = asyncHandler(async (req, res) => {
  const { type, otherUserId, name, memberIds } = req.body || {};

  let conv;
  if (type === "direct") {
    if (!otherUserId) throw new HttpError(400, "otherUserId é obrigatório");
    conv = await chatService.createOrGetDirectConversation(req.user._id, otherUserId);
  } else if (type === "group") {
    conv = await chatService.createGroupConversation(req.user._id, name, memberIds || []);
  } else {
    throw new HttpError(400, "type inválido");
  }

  // atualizar rooms (para quem está online)
  try {
    const io = getIO();
    (conv.members || []).forEach((m) => {
      io.to(`user:${m.user}`).emit("chat:conversation_created", { conversationId: String(conv._id) });
    });
  } catch (e) {}

  res.status(201).json({ conversation: conv });
});

const listConversations = asyncHandler(async (req, res) => {
  const convs = await chatService.listConversations(req.user._id);
  res.json({ conversations: convs });
});

const listMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const before = req.query.before || null;
  const limit = Number(req.query.limit || 40);
  const msgs = await chatService.listMessages(id, req.user._id, before, limit);
  res.json({ messages: msgs });
});

const markRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await chatService.markRead(id, req.user._id);
  res.json({ ok: true });
});

const sendMessage = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text, replyTo, ticketId, ticketTitle } = req.body || {};
  const files = req.files || [];

  const msg = await chatService.sendMessage({
    conversationId: id,
    meId: req.user._id,
    text,
    files,
    replyTo,
    ticketId: ticketId || null,
    ticketTitle: ticketTitle || "",
    baseUrl: baseUrlFromReq(req)
  });

  // realtime
  try {
    const io = getIO();
    io.to(`conv:${id}`).emit("chat:new_message", { conversationId: id, message: msg });
  } catch (e) {}

  res.status(201).json({ message: msg });
});

const react = asyncHandler(async (req, res) => {
  const { id } = req.params; // messageId
  const { emoji, action } = req.body || {};
  const msg = await chatService.reactToMessage({ messageId: id, meId: req.user._id, emoji, action });

  try {
    const io = getIO();
    io.to(`conv:${msg.conversationId}`).emit("chat:message_reaction", {
      conversationId: String(msg.conversationId),
      messageId: String(msg._id),
      reactions: msg.reactions
    });
  } catch (e) {}

  res.json({ message: msg });
});

module.exports = {
  me,
  users,
  tickets,
  createConversation,
  listConversations,
  listMessages,
  sendMessage,
  markRead,
  react
};
