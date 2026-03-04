const router = require("express").Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { roleMiddleware } = require("../middlewares/roleMiddleware");
const { dashboardSummary } = require("../controllers/adminController");

router.get("/dashboard/summary", authMiddleware, roleMiddleware(["ADMIN"]), dashboardSummary);

module.exports = router;
