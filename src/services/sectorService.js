const mongoose = require("mongoose");
const Sector = require("../models/Sector");
const User = require("../models/User");
const { HttpError } = require("../utils/httpError");

function normalizeName(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

async function list(query) {
  const search = (query.search || "").trim();
  const ativo = query.ativo;

  const filter = {};
  if (search) filter.nome = { $regex: search, $options: "i" };
  if (ativo === "true") filter.ativo = true;
  if (ativo === "false") filter.ativo = false;

  const sectors = await Sector.find(filter)
    .populate("responsavel", "nome email role ativo")
    .sort({ createdAt: -1 });

  return sectors;
}

async function ensureUniqueName(nome, ignoreId = null) {
  const n = normalizeName(nome);
  const exists = await Sector.findOne({
    nome: n,
    ...(ignoreId ? { _id: { $ne: ignoreId } } : {})
  });
  if (exists) throw new HttpError(409, "Já existe um setor com esse nome");
  return n;
}

async function validateResponsavel(userId) {
  if (!mongoose.isValidObjectId(userId)) throw new HttpError(400, "Responsável inválido");
  const u = await User.findById(userId).select("role ativo nome email");
  if (!u || !u.ativo) throw new HttpError(400, "Responsável não encontrado ou inativo");
  if (!["RESPONSAVEL", "ADMIN"].includes(u.role)) {
    throw new HttpError(400, "Responsável deve ter role RESPONSAVEL ou ADMIN");
  }
  return u;
}

async function create({ nome, responsavel, ativo }) {
  const normalized = await ensureUniqueName(nome);
  await validateResponsavel(responsavel);

  const sector = await Sector.create({
    nome: normalized,
    responsavel,
    ativo: ativo !== undefined ? !!ativo : true
  });

  return Sector.findById(sector._id).populate("responsavel", "nome email role ativo");
}

async function update(id, { nome, responsavel, ativo }) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "ID inválido");
  const sector = await Sector.findById(id);
  if (!sector) throw new HttpError(404, "Setor não encontrado");

  const normalized = await ensureUniqueName(nome, id);
  await validateResponsavel(responsavel);

  sector.nome = normalized;
  sector.responsavel = responsavel;
  if (ativo !== undefined) sector.ativo = !!ativo;

  await sector.save();
  return Sector.findById(sector._id).populate("responsavel", "nome email role ativo");
}

async function toggleActive(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "ID inválido");
  const sector = await Sector.findById(id);
  if (!sector) throw new HttpError(404, "Setor não encontrado");
  sector.ativo = !sector.ativo;
  await sector.save();
  return Sector.findById(sector._id).populate("responsavel", "nome email role ativo");
}

async function remove(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "ID inválido");
  const sector = await Sector.findById(id);
  if (!sector) throw new HttpError(404, "Setor não encontrado");
  await Sector.deleteOne({ _id: id });
}

async function listResponsaveisOptions() {
  const users = await User.find({
    ativo: true,
    role: { $in: ["ADMIN", "RESPONSAVEL"] }
  })
    .select("nome email role")
    .sort({ nome: 1 });

  return users.map((u) => ({
    id: u._id,
    nome: u.nome,
    email: u.email,
    role: u.role
  }));
}

module.exports = {
  list,
  create,
  update,
  toggleActive,
  remove,
  listResponsaveisOptions
};
