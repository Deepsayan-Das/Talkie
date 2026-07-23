import * as RoomRepository from "../repositories/room.repository";
import * as MessageRepository from "../repositories/message.repository";
import redis from "../config/redis";

export const createRoom = async (requesterId: string, members: string[], kind?: "dm" | "group", name?: string, avatar?: string) => {
    const membersToInclude = [...new Set([requesterId, ...members])]
    return RoomRepository.createRoom(membersToInclude, kind, name, avatar);
}

export const getRoomByUserId = async (userId: string) => {
    const rooms = await RoomRepository.findRoomsByUserId(userId);
    return rooms;
}

export const getRoomById = async (roomId: string) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    return room;
}

export const updateGroup = async (groupId: string, userId: string, data: {
    name?: string
    description?: string
    avatar?: string
}) => {
    const room = await RoomRepository.findRoomById(groupId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the memeber of the group");
    }
    if (room.kind === "dm") {
        throw new Error("you can not update a dm");
    }

    if (user.role === "member") {
        throw new Error("you don't have permission to update the group");
    }
    const updatedRoom = await RoomRepository.updateRoom(groupId, data);
    if (!updatedRoom) {
        throw new Error("Room not found");
    }
    return updatedRoom;

}

export const deleteRoom = async (roomId: string, userId: string) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the memeber of the group");
    }
    if (room.kind === "dm") {
        throw new Error("you can not delete a dm");
    }
    if (user.role !== "owner") {
        throw new Error("you don't have permission to delete the group");
    }
    await RoomRepository.deleteRoomById(roomId);
    return { message: "Room deleted successfully" };
}

export const addMember = async (roomId: string, userId: string, memberId: string) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the memeber of the group");
    }
    if (room.kind === "dm") {
        throw new Error("you can not add member to a dm");
    }
    if (user.role === "member") {
        throw new Error("you don't have permission to add member to the group");
    }
    await RoomRepository.addMember(roomId, memberId);
    return { message: "Member added successfully" };
}

export const TALKIE_BOT_ID = "00000000-0000-0000-0000-000000000001";

export const removeMember = async (roomId: string, userId: string, memberId: string) => {
    if (memberId === TALKIE_BOT_ID) {
        throw new Error("TalkieBot is a system AI assistant and cannot be removed from groups");
    }
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the memeber of the group");
    }
    if (room.kind === "dm") {
        throw new Error("you can not remove member from a dm");
    }
    if (user.role === "member" && user.userId !== memberId) {
        throw new Error("you don't have permission to remove member from the group");
    }
    await RoomRepository.removeMember(roomId, memberId);
    return { message: "Member removed successfully" };
}

export const promoteMember = async (roomId: string, userId: string, memberId: string) => {
    if (memberId === TALKIE_BOT_ID) {
        throw new Error("TalkieBot is a system AI assistant and cannot be promoted");
    }
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the memeber of the group");
    }
    if (room.kind === "dm") {
        throw new Error("you can not promote member to a dm");
    }
    if (user.role !== "owner" && user.role !== "admin") {
        throw new Error("you don't have permission to promote member to the group");
    }
    await RoomRepository.promoteMember(roomId, memberId);
    return { message: "Member promoted successfully" };
}

export const demoteMember = async (roomId: string, userId: string, memberId: string) => {
    if (memberId === TALKIE_BOT_ID) {
        throw new Error("TalkieBot is a system AI assistant and cannot be demoted");
    }
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the memeber of the group");
    }
    if (room.kind === "dm") {
        throw new Error("you can not demote member to a dm");
    }
    if (user.role !== "owner" && user.role !== "admin") {
        throw new Error("you don't have permission to demote member to the group");
    }
    await RoomRepository.demoteMember(roomId, memberId);
    return { message: "Member demoted successfully" };
}

export const getMessages = async (roomId: string, userId: string, page: number, limit: number) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the memeber of the group");
    }
    const messages = await MessageRepository.findMessagesByRoomId(roomId, page, limit);
    return messages;
}

export const sendMessage = async (
    roomId: string,
    userId: string,
    senderDeviceId: string,
    content: string | undefined,
    deviceCiphertexts: Record<string, any> | undefined,
    attachments?: { url: string, contentType: string, fileSize: number }[],
    replyTo?: string,
    forwardedFrom?: { originalSenderId: string, originalRoomId: string, originalMessageId: string, originalTimestamp: Date }
) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the memeber of the group");
    }
    
    // @ts-ignore
    if (user.mutedUntil && new Date(user.mutedUntil).getTime() > Date.now()) {
        const until = new Date(user.mutedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        throw new Error(`You are muted in this group until ${until}`);
    }

    let targetDevices: string[] = [];
    if (deviceCiphertexts) {
        targetDevices = Object.keys(deviceCiphertexts);
    } else if (room.kind === 'dm') {
        const recipient = room.members.find((member) => member.userId !== userId);
        if (recipient) {
            targetDevices = await redis.smembers(`presence:${recipient.userId}`);
        }
    }

    const message = await MessageRepository.createMessage(
        roomId,
        userId,
        senderDeviceId,
        content,
        deviceCiphertexts,
        attachments || [],
        targetDevices,
        replyTo,
        forwardedFrom
    );
    return message;
}

export const updateMessage = async (roomId: string, messageId: string, userId: string, content: string) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the member of the group");
    }

    const message = await MessageRepository.findMessageById(messageId);
    if (!message) {
        throw new Error("Message not found");
    }
    if (message.senderId !== userId) {
        throw new Error("You are not allowed to edit this message");
    }

    const updated = await MessageRepository.updateMessage(messageId, content);
    return updated;
}

export const deleteMessage = async (roomId: string, messageId: string, userId: string) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the member of the group");
    }

    const message = await MessageRepository.findMessageById(messageId);
    if (!message) {
        throw new Error("Message not found");
    }
    if (message.senderId !== userId) {
        throw new Error("You are not allowed to delete this message");
    }

    await MessageRepository.softDeleteMessage(messageId);
}

export const markMessageAsSeen = async (roomId: string, messageId: string, userId: string) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the member of the group");
    }
    await MessageRepository.markAsSeen(messageId, userId);
}

function isValidReaction(reaction: string | null): boolean {
    if (!reaction) return false;
    // 1. Break the string into visible characters (graphemes)
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const segments = [...segmenter.segment(reaction)];

    // 2. Fail if there isn't exactly one visible character
    if (segments.length !== 1) return false;

    // 3. Verify that the single character is an emoji
    const singleChar = segments[0].segment;
    return /^\p{Extended_Pictographic}$/u.test(singleChar);
}

export const reactToMessage = async (roomId: string, messageId: string, userId: string, reaction: string) => {
    if (!isValidReaction(reaction)) {
        throw new Error("Invalid reaction");
    }
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the member of the group");
    }

    const message = await MessageRepository.findMessageById(messageId);
    if (!message) {
        throw new Error("Message not found");
    }
    const oldRxn = message.reactions?.get(userId);
    if (oldRxn && reaction === oldRxn) {
        return await MessageRepository.removeReaction(messageId, userId);
    } else if (reaction) {
        return await MessageRepository.addReaction(messageId, userId, reaction);
    }

    return message;
}

export const messageDelivered = async (roomId: string, messageId: string, userId: string, deviceId: string) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the member of the group");
    }
    return await MessageRepository.recordDelivery(messageId, deviceId);
}

export const voteOnPoll = async (roomId: string, messageId: string, userId: string, optionId: string) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) throw new Error("Room not found");
    const user = room.members.find((member) => member.userId === userId);
    if (!user) throw new Error("user not the member of the group");
    const message = await MessageRepository.findMessageById(messageId);
    if (!message) throw new Error("Message not found");
    
    return await MessageRepository.addPollVote(messageId, userId, optionId);
}

export const muteMember = async (roomId: string, adminId: string, memberId: string, durationMs: number) => {
    if (memberId === TALKIE_BOT_ID) throw new Error("TalkieBot is a system AI assistant and cannot be muted");
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) throw new Error("Room not found");
    const admin = room.members.find(m => m.userId === adminId);
    if (!admin || (admin.role !== 'admin' && admin.role !== 'owner')) throw new Error("Not authorized");
    
    const mutedUntil = new Date(Date.now() + durationMs);
    return await RoomRepository.muteMember(roomId, memberId, mutedUntil);
}

export const unmuteMember = async (roomId: string, adminId: string, memberId: string) => {
    if (memberId === TALKIE_BOT_ID) throw new Error("TalkieBot is a system AI assistant and cannot be muted or unmuted");
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) throw new Error("Room not found");
    const admin = room.members.find(m => m.userId === adminId);
    if (!admin || (admin.role !== 'admin' && admin.role !== 'owner')) throw new Error("Not authorized");
    
    return await RoomRepository.unmuteMember(roomId, memberId);
}

export const createRequest = async (roomId: string, userId: string, type: string, targetUserId: string, reason: string) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) throw new Error("Room not found");
    const user = room.members.find(m => m.userId === userId);
    if (!user) throw new Error("Not authorized");
    
    const request = {
        id: Math.random().toString(36).substring(2, 15),
        type,
        targetUserId,
        requestedBy: userId,
        reason,
        createdAt: new Date()
    };
    return await RoomRepository.addPendingRequest(roomId, request);
}

export const approveRequest = async (roomId: string, adminId: string, requestId: string) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) throw new Error("Room not found");
    const admin = room.members.find(m => m.userId === adminId);
    if (!admin || (admin.role !== 'admin' && admin.role !== 'owner')) throw new Error("Not authorized");
    
    const request = (room as any).pendingRequests?.find((r: any) => r.id === requestId);
    if (!request) throw new Error("Request not found");
    
    return await RoomRepository.removePendingRequest(roomId, requestId);
}

export const denyRequest = async (roomId: string, adminId: string, requestId: string) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) throw new Error("Room not found");
    const admin = room.members.find(m => m.userId === adminId);
    if (!admin || (admin.role !== 'admin' && admin.role !== 'owner')) throw new Error("Not authorized");
    
    return await RoomRepository.removePendingRequest(roomId, requestId);
}
