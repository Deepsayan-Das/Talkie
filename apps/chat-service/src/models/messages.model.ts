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
    content: {
        type: String,
        required: true
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
    }


}, { timestamps: true });

export const Message = mongoose.model("messages", messageSchema);