const router = require("express").Router();
const { authMiddleware } = require("../../middlewares/authMiddleware");
const ctrl = require("../controllers/eventsController");

router.use(authMiddleware);

router.get("/", ctrl.listEvents);

// convites
router.get("/invites", ctrl.listInvites);
router.post("/:id/respond", ctrl.respondInvite);

// comentários
router.get("/:id/comments", ctrl.listComments);
router.post("/:id/comments", ctrl.addComment);

router.post("/", ctrl.createEvent);
router.put("/:id", ctrl.updateEvent);
router.delete("/:id", ctrl.deleteEvent);

module.exports = router;
