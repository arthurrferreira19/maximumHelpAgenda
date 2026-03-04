const mongoose = require("mongoose");

const ConversationMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["OWNER", "MEMBER"], default: "MEMBER" },
    lastReadAt: { type: Date, default: null }
  },
  { _id: false }
);

const ConversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["direct", "group"], required: true },
    name: { type: String, default: "" },
    members: { type: [ConversationMemberSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lastMessageAt: { type: Date, default: null }
  },
  { timestamps: true }
);

ConversationSchema.index({ "members.user": 1 });
ConversationSchema.index({ lastMessageAt: -1 });

module.exports = mongoose.model("Conversation", ConversationSchema);
