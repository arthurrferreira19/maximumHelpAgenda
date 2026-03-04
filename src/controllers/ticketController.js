// src/controllers/ticketController.js
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const ticketService = require("../services/ticketService");

function isAdmin(user) {
  return user?.role === "ADMIN";
}
function isUser(user) {
  return user?.role === "USER";
}
function isResponsavel(user) {
  return user?.role === "RESPONSAVEL";
}
function isStaff(user) {
  return isUser(user) || isResponsavel(user);
}

function idOf(v) {
  return String(v?._id || v?.id || v || "");
}

function filesToMeta(req) {
  const files = Array.isArray(req.files) ? req.files : [];
  return files.map((f) => ({
    originalName: f.originalname,
    filename: f.filename,
    mimetype: f.mimetype,
    size: f.size,
    url: `/uploads/tickets/${f.filename}`,
    uploadedAt: new Date(),
  }));
}

function canAccessTicket(me, ticket, { scope = "mine" } = {}) {
  if (isAdmin(me)) return true;

  const myId = idOf(me?._id);
  const sid = idOf(ticket?.solicitante);
  const rid = idOf(ticket?.responsavel);
  const mySector = idOf(me?.setor);
  const tSector = idOf(ticket?.setor);

  // mine: solicitante OU responsável
  if (scope !== "sector") return sid === myId || rid === myId;

  // sector: setor do ticket == setor do usuário
  if (!mySector) return false;
  return tSector === mySector;
}

function canManageTicket(me, ticket) {
  if (isAdmin(me)) return true;
  if (!isStaff(me)) return false;

  const myId = idOf(me?._id);
  const sid = idOf(ticket?.solicitante);
  const rid = idOf(ticket?.responsavel);

  // “mesmas coisas do user”: gerencia se for solicitante OU responsável
  return sid === myId || rid === myId;
}

const list = asyncHandler(async (req, res) => {
  const me = req.user;
  const scope = String(req.query.scope || "mine").toLowerCase(); // mine | sector

  // ADMIN: lista tudo
  if (isAdmin(me)) {
    const data = await ticketService.list(req.query);
    return res.json(data);
  }

  // USER/RESPONSAVEL
  if (!isStaff(me)) throw new HttpError(403, "Permissão insuficiente");

  // ✅ sector: ver todos do setor (colegas)
  if (scope === "sector") {
    const sectorId = idOf(me?.setor);
    if (!sectorId) throw new HttpError(400, "Seu usuário não possui setor definido");

    // garante que o service receba ID (string)
    const data = await ticketService.listBySector(sectorId, req.query);
    return res.json(data);
  }

  // ✅ mine: comportamento original
  if (isUser(me)) {
    const data = await ticketService.listBySolicitante(me._id, req.query);
    return res.json(data);
  }

  // RESPONSAVEL: lista os atribuídos a ele (mine)
  const data = await ticketService.listByResponsavel(me._id, req.query);
  return res.json(data);
});

const getById = asyncHandler(async (req, res) => {
  const me = req.user;
  const t = await ticketService.getById(req.params.id);

  // permite abrir via setor também se passar ?scope=sector
  const scope = String(req.query.scope || "mine").toLowerCase();
  if (canAccessTicket(me, t, { scope })) return res.json(t);

  throw new HttpError(403, "Você não tem acesso a esse chamado");
});

const create = asyncHandler(async (req, res) => {
  const me = req.user;

  // ADMIN, USER e RESPONSAVEL podem criar
  if (!isAdmin(me) && !isStaff(me)) {
    throw new HttpError(403, "Sem permissão para criar chamado");
  }

  // Defaults para USER/RESP (admin pode definir tudo)
  if (!isAdmin(me)) {
    req.body.solicitante = me._id;

    // ✅ MUITO IMPORTANTE:
    // - USER cria chamado como solicitante; NÃO força responsavel
    // - RESPONSAVEL pode criar já como responsável (mantém seu fluxo)
    if (isResponsavel(me) && !req.body.responsavel) {
      req.body.responsavel = me._id;
    }

    // setor automático (sempre como ID)
    const sectorId = idOf(me?.setor);
    if (sectorId && !req.body.setor) req.body.setor = sectorId;
  }

  // ticketService.create(payload) (seu service já resolve anexos via payload.anexos)
  // se você usa req.files em outra camada, mantenha a assinatura que você implementou.
  const ticket = await ticketService.create(req.body);
  res.status(201).json(ticket);
});

const update = asyncHandler(async (req, res) => {
  const me = req.user;
  const id = req.params.id;

  const ticket = await ticketService.getById(id);

  if (isAdmin(me)) {
    const updated = await ticketService.update(id, req.body);
    return res.json(updated);
  }

  if (!canManageTicket(me, ticket)) {
    throw new HttpError(403, "Você só pode editar chamados que são seus ou atribuídos a você");
  }

  // trava campos “admin-only”
  delete req.body.solicitante;
  delete req.body.responsavel;
  delete req.body.setor;

  const updated = await ticketService.update(id, req.body);
  return res.json(updated);
});

const addAttachments = asyncHandler(async (req, res) => {
  const me = req.user;
  const anexos = filesToMeta(req);
  if (!anexos.length) throw new HttpError(400, "Envie ao menos 1 arquivo");

  const t = await ticketService.getById(req.params.id);

  if (!canManageTicket(me, t)) {
    throw new HttpError(403, "Você não pode anexar arquivos nesse chamado");
  }

  const updated = await ticketService.addAttachments(req.params.id, anexos);
  res.json(updated);
});

const updateStatus = asyncHandler(async (req, res) => {
  const me = req.user;
  const { status } = req.body || {};
  if (!status) throw new HttpError(400, "Informe o status");

  const t = await ticketService.getById(req.params.id);

  // Admin pode tudo; USER/RESP: só se puder gerenciar (solicitante ou responsável)
  if (!isAdmin(me) && !canManageTicket(me, t)) {
    throw new HttpError(403, "Você não pode alterar status desse chamado");
  }

  const updated = await ticketService.updateStatus(req.params.id, status);
  res.json(updated);
});

const remove = asyncHandler(async (req, res) => {
  const me = req.user;
  if (!isAdmin(me)) throw new HttpError(403, "Somente ADMIN pode excluir chamados");
  await ticketService.remove(req.params.id);
  res.status(204).send();
});

const addUpdate = asyncHandler(async (req, res) => {
  const me = req.user;
  const { mensagem, anexo } = req.body || {};
  if (!mensagem) throw new HttpError(400, "Informe a mensagem");

  const t = await ticketService.getById(req.params.id);

  // Admin pode; USER/RESP: só se puder gerenciar (solicitante ou responsável)
  if (!isAdmin(me) && !canManageTicket(me, t)) {
    throw new HttpError(403, "Você não pode comentar nesse chamado");
  }

  const updated = await ticketService.addUpdate(req.params.id, {
    autor: me._id,
    mensagem,
    anexo: anexo || null,
  });

  return res.json(updated);
});

module.exports = {
  list,
  getById,
  create,
  addAttachments,
  update,
  updateStatus,
  remove,
  addUpdate,
};