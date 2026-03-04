const jwt = require("jsonwebtoken");
const { HttpError } = require("../utils/httpError");
const User = require("../models/User");

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) return next(new HttpError(401, "Token ausente"));

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-senhaHash");
    if (!user || !user.ativo) return next(new HttpError(401, "Usuário inválido/inativo"));

    req.user = user;
    next();
  } catch (e) {
    return next(new HttpError(401, "Token inválido ou expirado"));
  }
}

module.exports = { authMiddleware };
