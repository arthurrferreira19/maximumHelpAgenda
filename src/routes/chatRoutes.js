const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { authMiddleware } = require("../middlewares/authMiddleware");
const chatController = require("../controllers/chatController");

const router = express.Router();

// uploads/chat
const uploadDir = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"), "chat");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = (file.originalname || "file")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 80);
    const stamp = Date.now() + "_" + Math.random().toString(16).slice(2);
    cb(null, `${stamp}_${safe}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 5 }
});

router.use(authMiddleware);

router.get("/me", chatController.me);
router.get("/users", chatController.users);
router.get("/tickets", chatController.tickets);

router.get("/conversations", chatController.listConversations);
router.post("/conversations", chatController.createConversation);
router.post("/conversations/:id/read", chatController.markRead);

router.get("/conversations/:id/messages", chatController.listMessages);
router.post("/conversations/:id/messages", upload.array("files", 5), chatController.sendMessage);

router.post("/messages/:id/react", chatController.react);

module.exports = router;
