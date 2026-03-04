const EventModel = require("../models/Event");
const RoomModel = require("../models/Room");
const { createForUsers } = require("./notificationsController");
const User = require("../../models/User");

function pickEvent(e) {
  return {
    id: e._id,
    title: e.title,
    description: e.description,
    start: e.start,
    end: e.end,
    eventType: e.eventType,
    roomId: e.roomId,
    clientAddress: e.clientAddress,
    meetLink: e.meetLink,
    participants: e.participants || [],
    participantStatus: e.participantStatus || [],
    createdBy: e.createdBy,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt
  };
}

function isValidDate(d) {
  const dt = new Date(d);
  return Number.isFinite(dt.getTime());
}

function genMeetLikeLink() {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const rand = (n) => Array.from({ length: n }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  return `https://meet.google.com/${rand(3)}-${rand(4)}-${rand(3)}`;
}

function uniqStrings(arr) {
  return Array.from(new Set((arr || []).map((x) => String(x))));
}

function fmtISO(dt) {
  return new Date(dt).toISOString();
}

/**
 * Conflito de participantes:
 * procura eventos que intersectam [start,end] e que o usuário está como participante OU criador.
 * retorna lista de conflitos: { userId, eventId, title, start, end }
 */
async function findMemberConflicts({ start, end, memberIds, excludeEventId = null }) {
  const Event = EventModel();
  const ids = uniqStrings(memberIds);
  if (!ids.length) return [];

  const q = {
    start: { $lt: end },
    end: { $gt: start },
    $or: [
      { "participants.userId": { $in: ids } },
      { "createdBy.userId": { $in: ids } }
    ]
  };
  if (excludeEventId) q._id = { $ne: excludeEventId };

  const events = await Event.find(q)
    .select("title start end participants createdBy")
    .lean();

  const conflicts = [];
  for (const ev of events) {
    const involved = uniqStrings([
      ...(ev.participants || []).map((p) => String(p.userId)),
      String(ev.createdBy?.userId)
    ]);

    for (const mid of ids) {
      if (involved.includes(String(mid))) {
        conflicts.push({
          userId: String(mid),
          eventId: String(ev._id),
          title: ev.title,
          start: fmtISO(ev.start),
          end: fmtISO(ev.end)
        });
      }
    }
  }

  // remove duplicados (mesmo userId + eventId)
  const key = (c) => `${c.userId}::${c.eventId}`;
  const seen = new Set();
  return conflicts.filter((c) => {
    const k = key(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function listEvents(req, res) {
  const Event = EventModel();
  const { from, to } = req.query;

  if (!from || !to || !isValidDate(from) || !isValidDate(to)) {
    return res.status(400).json({ message: "Informe from e to válidos (ISO)." });
  }

  const fromDt = new Date(from);
  const toDt = new Date(to);

  const baseQuery = {
    start: { $lt: toDt },
    end: { $gt: fromDt }
  };

  // Visibilidade: qualquer usuário autenticado vê tudo no intervalo
  const events = await Event.find(baseQuery).sort({ start: 1 });
  res.json({ events: events.map(pickEvent) });
}

/**
 * Recebe participants: [userId,...]
 * Salva snapshot (id+nome+email) no evento.
 */
async function createEvent(req, res) {
  const Event = EventModel();
  const Room = RoomModel();

  const {
    title,
    description,
    start,
    end,
    eventType,
    roomId,
    clientAddress,
    participants,
    confirmConflicts
  } = req.body;

  if (!title || !start || !end || !eventType) {
    return res.status(400).json({ message: "Informe título, start, end e tipo." });
  }
  if (!isValidDate(start) || !isValidDate(end)) return res.status(400).json({ message: "Datas inválidas." });

  const s = new Date(start);
  const e = new Date(end);
  if (e <= s) return res.status(400).json({ message: "Fim precisa ser maior que início." });

  const createdByUser = req.user;
  if (!createdByUser?._id) return res.status(401).json({ message: "Sessão inválida." });

  const type = String(eventType).toUpperCase();
  if (!["MAXIMUM", "PRESENCIAL", "ONLINE"].includes(type)) return res.status(400).json({ message: "Tipo inválido." });

  const partIds = Array.isArray(participants) ? uniqStrings(participants) : [];
  const uniquePartIds = partIds.filter((pid) => pid && pid !== String(createdByUser._id));

  // lookup snapshots (main DB)
  const partUsers = await User.find({ _id: { $in: uniquePartIds }, ativo: true }).select("nome email").lean();
  const partSnaps = partUsers.map((u) => ({ userId: u._id, name: u.nome, email: u.email }));

  // conflito de participantes (inclui o criador também)
  const memberIdsToCheck = uniqStrings([String(createdByUser._id), ...uniquePartIds]);
  const memberConflicts = await findMemberConflicts({ start: s, end: e, memberIds: memberIdsToCheck });
  if (memberConflicts.length && !confirmConflicts) {
    return res.status(409).json({ message: "Um ou mais participantes já possuem evento neste horário.", memberConflicts });
  }

  let finalRoomId = null;
  let finalAddress = "";
  let finalMeet = "";
  let finalDesc = String(description || "").trim();

  if (type === "MAXIMUM") {
    if (!roomId) return res.status(400).json({ message: "Selecione uma sala (Maximum)." });

    const room = await Room.findById(roomId).select("isActive");
    if (!room) return res.status(404).json({ message: "Sala não encontrada." });
    if (!room.isActive) return res.status(400).json({ message: "Sala desativada." });

    const conflict = await Event.findOne({
      roomId: roomId,
      start: { $lt: e },
      end: { $gt: s }
    }).select("title start end");

    if (conflict && !confirmConflicts) {
      return res.status(409).json({
        message: "Sala ocupada neste intervalo.",
        conflict: { title: conflict.title, start: conflict.start, end: conflict.end }
      });
    }

    finalRoomId = roomId;
  }

  if (type === "PRESENCIAL") {
    if (!clientAddress || !String(clientAddress).trim()) {
      return res.status(400).json({ message: "Informe o endereço do cliente (Presencial)." });
    }
    finalAddress = String(clientAddress).trim();
  }

  if (type === "ONLINE") {
    finalMeet = genMeetLikeLink();
    finalDesc = finalDesc ? `${finalDesc}\n\nLink da reunião: ${finalMeet}` : `Link da reunião: ${finalMeet}`;
  }

  const createdSnap = { userId: createdByUser._id, name: createdByUser.nome, email: createdByUser.email };

  const participantStatus = [
    { userId: createdByUser._id, name: createdByUser.nome, email: createdByUser.email, status: "ACCEPTED", respondedAt: new Date() },
    ...partSnaps.map((p) => ({ userId: p.userId, name: p.name, email: p.email, status: "PENDING", respondedAt: null }))
  ];

  const ev = await Event.create({
    title: String(title).trim(),
    description: finalDesc,
    start: s,
    end: e,
    eventType: type,
    roomId: finalRoomId,
    clientAddress: finalAddress,
    meetLink: finalMeet,
    participants: partSnaps,
    participantStatus,
    createdBy: createdSnap,
    history: [{
      userId: createdByUser._id, name: createdByUser.nome, email: createdByUser.email,
      action: "CREATE",
      changes: {}
    }]
  });

  // 🔔 Notificações (criador + participantes)
  {
    const targets = uniqStrings([String(createdByUser._id), ...partSnaps.map((p) => String(p.userId))]);
    await createForUsers({
      userIds: targets,
      type: "EVENT_CREATED",
      title: "Novo evento criado",
      message: `“${String(ev.title)}” foi agendado.`,
      eventId: ev._id,
      meta: { start: ev.start, end: ev.end, eventType: ev.eventType }
    });
  }

  res.status(201).json({ event: pickEvent(ev) });
}

async function updateEvent(req, res) {
  const Event = EventModel();
  const Room = RoomModel();
  const { id } = req.params;

  const {
    title,
    description,
    start,
    end,
    eventType,
    roomId,
    clientAddress,
    participants,
    confirmConflicts
  } = req.body;

  const ev = await Event.findById(id);
  if (!ev) return res.status(404).json({ message: "Evento não encontrado." });

  const isAdmin = req.user?.role === "ADMIN";
  const isOwner = String(ev.createdBy?.userId) === String(req.user?._id);
  if (!isAdmin && !isOwner) return res.status(403).json({ message: "Sem permissão." });

  const before = {
    title: ev.title,
    start: ev.start,
    end: ev.end,
    eventType: ev.eventType,
    roomId: ev.roomId ? String(ev.roomId) : null,
    participants: (ev.participants || []).map((p) => String(p.userId))
  };

  if (title !== undefined) ev.title = String(title).trim();
  if (description !== undefined) ev.description = String(description || "").trim();

  if (start !== undefined) {
    if (!isValidDate(start)) return res.status(400).json({ message: "start inválido." });
    ev.start = new Date(start);
  }
  if (end !== undefined) {
    if (!isValidDate(end)) return res.status(400).json({ message: "end inválido." });
    ev.end = new Date(end);
  }
  if (ev.end <= ev.start) return res.status(400).json({ message: "Fim precisa ser maior que início." });

  if (eventType !== undefined) {
    const type = String(eventType).toUpperCase();
    if (!["MAXIMUM", "PRESENCIAL", "ONLINE"].includes(type)) return res.status(400).json({ message: "Tipo inválido." });
    ev.eventType = type;
  }

  if (participants !== undefined) {
    const ids = Array.isArray(participants) ? uniqStrings(participants) : [];
    const unique = ids.filter((pid) => pid && pid !== String(ev.createdBy?.userId));
    const partUsers = await User.find({ _id: { $in: unique }, ativo: true }).select("nome email").lean();
    ev.participants = partUsers.map((u) => ({ userId: u._id, name: u.nome, email: u.email }));

    // mantém status existentes quando possível
    const statusById = new Map((ev.participantStatus || []).map((s) => [String(s.userId), s]));
    const nextStatus = [];

    // criador
    const creator = statusById.get(String(ev.createdBy.userId)) || {
      userId: ev.createdBy.userId,
      name: ev.createdBy.name,
      email: ev.createdBy.email,
      status: "ACCEPTED",
      respondedAt: new Date()
    };
    creator.status = "ACCEPTED";
    nextStatus.push(creator);

    for (const p of ev.participants) {
      const prev = statusById.get(String(p.userId));
      nextStatus.push(prev ? { ...prev.toObject?.() ?? prev, name: p.name, email: p.email } : { ...p, status: "PENDING", respondedAt: null });
    }
    ev.participantStatus = nextStatus;
  }

  // conflito de participantes (ignora o próprio evento)
  {
    const memberIdsToCheck = uniqStrings([
      String(ev.createdBy?.userId),
      ...(ev.participants || []).map((p) => String(p.userId))
    ]);
    const memberConflicts = await findMemberConflicts({
      start: ev.start,
      end: ev.end,
      memberIds: memberIdsToCheck,
      excludeEventId: ev._id
    });
    if (memberConflicts.length && !confirmConflicts) {
      return res.status(409).json({ message: "Um ou mais participantes já possuem evento neste horário.", memberConflicts });
    }
  }

  let finalRoomId = null;
  let finalAddress = "";
  let finalMeet = "";
  let finalDesc = String(ev.description || "").trim();

  if (ev.eventType === "MAXIMUM") {
    if (!roomId && !ev.roomId) return res.status(400).json({ message: "Selecione uma sala (Maximum)." });
    const rId = roomId || ev.roomId;
    const room = await Room.findById(rId).select("isActive");
    if (!room) return res.status(404).json({ message: "Sala não encontrada." });
    if (!room.isActive) return res.status(400).json({ message: "Sala desativada." });

    const conflict = await Event.findOne({
      _id: { $ne: ev._id },
      roomId: rId,
      start: { $lt: ev.end },
      end: { $gt: ev.start }
    }).select("title start end");

    if (conflict && !confirmConflicts) {
      return res.status(409).json({
        message: "Sala ocupada neste intervalo.",
        conflict: { title: conflict.title, start: conflict.start, end: conflict.end }
      });
    }
    finalRoomId = rId;
  }

  if (ev.eventType === "PRESENCIAL") {
    const addr = clientAddress !== undefined ? clientAddress : ev.clientAddress;
    if (!addr || !String(addr).trim()) return res.status(400).json({ message: "Informe o endereço do cliente (Presencial)." });
    finalAddress = String(addr).trim();
  }

  if (ev.eventType === "ONLINE") {
    finalMeet = ev.meetLink || genMeetLikeLink();
    finalDesc = finalDesc && !finalDesc.includes(finalMeet)
      ? `${finalDesc}\n\nLink da reunião: ${finalMeet}`
      : (finalDesc || `Link da reunião: ${finalMeet}`);
  }

  ev.roomId = finalRoomId;
  ev.clientAddress = finalAddress;
  ev.meetLink = finalMeet;
  ev.description = finalDesc;

  // history
  ev.history = ev.history || [];
  ev.history.push({
    userId: req.user._id,
    name: req.user.nome,
    email: req.user.email,
    action: "UPDATE",
    changes: { before, after: { title: ev.title, start: ev.start, end: ev.end, eventType: ev.eventType, roomId: ev.roomId ? String(ev.roomId) : null, participants: (ev.participants||[]).map(p=>String(p.userId)) } }
  });

  await ev.save();

  // 🔔 Notificações (criador + participantes)
  {
    const targets = uniqStrings([String(ev.createdBy.userId), ...(ev.participants || []).map((p) => String(p.userId))]);
    await createForUsers({
      userIds: targets,
      type: "EVENT_UPDATED",
      title: "Evento atualizado",
      message: `“${String(ev.title)}” foi atualizado.`,
      eventId: ev._id,
      meta: { start: ev.start, end: ev.end, eventType: ev.eventType }
    });
  }

  res.json({ event: pickEvent(ev) });
}

async function deleteEvent(req, res) {
  const Event = EventModel();
  const { id } = req.params;

  const ev = await Event.findById(id);
  if (!ev) return res.status(404).json({ message: "Evento não encontrado." });

  const isAdmin = req.user?.role === "ADMIN";
  const isOwner = String(ev.createdBy?.userId) === String(req.user?._id);
  if (!isAdmin && !isOwner) return res.status(403).json({ message: "Sem permissão." });

  await Event.deleteOne({ _id: id });

  // 🔔 Notificações
  {
    const targets = uniqStrings([String(ev.createdBy.userId), ...(ev.participants || []).map((p) => String(p.userId))]);
    await createForUsers({
      userIds: targets,
      type: "EVENT_DELETED",
      title: "Evento removido",
      message: `“${String(ev.title)}” foi removido.`,
      eventId: ev._id,
      meta: { start: ev.start, end: ev.end, eventType: ev.eventType }
    });
  }

  res.json({ ok: true });
}

// Invites: lista eventos onde o usuário está convidado e ainda PENDING
async function listInvites(req, res) {
  const Event = EventModel();
  const userId = String(req.user?._id);

  const events = await Event.find({
    "participantStatus.userId": userId,
    "participantStatus.status": "PENDING"
  }).sort({ start: 1 }).limit(200);

  res.json({ invites: events.map(pickEvent) });
}

async function respondInvite(req, res) {
  const Event = EventModel();
  const userId = String(req.user?._id);
  const { id } = req.params;
  const { status } = req.body;

  if (!["ACCEPTED", "DECLINED"].includes(String(status || "").toUpperCase())) {
    return res.status(400).json({ message: "Status inválido." });
  }

  const ev = await Event.findById(id);
  if (!ev) return res.status(404).json({ message: "Evento não encontrado." });

  const st = ev.participantStatus || [];
  const idx = st.findIndex((x) => String(x.userId) === userId);
  if (idx === -1) return res.status(403).json({ message: "Você não está convidado neste evento." });

  st[idx].status = String(status).toUpperCase();
  st[idx].respondedAt = new Date();
  ev.participantStatus = st;

  ev.comments = ev.comments || [];
  ev.comments.push({
    userId: req.user._id, name: req.user.nome, email: req.user.email,
    text: `Convite ${st[idx].status === "ACCEPTED" ? "aceito" : "recusado"}.`
  });

  await ev.save();

  // notifica criador
  await createForUsers({
    userIds: [String(ev.createdBy.userId)],
    type: "INVITE",
    title: "Resposta de convite",
    message: `${req.user.nome} ${st[idx].status === "ACCEPTED" ? "aceitou" : "recusou"} o convite para “${ev.title}”.`,
    eventId: ev._id,
    meta: { status: st[idx].status }
  });

  res.json({ event: pickEvent(ev) });
}

async function listComments(req, res) {
  const Event = EventModel();
  const { id } = req.params;
  const ev = await Event.findById(id).select("comments createdBy participants");
  if (!ev) return res.status(404).json({ message: "Evento não encontrado." });

  // visibilidade: criador ou participante ou admin
  const userId = String(req.user?._id);
  const isAdmin = req.user?.role === "ADMIN";
  const isOwner = String(ev.createdBy?.userId) === userId;
  const isPart = (ev.participants || []).some((p) => String(p.userId) === userId);
  if (!isAdmin && !isOwner && !isPart) return res.status(403).json({ message: "Sem permissão." });

  res.json({ comments: ev.comments || [] });
}

async function addComment(req, res) {
  const Event = EventModel();
  const { id } = req.params;
  const { text } = req.body;
  if (!text || !String(text).trim()) return res.status(400).json({ message: "Comentário vazio." });

  const ev = await Event.findById(id);
  if (!ev) return res.status(404).json({ message: "Evento não encontrado." });

  const userId = String(req.user?._id);
  const isAdmin = req.user?.role === "ADMIN";
  const isOwner = String(ev.createdBy?.userId) === userId;
  const isPart = (ev.participants || []).some((p) => String(p.userId) === userId);
  if (!isAdmin && !isOwner && !isPart) return res.status(403).json({ message: "Sem permissão." });

  ev.comments = ev.comments || [];
  ev.comments.push({ userId: req.user._id, name: req.user.nome, email: req.user.email, text: String(text).trim() });

  await ev.save();

  // notifica envolvidos
  const targets = uniqStrings([String(ev.createdBy.userId), ...(ev.participants || []).map((p) => String(p.userId))]).filter((x) => x !== userId);
  await createForUsers({
    userIds: targets,
    type: "SYSTEM",
    title: "Novo comentário",
    message: `${req.user.nome}: ${String(text).trim().slice(0, 120)}`,
    eventId: ev._id,
    meta: {}
  });

  res.json({ comments: ev.comments || [] });
}

module.exports = { listEvents, createEvent, updateEvent, deleteEvent, listInvites, respondInvite, listComments, addComment };
