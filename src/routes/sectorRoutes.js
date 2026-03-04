const router = require("express").Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { roleMiddleware } = require("../middlewares/roleMiddleware");
const sectorController = require("../controllers/sectorController");

// ADMIN only
router.use(authMiddleware, roleMiddleware(["ADMIN"]));

// opções de responsáveis (ADMIN + RESPONSAVEL)
router.get("/responsaveis/options", sectorController.listResponsaveisOptions);

// CRUD setores
router.get("/", sectorController.list);
router.post("/", sectorController.create);
router.put("/:id", sectorController.update);
router.patch("/:id/toggle", sectorController.toggleActive);
router.delete("/:id", sectorController.remove);

module.exports = router;
