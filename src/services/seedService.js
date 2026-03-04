const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function ensureAdminSeed() {
  const existing = await User.findOne({ role: "ADMIN" });
  if (existing) {
    console.log("[seed] ADMIN já existe");
    return;
  }

  const nome = process.env.ADMIN_NAME || "Administrador";
  const email = (process.env.ADMIN_EMAIL || "admin@maximumhelp.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "Admin@123";

  const senhaHash = await bcrypt.hash(password, 12);

  await User.create({
    nome,
    email,
    senhaHash,
    role: "ADMIN",
    ativo: true
  });

  console.log("[seed] ADMIN criado via env:", email);
}

module.exports = { ensureAdminSeed };
