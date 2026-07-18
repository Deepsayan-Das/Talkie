import { Message } from "../models/messages.model";

export const createMessage = async (
    roomId: string,
    senderId: string,
    senderDeviceId: string,
    content: string | undefined,
    deviceCiphertexts: Record<string, any> | undefined,
    attachments: { url: string, contentType: string, fileSize: number }[],
    targetDevices: string[] = [],
    replyTo?: string
) => {
    return await Message.create({
        roomId,
        senderId,
        senderDeviceId,
        content,
        deviceCiphertexts,
        attachments,
        replyTo,
        delivery: {
            targetDevices,
            deliveredDevices: [],
            deliveredAt: null
        }
    });
}

export const findMessagesByRoomId = async (roomId: string, page: number = 1, limit: number = 50) => {
    return await Message.find({ roomId, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit);
}

export const findMessageById = async (messageId: string) => {
    return await Message.findById(messageId);
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
    }, { new: true });
}

export const addReaction = async (messageId: string, userId: string, reaction: string) => {
    return await Message.findByIdAndUpdate(messageId, {
        $set: {
            [`reactions.${userId}`]: reaction,
        },
    }, { new: true });
}

export const removeReaction = async (messageId: string, userId: string) => {
    return await Message.findByIdAndUpdate(messageId, {
        $unset: {
            [`reactions.${userId}`]: ""
        }
    }, { new: true });
}

export const recordDelivery = async (messageId: string, deviceId: string) => {
    const existing = await Message.findById(messageId).select('delivery');
    if (!existing?.delivery) return null;

    // guard: only devices present in the original send-time snapshot count
    if (!existing.delivery.targetDevices.includes(deviceId)) return null;

    // already recorded — no-op, avoid redundant writes
    if (existing.delivery.deliveredDevices.includes(deviceId)) return null;

    // atomic single-op update — no read-modify-write race
    const msg = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { "delivery.deliveredDevices": deviceId } },
        { new: true }
    );
    if (!msg?.delivery) return null;

    const allDelivered = msg.delivery.targetDevices.every(td =>
        msg.delivery!.deliveredDevices.includes(td)
    );

    if (allDelivered && !msg.delivery.deliveredAt) {
        return await Message.findByIdAndUpdate(
            messageId,
            { $set: { "delivery.deliveredAt": new Date() } },
            { new: true }
        );
    }

    return null; // not yet complete — don't broadcast
};
