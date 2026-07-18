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
        of: {
            ciphertext: { type: String, required: true },
            nonce: { type: String, required: true },
            messageIndex: { type: Number, required: true },
            myRatchetPub: { type: String, required: true },
            x3dhInit: {
                type: {
                    identityPublicKey: { type: String, required: true },
                    ephemeralPublicKey: { type: String, required: true },
                    usedOneTimePrekeyId: { type: Number, default: null }
                },
                default: null
            }
        },
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
    delivery: {
        targetDevices: { type: [String], default: [] },
        deliveredDevices: { type: [String], default: [] },
        deliveredAt: { type: Date, default: null }
    },
    x3dhInit: {
        type: {
            identityPublicKey: { type: String, required: true },
            ephemeralPublicKey: { type: String, required: true },
            usedOneTimePrekeyId: { type: Number, default: null }
        },
        default: null
    }
}, { timestamps: true });

export const Message = mongoose.model("messages", messageSchema);