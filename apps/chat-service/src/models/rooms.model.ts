import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({
    kind: {
        type: String,
        enum: ["dm", "group"],
        required: true
    },
    members: {
        type: [
            {
                userId: String,
                joinedAt: Date,
                role: {
                    type: String,
                    enum: ["member", "admin", "owner"],
                    default: "member"
                },
                mutedUntil: {
                    type: Date,
                    default: null
                }
            }
        ],
        default: []
    },
    pendingRequests: {
        type: [
            {
                id: String,
                type: { type: String }, // "kick" | "promote" | "demote" | "mute"
                targetUserId: String,
                requestedBy: String,
                reason: String,
                createdAt: { type: Date, default: Date.now }
            }
        ],
        default: []
    },
    name: {
        type: String
    },
    description: {
        type: String
    },
    avatar: {
        type: String
    },
    pinnedMessages: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "messages"
    },
    createdBy: {
        type: String
    },

}, { timestamps: true })

export const Room = mongoose.model("rooms", roomSchema);