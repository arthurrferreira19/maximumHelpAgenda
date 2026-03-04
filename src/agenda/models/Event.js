const mongoose = require("mongoose");
const { getAgendaConn } = require("../../config/db");

const userSnapSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" }
  },
  { _id: false }
);

const statusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    status: { type: String, enum: ["PENDING", "ACCEPTED", "DECLINED"], default: "PENDING" },
    respondedAt: { type: Date, default: null }
  },
  { _id: false }
);

const commentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    action: { type: String, required: true },
    at: { type: Date, default: Date.now },
    changes: { type: Object, default: {} }
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },

    start: { type: Date, required: true },
    end: { type: Date, required: true },

    eventType: { type: String, enum: ["MAXIMUM", "PRESENCIAL", "ONLINE"], required: true },

    roomId: { type: mongoose.Schema.Types.ObjectId, ref: "Room", default: null },

    clientAddress: { type: String, default: "", trim: true },
    meetLink: { type: String, default: "", trim: true },

    participants: { type: [userSnapSchema], default: [] },
    participantStatus: { type: [statusSchema], default: [] },

    comments: { type: [commentSchema], default: [] },
    history: { type: [historySchema], default: [] },

    createdBy: { type: userSnapSchema, required: true }
  },
  { timestamps: true }
);

eventSchema.index({ start: 1, end: 1 });
eventSchema.index({ roomId: 1, start: 1, end: 1 });
eventSchema.index({ "participants.userId": 1, start: 1, end: 1 });
eventSchema.index({ "createdBy.userId": 1, start: 1, end: 1 });

module.exports = () => {
  const conn = getAgendaConn();
  return conn.models.Event || conn.model("Event", eventSchema);
};
