const router = require("express").Router();
const { authMiddleware } = require("../../middlewares/authMiddleware");
const ctrl = require("../controllers/holidaysController");

router.use(authMiddleware);
router.get("/:year", ctrl.listHolidays);

module.exports = router;
