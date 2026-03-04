const router = require("express").Router();
const { authMiddleware } = require("../../middlewares/authMiddleware");
const { roleMiddleware } = require("../../middlewares/roleMiddleware");
const ctrl = require("../controllers/roomsController");

router.use(authMiddleware);

router.get("/", ctrl.listRooms);
router.get("/active", ctrl.listActiveRooms);

// admin only
router.post("/", roleMiddleware(["ADMIN"]), ctrl.createRoom);
router.put("/:id", roleMiddleware(["ADMIN"]), ctrl.updateRoom);
router.post("/:id/toggle", roleMiddleware(["ADMIN"]), ctrl.toggleRoom);

module.exports = router;
