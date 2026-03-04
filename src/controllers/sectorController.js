const { asyncHandler } = require("../utils/asyncHandler");
const sectorService = require("../services/sectorService");
const { HttpError } = require("../utils/httpError");

const list = asyncHandler(async (req, res) => {
  const data = await sectorService.list(req.query);
  res.json(data);
});

const create = asyncHandler(async (req, res) => {
  const { nome, responsavel, ativo } = req.body || {};
  if (!nome || !responsavel) throw new HttpError(400, "Informe nome e responsável");
  const created = await sectorService.create({ nome, responsavel, ativo });
  res.status(201).json(created);
});

const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { nome, responsavel, ativo } = req.body || {};
  if (!nome || !responsavel) throw new HttpError(400, "Informe nome e responsável");
  const updated = await sectorService.update(id, { nome, responsavel, ativo });
  res.json(updated);
});

const toggleActive = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await sectorService.toggleActive(id);
  res.json(updated);
});

const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await sectorService.remove(id);
  res.status(204).send();
});

const listResponsaveisOptions = asyncHandler(async (req, res) => {
  const data = await sectorService.listResponsaveisOptions();
  res.json(data);
});

module.exports = {
  list,
  create,
  update,
  toggleActive,
  remove,
  listResponsaveisOptions
};
