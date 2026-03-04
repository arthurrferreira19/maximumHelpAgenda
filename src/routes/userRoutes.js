const router = require("express").Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { roleMiddleware } = require("../middlewares/roleMiddleware");
const userController = require("../controllers/userController");

// ADMIN only
router.use(authMiddleware, roleMiddleware(["ADMIN"]));

// CRUD
router.get("/", userController.list);
router.post("/", userController.create);
router.put("/:id", userController.update);
router.patch("/:id/toggle", userController.toggleActive);
router.delete("/:id", userController.remove);

module.exports = router;
