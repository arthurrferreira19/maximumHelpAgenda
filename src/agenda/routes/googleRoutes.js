const router = require("express").Router();
const { authMiddleware } = require("../../middlewares/authMiddleware");
const ctrl = require("../controllers/googleController");

router.use(authMiddleware);

router.get("/status", ctrl.getStatus);
router.post("/disconnect", ctrl.disconnect);

module.exports = router;
