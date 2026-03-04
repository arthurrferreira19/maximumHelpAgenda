const NotificationModel = require("../models/Notification");

function pick(n) {
  return {
    id: n._id,
    userId: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    eventId: n.eventId,
    reminderMinutes: n.reminderMinutes,
    meta: n.meta,
    isRead: n.isRead,
    createdAt: n.createdAt
  };
}

async function createForUsers({ userIds, type, title, message, eventId = null, reminderMinutes = undefined, meta = {} }) {
  const Notification = NotificationModel();
  const ids = Array.from(new Set((userIds || []).map(String))).filter(Boolean);
  if (!ids.length) return;

  const docs = ids.map((uid) => ({
    userId: uid,
    type,
    title,
    message,
    eventId,
    reminderMinutes,
    meta
  }));

  try {
    await Notification.insertMany(docs, { ordered: false });
  } catch (e) {
    // ignora duplicidade
  }
}

async function list(req, res) {
  const Notification = NotificationModel();
  const userId = req.user?._id;
  const { unread } = req.query;

  const q = { userId };
  if (unread === "1" || unread === "true") q.isRead = false;

  const items = await Notification.find(q).sort({ createdAt: -1 }).limit(300);
  res.json({ notifications: items.map(pick) });
}

async function unreadCount(req, res) {
  const Notification = NotificationModel();
  const userId = req.user?._id;
  const n = await Notification.countDocuments({ userId, isRead: false });
  res.json({ count: n });
}

async function markRead(req, res) {
  const Notification = NotificationModel();
  const userId = req.user?._id;
  const { id } = req.params;

  const n = await Notification.findOneAndUpdate({ _id: id, userId }, { $set: { isRead: true } }, { new: true });
  if (!n) return res.status(404).json({ message: "Notificação não encontrada." });
  res.json({ notification: pick(n) });
}

async function markAllRead(req, res) {
  const Notification = NotificationModel();
  const userId = req.user?._id;
  await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });
  res.json({ ok: true });
}

/**
 * Reminder: cria uma notificação de lembrete para um evento.
 * O front chama isso para agendar lembretes (armazenamos só no banco; cron real pode vir depois).
 */
async function createReminder(req, res) {
  const Notification = NotificationModel();
  const userId = req.user?._id;
  const { eventId, minutes } = req.body;

  if (!eventId) return res.status(400).json({ message: "eventId obrigatório." });

  const m = Number(minutes);
  if (!Number.isFinite(m) || m < 1 || m > 10080) return res.status(400).json({ message: "minutes inválido." });

  try {
    const doc = await Notification.create({
      userId,
      type: "REMINDER",
      title: "Lembrete",
      message: `Lembrete configurado para ${m} min antes do evento.`,
      eventId,
      reminderMinutes: m,
      meta: { minutes: m }
    });
    res.status(201).json({ notification: pick(doc) });
  } catch (e) {
    // se já existe (unique index), ok
    res.status(200).json({ ok: true });
  }
}

module.exports = { list, unreadCount, markRead, markAllRead, createReminder, createForUsers };
