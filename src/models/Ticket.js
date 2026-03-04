const mongoose = require("mongoose");
const { TICKET_STATUS, TICKET_PRIORITIES } = require("../utils/validators");

const attachmentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const updateSchema = new mongoose.Schema(
  {
    autor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    mensagem: { type: String, required: true, trim: true },
    // (legado) anexo simples em update (mantido por compatibilidade)
    anexo: { type: String, default: null }
  },
  { timestamps: true }
);

const ticketSchema = new mongoose.Schema(
  {
    titulo: { type: String, default: "Sem título", trim: true },
    solicitanteAberto: { type: String, default: "", trim: true }, // campo aberto (opcional)
    descricao: { type: String, default: "", trim: true },

    // Mantido (pode ser usado no admin futuramente)
    prioridade: { type: String, enum: TICKET_PRIORITIES, default: "Média" },

    status: { type: String, enum: TICKET_STATUS, default: "Pendente" },
    urgente: { type: Boolean, default: false },

    // Prazo em dias (numérico) + data fim calculável
    prazoDias: { type: Number, default: null, min: 0 },
    dataInicio: { type: Date, default: Date.now },
    dataFim: { type: Date, default: null },

    solicitante: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    responsavel: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    setor: { type: mongoose.Schema.Types.ObjectId, ref: "Sector", default: null },

    anexos: { type: [attachmentSchema], default: [] },

    atualizacoes: [updateSchema]
  },
  { timestamps: true }
);

// Atualiza dataFim automaticamente quando prazoDias muda
ticketSchema.pre("save", function (next) {
  if (this.isModified("prazoDias") || this.isModified("dataInicio")) {
    if (typeof this.prazoDias === "number" && this.prazoDias >= 0) {
      const start = this.dataInicio ? new Date(this.dataInicio) : new Date();
      const end = new Date(start);
      end.setDate(end.getDate() + this.prazoDias);
      this.dataFim = end;
    } else {
      this.dataFim = null;
    }
  }
  next();
});

module.exports = mongoose.model("Ticket", ticketSchema);
