const router = require("express").Router();
const { authMiddleware } = require("../../middlewares/authMiddleware");
const ctrl = require("../controllers/usersController");

router.use(authMiddleware);

// compat com MaximumAgenda
router.get("/members", ctrl.listUsers);

// também disponível em /api/agenda/users
router.get("/", ctrl.listUsers);

module.exports = router;
