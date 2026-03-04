const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Sector = require("../models/Sector");
const { HttpError } = require("../utils/httpError");

const ALLOWED = ["ADMIN", "USER", "RESPONSAVEL"];

function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

async function ensureUniqueEmail(email, ignoreId = null) {
  const e = normEmail(email);
  const exists = await User.findOne({
    email: e,
    ...(ignoreId ? { _id: { $ne: ignoreId } } : {})
  });
  if (exists) throw new HttpError(409, "Já existe um usuário com esse e-mail");
  return e;
}

async function validateRole(role) {
  if (!ALLOWED.includes(role)) throw new HttpError(400, "Role inválida");
  return role;
}

async function validateSectorIfNeeded(role, setorId) {
  if (role === "USER") {
    if (!setorId) throw new HttpError(400, "Setor é obrigatório para role USER");
    if (!mongoose.isValidObjectId(setorId)) throw new HttpError(400, "Setor inválido");
    const s = await Sector.findById(setorId);
    if (!s || !s.ativo) throw new HttpError(400, "Setor não encontrado ou inativo");
    return setorId;
  }
  // ADMIN/RESPONSAVEL: setor opcional, mas se vier precisa existir
  if (setorId) {
    if (!mongoose.isValidObjectId(setorId)) throw new HttpError(400, "Setor inválido");
    const s = await Sector.findById(setorId);
    if (!s) throw new HttpError(400, "Setor não encontrado");
    return setorId;
  }
  return null;
}

async function list(query) {
  const search = (query.search || "").trim();
  const role = (query.role || "").trim();
  const ativo = query.ativo;
  const setor = (query.setor || "").trim();

  const filter = {};
  if (search) {
    filter.$or = [
      { nome: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } }
    ];
  }
  if (role && ALLOWED.includes(role)) filter.role = role;
  if (ativo === "true") filter.ativo = true;
  if (ativo === "false") filter.ativo = false;
  if (setor && mongoose.isValidObjectId(setor)) filter.setor = setor;

  const users = await User.find(filter)
    .select("-senhaHash")
    .populate("setor", "nome ativo")
    .sort({ createdAt: -1 });

  return users;
}

async function create({ nome, email, senha, role, setor, ativo }) {
  role = await validateRole(role);
  email = await ensureUniqueEmail(email);
  const setorFinal = await validateSectorIfNeeded(role, setor);

  const senhaHash = await bcrypt.hash(String(senha), 12);

  const user = await User.create({
    nome: String(nome).trim(),
    email,
    senhaHash,
    role,
    setor: setorFinal,
    ativo: ativo !== undefined ? !!ativo : true
  });

  return User.findById(user._id).select("-senhaHash").populate("setor", "nome ativo");
}

async function update(id, { nome, email, senha, role, setor, ativo }) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "ID inválido");
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, "Usuário não encontrado");

  role = await validateRole(role);
  email = await ensureUniqueEmail(email, id);
  const setorFinal = await validateSectorIfNeeded(role, setor);

  user.nome = String(nome).trim();
  user.email = email;
  user.role = role;
  user.setor = setorFinal;

  if (ativo !== undefined) user.ativo = !!ativo;

  if (senha && String(senha).trim().length > 0) {
    user.senhaHash = await bcrypt.hash(String(senha), 12);
  }

  await user.save();
  return User.findById(user._id).select("-senhaHash").populate("setor", "nome ativo");
}

async function toggleActive(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "ID inválido");
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, "Usuário não encontrado");
  user.ativo = !user.ativo;
  await user.save();
  return User.findById(user._id).select("-senhaHash").populate("setor", "nome ativo");
}

async function remove(id) {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "ID inválido");
  const user = await User.findById(id);
  if (!user) throw new HttpError(404, "Usuário não encontrado");
  await User.deleteOne({ _id: id });
}

module.exports = { list, create, update, toggleActive, remove };
