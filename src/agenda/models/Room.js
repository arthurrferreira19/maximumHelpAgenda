const mongoose = require("mongoose");
const { getAgendaConn } = require("../../config/db");

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    floor: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1 },
    color: { type: String, required: true, trim: true },
    features: {
      tv: { type: Boolean, default: false },
      computer: { type: Boolean, default: false },
      speakers: { type: Boolean, default: false },
      microphone: { type: Boolean, default: false },
      minibar: { type: Boolean, default: false }
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

roomSchema.pre("save", function () {
  if (this.color) this.color = String(this.color).toLowerCase();
});

module.exports = () => {
  const conn = getAgendaConn();
  return conn.models.Room || conn.model("Room", roomSchema);
};
