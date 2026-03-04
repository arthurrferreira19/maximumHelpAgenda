const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const userService = require("../services/userService");

const list = asyncHandler(async (req, res) => {
  const data = await userService.list(req.query);
  res.json(data);
});

const create = asyncHandler(async (req, res) => {
  const { nome, email, senha, role, setor, ativo } = req.body || {};
  if (!nome || !email || !senha || !role) throw new HttpError(400, "Informe nome, email, senha e role");
  const created = await userService.create({ nome, email, senha, role, setor, ativo });
  res.status(201).json(created);
});

const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nome, email, senha, role, setor, ativo } = req.body || {};
  if (!nome || !email || !role) throw new HttpError(400, "Informe nome, email e role");
  const updated = await userService.update(id, { nome, email, senha, role, setor, ativo });
  res.json(updated);
});

const toggleActive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await userService.toggleActive(id);
  res.json(updated);
});

const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await userService.remove(id);
  res.status(204).send();
});

module.exports = { list, create, update, toggleActive, remove };
