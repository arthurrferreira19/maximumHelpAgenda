const { HttpError } = require("../utils/httpError");

function notFound(req, res, next) {
  next(new HttpError(404, `Rota não encontrada: ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const message = err.message || "Erro interno";
  if (process.env.NODE_ENV !== "test") {
    console.error("[error]", status, message);
  }
  res.status(status).json({ message });
}

module.exports = { notFound, errorHandler };
