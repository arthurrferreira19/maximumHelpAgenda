const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const { authMiddleware } = require("../middlewares/authMiddleware");
const ticketController = require("../controllers/ticketController");

const router = express.Router();
router.use(authMiddleware);

// uploads/tickets
const uploadDir = path.join(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"), "tickets");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = String(file.originalname || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
    const ext = path.extname(safe);
    const base = path.basename(safe, ext);
    cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}_${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB por arquivo
});

// Listar / buscar / criar
router.get("/", ticketController.list);
router.get("/:id", ticketController.getById);

// Criar chamado (suporta JSON ou multipart/form-data com files[])
router.post("/", upload.array("files", 10), ticketController.create);

// Anexar arquivos a um chamado existente
router.post("/:id/attachments", upload.array("files", 10), ticketController.addAttachments);

// Admin/Responsável/User (controlado no controller)
router.put("/:id", ticketController.update);
router.patch("/:id/status", ticketController.updateStatus);
router.delete("/:id", ticketController.remove);

// Atualizações (chat) - USER também pode, desde que seja do ticket dele
router.post("/:id/updates", ticketController.addUpdate);

module.exports = router;
