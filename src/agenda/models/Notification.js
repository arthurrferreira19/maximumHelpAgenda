const mongoose = require("mongoose");
const { getAgendaConn } = require("../../config/db");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, required: true, index: true },
    title: { type: String, default: "", trim: true },
    message: { type: String, default: "", trim: true },

    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", default: null, index: true },
    reminderMinutes: { type: Number, default: undefined },

    meta: { type: Object, default: {} },

    isRead: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

notificationSchema.index(
  { userId: 1, type: 1, eventId: 1, reminderMinutes: 1 },
  { unique: true, sparse: true }
);

module.exports = () => {
  const conn = getAgendaConn();
  return conn.models.Notification || conn.model("Notification", notificationSchema);
};
