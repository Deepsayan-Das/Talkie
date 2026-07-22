import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "rooms",
        required: true
    },
    senderId: {
        type: String,
        required: true
    },
    senderDeviceId: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: false
    },
    deviceCiphertexts: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },
    attachments: {
        type: [
            {
                url: {
                    type: String,
                    required: true
                },
                contentType: {
                    type: String,
                    required: false // allowing attachment only messages
                },
                fileSize: {
                    type: Number,
                    required: true
                }
            }
        ]
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "messages",

    },
    seenBy: {
        type: [
            {
                userId: String,
                seenAt: Date
            }
        ],
        default: []
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    isSystemMessage: {
        type: Boolean,
        default: false
    },
    reactions: {
        type: Map,
        of: String,
        default: {}
    },
    forwardedFrom: {
        type: {
            originalSenderId: { type: String, required: true },
            originalRoomId: { type: String, required: true },
            originalMessageId: { type: String, required: true },
            originalTimestamp: { type: Date, required: true }
        },
        default: null
    },
    delivery: {
        targetDevices: { type: [String], default: [] },
        deliveredDevices: { type: [String], default: [] },
        deliveredAt: { type: Date, default: null }
    },
    pollVotes: {
        type: Map,
        of: String,
        default: {}
    },
    x3dhInit: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    }
}, { timestamps: true });

export const Message = mongoose.model("messages", messageSchema);