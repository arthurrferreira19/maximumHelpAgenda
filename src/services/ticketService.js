// src/services/ticketService.js
const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const Sector = require("../models/Sector");
const { HttpError } = require("../utils/httpError");
const { TICKET_STATUS, TICKET_PRIORITIES } = require("../utils/validators");

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

function idOf(v) {
  return String(v?._id || v?.id || v || "");
}

async function validateUser(id, allowedRoles = null) {
  const uid = idOf(id);
  if (!isValidId(uid)) throw new HttpError(400, "Usuário inválido");

  const u = await User.findById(uid).select("nome email role ativo setor");
  if (!u || !u.ativo) throw new HttpError(400, "Usuário não encontrado ou inativo");

  if (allowedRoles && !allowedRoles.includes(u.role)) {
    throw new HttpError(400, `Usuário deve ter role: ${allowedRoles.join(", ")}`);
  }
  return u;
}

async function validateSector(id) {
  const sid = idOf(id);
  if (!isValidId(sid)) throw new HttpError(400, "Setor inválido");

  const s = await Sector.findById(sid);
  if (!s || !s.ativo) throw new HttpError(400, "Setor não encontrado ou inativo");

  return s;
}

function validateEnums({ status, prioridade }) {
  if (status && !TICKET_STATUS.includes(status)) throw new HttpError(400, "Status inválido");
  if (prioridade && !TICKET_PRIORITIES.includes(prioridade)) throw new HttpError(400, "Prioridade inválida");
}

// Busca mais útil (título OU descrição OU solicitanteAberto)
function buildFilter(query = {}) {
  const filter = {};

  const search = String(query.search || "").trim();
  const status = String(query.status || "").trim();
  const urgente = query.urgente;
  const setor = String(query.setor || "").trim();
  const responsavel = String(query.responsavel || "").trim();

  if (search) {
    filter.$or = [
      { titulo: { $regex: search, $options: "i" } },
      { descricao: { $regex: search, $options: "i" } },
      { solicitanteAberto: { $regex: search, $options: "i" } }
    ];
  }

  if (status && TICKET_STATUS.includes(status)) filter.status = status;

  if (urgente === "true") filter.urgente = true;
  if (urgente === "false") filter.urgente = false;

  if (setor && isValidId(setor)) filter.setor = setor;
  if (responsavel && isValidId(responsavel)) filter.responsavel = responsavel;

  return filter;
}

async function list(query) {
  const filter = buildFilter(query);

  const tickets = await Ticket.find(filter)
    .populate("solicitante", "nome email role setor")
    .populate("responsavel", "nome email role setor")
    .populate("setor", "nome")
    .sort({ createdAt: -1 });

  return tickets;
}

async function getById(id) {
  const tid = idOf(id);
  if (!isValidId(tid)) throw new HttpError(400, "ID inválido");

  const t = await Ticket.findById(tid)
    .populate("solicitante", "nome email role setor")
    .populate("responsavel", "nome email role setor")
    .populate("setor", "nome")
    .populate("atualizacoes.autor", "nome email role setor");

  if (!t) throw new HttpError(404, "Chamado não encontrado");
  return t;
}

/**
 * Regra do setor:
 * - Se o responsável tiver setor definido, usa automaticamente
 * - Senão, setor deve ser enviado (e válido/ativo)
 */
async function resolveSectorByResponsavelOrPayload(responsavelId, setorId) {
  const rid = idOf(responsavelId);
  if (!rid) return null;

  // aceita USER também
  const resp = await validateUser(rid, ["ADMIN", "RESPONSAVEL", "USER"]);

  // se o usuário (responsável) tiver setor, usa automaticamente
  if (resp.setor) return idOf(resp.setor);

  // fallback
  const sid = idOf(setorId);
  if (!sid) return null;

  const sec = await validateSector(sid);
  return idOf(sec._id);
}

async function create(payload) {
  const {
    titulo,
    solicitanteAberto,
    descricao,
    prioridade,
    urgente,
    status,
    prazoDias,
    dataInicio,
    dataFim,
    solicitante,
    responsavel,
    setor,
    anexos
  } = payload || {};

  const solicitanteId = idOf(solicitante);
  const responsavelId = idOf(responsavel);

  if (!solicitanteId || !responsavelId) {
    throw new HttpError(400, "Informe solicitante e responsável");
  }

  validateEnums({ status, prioridade });

  await validateUser(solicitanteId, ["ADMIN", "USER", "RESPONSAVEL"]);
  const setorFinal = await resolveSectorByResponsavelOrPayload(responsavelId, setor);

  const prazoParsed =
    typeof prazoDias === "number" && !Number.isNaN(prazoDias)
      ? prazoDias
      : (prazoDias === null ? null : undefined);

  const ticket = await Ticket.create({
    titulo: String(titulo || "Sem título").trim(),
    solicitanteAberto: String(solicitanteAberto || "").trim(),
    descricao: String(descricao || "").trim(),
    prioridade: prioridade || "Média",
    urgente: !!urgente,
    status: status || "Pendente",
    prazoDias: prazoParsed,
    dataInicio: dataInicio ? new Date(dataInicio) : new Date(),
    dataFim: dataFim ? new Date(dataFim) : undefined,
    solicitante: solicitanteId,
    responsavel: responsavelId,
    setor: setorFinal || undefined,
    anexos: Array.isArray(anexos) ? anexos : [],
    atualizacoes: []
  });

  return getById(ticket._id);
}

async function update(id, payload) {
  const tid = idOf(id);
  if (!isValidId(tid)) throw new HttpError(400, "ID inválido");

  const ticket = await Ticket.findById(tid);
  if (!ticket) throw new HttpError(404, "Chamado não encontrado");

  const {
    titulo,
    solicitanteAberto,
    descricao,
    prioridade,
    urgente,
    status,
    prazoDias,
    dataInicio,
    dataFim,
    solicitante,
    responsavel,
    setor
  } = payload || {};

  validateEnums({ status, prioridade });

  if (titulo !== undefined) ticket.titulo = String(titulo).trim();
  if (solicitanteAberto !== undefined) ticket.solicitanteAberto = String(solicitanteAberto || "").trim();
  if (descricao !== undefined) ticket.descricao = String(descricao).trim();
  if (prioridade !== undefined) ticket.prioridade = prioridade;
  if (urgente !== undefined) ticket.urgente = !!urgente;
  if (status !== undefined) ticket.status = status;

  if (prazoDias !== undefined) {
    if (prazoDias === null) ticket.prazoDias = null;
    else if (typeof prazoDias === "number" && !Number.isNaN(prazoDias)) ticket.prazoDias = prazoDias;
  }

  if (dataInicio !== undefined) ticket.dataInicio = new Date(dataInicio);
  if (dataFim !== undefined) ticket.dataFim = new Date(dataFim);

  if (solicitante !== undefined) {
    const solicitanteId = idOf(solicitante);
    await validateUser(solicitanteId, ["ADMIN", "USER", "RESPONSAVEL"]);
    ticket.solicitante = solicitanteId;
  }

  // Se mudou responsável, setor é recalculado automaticamente
  if (responsavel !== undefined) {
    const responsavelId = idOf(responsavel);
    const setorFinal = await resolveSectorByResponsavelOrPayload(responsavelId, setor);
    ticket.responsavel = responsavelId;
    ticket.setor = setorFinal || undefined;
  } else if (setor !== undefined) {
    // se não mudou responsável, pode mudar setor manualmente
    const sec = await validateSector(setor);
    ticket.setor = idOf(sec._id);
  }

  await ticket.save();
  return getById(ticket._id);
}

async function updateStatus(id, status) {
  const tid = idOf(id);
  if (!isValidId(tid)) throw new HttpError(400, "ID inválido");

  if (!TICKET_STATUS.includes(status)) throw new HttpError(400, "Status inválido");

  const ticket = await Ticket.findById(tid);
  if (!ticket) throw new HttpError(404, "Chamado não encontrado");

  ticket.status = status;
  await ticket.save();
  return getById(ticket._id);
}

async function remove(id) {
  const tid = idOf(id);
  if (!isValidId(tid)) throw new HttpError(400, "ID inválido");

  const t = await Ticket.findById(tid);
  if (!t) throw new HttpError(404, "Chamado não encontrado");

  await Ticket.deleteOne({ _id: tid });
}

async function addUpdate(id, { autor, mensagem, anexo }) {
  const tid = idOf(id);
  if (!isValidId(tid)) throw new HttpError(400, "ID inválido");

  const autorId = idOf(autor);
  await validateUser(autorId, ["ADMIN", "USER", "RESPONSAVEL"]);

  const ticket = await Ticket.findById(tid);
  if (!ticket) throw new HttpError(404, "Chamado não encontrado");

  ticket.atualizacoes.push({
    autor: autorId,
    mensagem: String(mensagem).trim(),
    anexo: anexo ? String(anexo).trim() : null
  });

  await ticket.save();
  return getById(ticket._id);
}

async function listBySolicitante(userId, query) {
  const uid = idOf(userId);
  const filter = buildFilter(query);
  filter.solicitante = uid;

  const tickets = await Ticket.find(filter)
    .populate("solicitante", "nome email role setor")
    .populate("responsavel", "nome email role setor")
    .populate("setor", "nome")
    .sort({ createdAt: -1 });

  return tickets;
}

async function listByResponsavel(userId, query) {
  const uid = idOf(userId);
  const filter = buildFilter(query);
  filter.responsavel = uid;

  const tickets = await Ticket.find(filter)
    .populate("solicitante", "nome email role setor")
    .populate("responsavel", "nome email role setor")
    .populate("setor", "nome")
    .sort({ createdAt: -1 });

  return tickets;
}

async function addAttachments(id, anexos) {
  const tid = idOf(id);
  if (!isValidId(tid)) throw new HttpError(400, "ID inválido");

  const ticket = await Ticket.findById(tid);
  if (!ticket) throw new HttpError(404, "Chamado não encontrado");

  ticket.anexos = [...(ticket.anexos || []), ...(Array.isArray(anexos) ? anexos : [])];
  await ticket.save();

  return getById(ticket._id);
}

async function listBySector(sectorId, query) {
  const filter = buildFilter(query);

  const sid = idOf(sectorId);
  if (!isValidId(sid)) throw new HttpError(400, "Setor inválido");

  filter.setor = sid;

  const tickets = await Ticket.find(filter)
    .populate("solicitante", "nome email role setor")
    .populate("responsavel", "nome email role setor")
    .populate("setor", "nome")
    .sort({ createdAt: -1 });

  return tickets;
}

module.exports = {
  list,
  getById,
  create,
  update,
  updateStatus,
  remove,
  addUpdate,
  listBySolicitante,
  listByResponsavel,
  listBySector,
  addAttachments
};