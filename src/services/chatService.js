const path = require("path");

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const Ticket = require("../models/Ticket");
const { HttpError } = require("../utils/httpError");

function isMember(conversation, userId) {
  return conversation.members.some((m) => String(m.user) === String(userId));
}

async function listUsers(search = "", limit = 30) {
  const q = search.trim();
  const filter = q
    ? {
        ativo: true,
        $or: [
          { nome: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } }
        ]
      }
    : { ativo: true };

  const users = await User.find(filter)
    .select("_id nome email role setorId")
    .sort({ nome: 1 })
    .limit(Math.min(limit, 100));
  return users;
}

async function createOrGetDirectConversation(meId, otherUserId) {
  const a = String(meId);
  const b = String(otherUserId);
  if (a === b) throw new HttpError(400, "Conversa direta exige outro usuário");

  // direct conv is uniquely identified by the two members
  const existing = await Conversation.findOne({
    type: "direct",
    members: {
      $all: [
        { $elemMatch: { user: a } },
        { $elemMatch: { user: b } }
      ]
    }
  });
  if (existing) return existing;

  const conv = await Conversation.create({
    type: "direct",
    name: "",
    createdBy: meId,
    members: [
      { user: meId, role: "OWNER", lastReadAt: new Date() },
      { user: otherUserId, role: "MEMBER", lastReadAt: null }
    ]
  });
  return conv;
}

async function createGroupConversation(meId, name, memberIds) {
  const uniq = Array.from(new Set([String(meId), ...(memberIds || []).map(String)]));
  if (uniq.length < 3) throw new HttpError(400, "Grupo precisa de no mínimo 3 pessoas");

  const conv = await Conversation.create({
    type: "group",
    name: (name || "Novo Grupo").trim().slice(0, 60),
    createdBy: meId,
    members: uniq.map((id) => ({
      user: id,
      role: String(id) === String(meId) ? "OWNER" : "MEMBER",
      lastReadAt: String(id) === String(meId) ? new Date() : null
    }))
  });
  return conv;
}

async function listConversations(meId) {
  const convs = await Conversation.find({ "members.user": meId })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .lean();

  const convIds = convs.map((c) => c._id);
  const lastMsgs = await Message.aggregate([
    { $match: { conversationId: { $in: convIds } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$conversationId",
        last: { $first: "$ROOT" }
      }
    }
  ]);
  const lastByConv = new Map(lastMsgs.map((x) => [String(x._id), x.last]));

  // unread = messages after lastReadAt
  const enriched = await Promise.all(
    convs.map(async (c) => {
      const meMember = c.members.find((m) => String(m.user) === String(meId));
      const lastReadAt = meMember?.lastReadAt || null;

      const unread = await Message.countDocuments({
        conversationId: c._id,
        createdAt: lastReadAt ? { $gt: lastReadAt } : { $exists: true },
        senderId: { $ne: meId }
      });

      const last = lastByConv.get(String(c._id));
      return {
        _id: c._id,
        type: c.type,
        name: c.name,
        members: c.members,
        lastMessageAt: c.lastMessageAt,
        unread,
        lastMessage: last
          ? {
              _id: last._id,
              text: last.text,
              senderId: last.senderId,
              createdAt: last.createdAt,
              attachmentsCount: (last.attachments || []).length
            }
          : null
      };
    })
  );

  return enriched;
}

async function getConversationOrThrow(conversationId, meId) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw new HttpError(404, "Conversa não encontrada");
  if (!isMember(conv, meId)) throw new HttpError(403, "Sem acesso a esta conversa");
  return conv;
}

async function listMessages(conversationId, meId, beforeISO, limit = 40) {
  await getConversationOrThrow(conversationId, meId);

  const before = beforeISO ? new Date(beforeISO) : null;
  const query = { conversationId };
  if (before && !isNaN(before.getTime())) query.createdAt = { $lt: before };

  const msgs = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 100))
    .populate("senderId", "_id nome email role")
    .populate("replyTo", "_id text senderId createdAt")
    .lean();

  return msgs.reverse();
}

async function markRead(conversationId, meId) {
  const conv = await getConversationOrThrow(conversationId, meId);
  const idx = conv.members.findIndex((m) => String(m.user) === String(meId));
  if (idx >= 0) {
    conv.members[idx].lastReadAt = new Date();
    await conv.save();
  }
  return true;
}

async function sendMessage({ conversationId, meId, text, files = [], replyTo = null, baseUrl, ticketId = null, ticketTitle = "" }) {
  const conv = await getConversationOrThrow(conversationId, meId);

  const attachments = (files || []).map((f) => {
    const rel = f.path.split(path.sep).slice(-3).join("/"); // uploads/chat/<file>
    return {
      url: `${baseUrl}/uploads/${rel.replace(/^uploads\//, "")}`,
      originalName: f.originalname,
      mimeType: f.mimetype,
      size: f.size
    };
  });

  let kind = "text";
  let ticketPayload = { ticketId: null, title: "" };

  if (ticketId) {
    const t = await Ticket.findById(ticketId).select("_id titulo solicitante responsavel").lean();
    if (!t) throw new HttpError(404, "Chamado não encontrado");
    kind = "ticket";
    ticketPayload = { ticketId: t._id, title: (ticketTitle || t.titulo || "Chamado").slice(0, 120) };
  }

  const msg = await Message.create({
    conversationId,
    senderId: meId,
    kind,
    text: (text || "").trim(),
    ticket: ticketPayload,
    attachments,
    replyTo: replyTo || null
  });

  conv.lastMessageAt = msg.createdAt;
  await conv.save();

  return await Message.findById(msg._id)
    .populate("senderId", "_id nome email role")
    .populate("replyTo", "_id text senderId createdAt")
    .lean();
}

async function searchTickets({ me, search = "", scope = "mine", limit = 20 }) {
  const q = (search || "").trim();
  const like = q ? { $regex: q, $options: "i" } : null;

  const filter = {};
  if (like) {
    filter.$or = [{ titulo: like }, { status: like }, { prioridade: like }];
  }

  const isAdmin = String(me.role) === "ADMIN";
  if (!(isAdmin && scope === "all")) {
    filter.$or = (filter.$or || []).concat([
      { solicitante: me._id },
      { responsavel: me._id }
    ]);
  }

  const tickets = await Ticket.find(filter)
    .select("_id titulo status prioridade setor")
    .populate("setor", "_id nome")
    .sort({ updatedAt: -1 })
    .limit(Math.min(limit, 50))
    .lean();

  return tickets.map((t) => ({
    _id: t._id,
    titulo: t.titulo,
    status: t.status,
    prioridade: t.prioridade,
    setorNome: t.setor?.nome || ""
  }));
}

async function reactToMessage({ messageId, meId, emoji, action }) {
  const msg = await Message.findById(messageId);
  if (!msg) throw new HttpError(404, "Mensagem não encontrada");

  const conv = await Conversation.findById(msg.conversationId);
  if (!conv) throw new HttpError(404, "Conversa não encontrada");
  if (!isMember(conv, meId)) throw new HttpError(403, "Sem acesso");

  const e = (emoji || "").trim();
  if (!e) throw new HttpError(400, "Emoji inválido");

  const idx = (msg.reactions || []).findIndex((r) => r.emoji === e);
  if (idx === -1) {
    if (action === "remove") return msg;
    msg.reactions.push({ emoji: e, users: [meId] });
  } else {
    const users = msg.reactions[idx].users.map(String);
    const has = users.includes(String(meId));
    if (action === "remove") {
      if (has) msg.reactions[idx].users = msg.reactions[idx].users.filter((u) => String(u) !== String(meId));
    } else {
      if (!has) msg.reactions[idx].users.push(meId);
    }
    // cleanup empty reactions
    msg.reactions = msg.reactions.filter((r) => (r.users || []).length > 0);
  }

  await msg.save();
  return await Message.findById(msg._id).lean();
}

module.exports = {
  listUsers,
  createOrGetDirectConversation,
  createGroupConversation,
  listConversations,
  listMessages,
  sendMessage,
  markRead,
  reactToMessage,
  searchTickets
};
