import mongoose from "mongoose";

const storySchema = new mongoose.Schema({
    authorId: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['text', 'photo', 'video', 'audio'],
        required: true
    },
    content: {
        type: String,
        required: false
    },
    mediaUrl: {
        type: String,
        required: false
    },
    backgroundColor: {
        type: String,
        required: false
    },
    durationMs: {
        type: Number,
        required: false
    },
    expiresAt: {
        type: Date,
        required: true
    },
    viewedBy: {
        type: Map,
        of: Date,
        default: {}
    }
}, { timestamps: true });

// TTL index to automatically delete stories after expiresAt passes
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Story = mongoose.model("stories", storySchema);
