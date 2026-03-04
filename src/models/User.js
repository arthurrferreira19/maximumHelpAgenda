const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    senhaHash: { type: String, required: true },
    role: { type: String, required: true, enum: ["ADMIN", "USER", "RESPONSAVEL"] },
    setor: { type: mongoose.Schema.Types.ObjectId, ref: "Sector", default: null },
    ativo: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
