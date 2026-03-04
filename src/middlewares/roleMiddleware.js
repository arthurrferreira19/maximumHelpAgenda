const { HttpError } = require("../utils/httpError");

function roleMiddleware(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) return next(new HttpError(401, "Não autenticado"));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new HttpError(403, "Acesso negado"));
    }
    next();
  };
}

module.exports = { roleMiddleware };
