const mongoose = require("mongoose");

const AttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true }
  },
  { _id: false }
);

const ReactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    users: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] }
  },
  { _id: false }
);

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: ["text", "ticket"], default: "text" },
    text: { type: String, default: "" },
    ticket: {
      ticketId: { type: mongoose.Schema.Types.ObjectId, ref: "Ticket", default: null },
      title: { type: String, default: "" }
    },
    attachments: { type: [AttachmentSchema], default: [] },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    reactions: { type: [ReactionSchema], default: [] }
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);
