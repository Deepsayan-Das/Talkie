import { Room } from "../models/rooms.model";

export const createRoom = async (memberIds: string[], kind?: "dm" | "group", name?: string, avatar?: string) => {
    const finalKind = kind || (memberIds.length > 2 ? "group" : "dm")

    if (finalKind === "dm") {
        //singleton architecture
        const existingRoom = await Room.findOne({
            kind: "dm",
            "members.userId": { $all: memberIds },
            "members": { $size: memberIds.length }
        });
        if (existingRoom) {
            return existingRoom;
        }
    }

    const room = new Room({
        members: memberIds.map((id, index) => ({ 
            userId: id, 
            joinedAt: new Date(),
            ...(finalKind === "group" && index === 0 ? { role: "owner" } : {})
        })),
        kind: finalKind,
        ...(finalKind === "group" && { createdBy: memberIds[0], name, avatar })
    })
    await room.save();
    return room;
}

export const findRoomById = async (roomId: string) => {
    return await Room.findById(roomId);
}

export const findRoomsByUserId = async (userId: string) => {
    return await Room.aggregate([
        { $match: { "members.userId": userId } },
        {
            $lookup: {
                from: "messages",
                let: { roomId: "$_id" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$roomId", "$$roomId"] } } },
                    { $sort: { createdAt: -1 } },
                    { $limit: 1 }
                ],
                as: "lastMessageRecord"
            }
        },
        { $unwind: { path: "$lastMessageRecord", preserveNullAndEmptyArrays: true } },
        { $addFields: { id: { $toString: "$_id" } } }
    ]);
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
