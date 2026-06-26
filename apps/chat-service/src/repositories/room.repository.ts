import { Room } from "../models/rooms.model";

export const createRoom = async (memberIds: string[]) => {

    if (memberIds.length === 2) {
        //singleton architecture

        const existingRoom = await Room.findOne({
            kind: "dm",
            "members.userId": { $all: memberIds }
        });
        if (existingRoom) {
            return existingRoom;
        }
    }
    const kind = memberIds.length > 2 ? "group" : "dm"
    const room = new Room({
        members: memberIds.map((id) => ({ userId: id, joinedAt: new Date() })),
        kind,
        ...(kind === "group" && { createdBy: memberIds[0] })
    })
    await room.save();
    return room;
}

export const findRoomById = async (roomId: string) => {
    return await Room.findById(roomId);
}

export const findRoomsByUserId = async (userId: string) => {
    return await Room.find({
        "members.userId": userId
    });
}

export const updateRoom = async (roomId: string, data: { name?: string, description?: string, avatar?: string }) => {
    return await Room.findByIdAndUpdate(roomId, { $set: data }, { new: true });
}

export const deleteRoomById = async (roomId: string) => {
    return await Room.findByIdAndDelete(roomId);
}

export const addMember = async (roomId: string, member: string) => {
    return await Room.findByIdAndUpdate(roomId, {
        $push: {
            members: {
                userId: member,
                joinedAt: new Date()
            }
        }
    });
}

export const promoteMember = async (roomId: string, userId: string) => {
    return await Room.findOneAndUpdate(
        { _id: roomId, "members.userId": userId },
        { $set: { "members.$.role": "admin" } }
    )
}

export const demoteMember = async (roomId: string, userId: string) => {
    return await Room.findOneAndUpdate(
        { _id: roomId, "members.userId": userId },
        { $set: { "members.$.role": "member" } }
    )
}

export const removeMember = async (roomId: string, userId: string) => {
    return await Room.findByIdAndUpdate(roomId, {
        $pull: { members: { userId } }
    });
}
