const router = require("express").Router();
const { authMiddleware } = require("../../middlewares/authMiddleware");
const ctrl = require("../controllers/notificationsController");

router.use(authMiddleware);

router.get("/", ctrl.list);
router.get("/unread-count", ctrl.unreadCount);

router.post("/mark-all-read", ctrl.markAllRead);
router.post("/:id/read", ctrl.markRead);

router.post("/reminder", ctrl.createReminder);

module.exports = router;
