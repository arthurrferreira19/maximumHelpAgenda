const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const authService = require("../services/authService");

const login = asyncHandler(async (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) throw new HttpError(400, "Informe e-mail e senha");

  const data = await authService.login(email, senha);
  res.json(data);
});

module.exports = { login };
