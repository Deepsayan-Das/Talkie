import { Message } from "../models/messages.model";

export const createMessage = async (roomId: string, senderId: string, content: string, attachments: { url: string, contentType: string, fileSize: number }[]) => {
    return await Message.create({
        roomId,
        senderId,
        content,
        attachments
    });
}

export const findMessagesByRoomId = async (roomId: string, page: number = 1, limit: number = 50) => {
    return await Message.find({ roomId, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
}

export const updateMessage = async (messageId: string, content: string) => {
    return await Message.findByIdAndUpdate(messageId, {
        content
    }, { new: true });
}

export const softDeleteMessage = async (messageId: string) => {
    return await Message.findByIdAndUpdate(messageId, {
        isDeleted: true
    }, { new: true });
}

export const markAsSeen = async (messageId: string, userId: string) => {
    return await Message.findByIdAndUpdate(messageId, {
        $push: {
            seenBy: {
                userId,
                seenAt: new Date()
            }
        }
    });
}