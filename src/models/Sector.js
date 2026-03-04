const mongoose = require("mongoose");

const sectorSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, unique: true, trim: true },
    responsavel: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    ativo: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sector", sectorSchema);
