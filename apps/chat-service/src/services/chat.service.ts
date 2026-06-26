import * as RoomRepository from "../repositories/room.repository";
import * as MessageRepository from "../repositories/message.repository";

export const createRoom = async (requesterId: string, members: string[]) => {
    const membersToInclude = [...new Set([requesterId, ...members])]
    return RoomRepository.createRoom(membersToInclude);
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

export const removeMember = async (roomId: string, userId: string, memberId: string) => {
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

export const sendMessage = async (roomId: string, userId: string, content: string, attachments?: { url: string, contentType: string, fileSize: number }[]) => {
    const room = await RoomRepository.findRoomById(roomId);
    if (!room) {
        throw new Error("Room not found");
    }
    const user = room.members.find((member) => member.userId === userId);
    if (!user) {
        throw new Error("user not the memeber of the group");
    }
    const message = await MessageRepository.createMessage(roomId, userId, content, attachments || []);
    return message;
}
