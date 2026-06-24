import { UpdateUserData } from "../models/user.model";
import { addRelation, deleteRelation, findUserById, findUserByUsername, getAllRelations, getRelation, updateProfile, updateRelation } from "../repositories/user.repository"

export const sendBuddyReq = async (sender_id: string, receiver_id: string) => {

    const relation = await getRelation(sender_id, receiver_id);
    if (!relation) {
        //no entry create e request with pending status 
        await addRelation(sender_id, receiver_id);
        return;
    }
    if (relation.status === 'blocked') {
        throw new Error("user is blocked you cannot send a friend request");
    }
    if (relation.status === 'pending') {
        throw new Error("you already have a pending friend request");
    }
    if (relation.status === 'rejected') {
        if (relation.updated_at.getTime() + 24 * 60 * 60 * 1000 < Date.now()) {
            await updateRelation(sender_id, receiver_id, { status: 'pending', updated_at: new Date() },)
            return;
        }
        throw new Error("you already have a rejected request wait for 24 hours");

    }
    if (relation.status === 'accepted') {
        throw new Error("you are already friends");
    }

}

export const acceptBuddyReq = async (sender_id: string, receiver_id: string) => {

    const relation = await getRelation(sender_id, receiver_id);

    if (!relation) {
        throw new Error("no friend request found");
    }

    if (relation.status !== "pending") {
        throw new Error("no friend request found");
    }

    await updateRelation(sender_id, receiver_id, { status: "accepted", updated_at: new Date() });
}

export const rejectBuddyReq = async (sender_id: string, receiver_id: string) => {

    const relation = await getRelation(sender_id, receiver_id);

    if (!relation) {
        throw new Error("no friend request found");
    }

    if (relation.status !== "pending") {
        throw new Error("no friend request found");
    }

    await updateRelation(sender_id, receiver_id, { status: "rejected", updated_at: new Date() });
}

export const blockUser = async (sender_id: string, receiver_id: string) => {

    const relation = await getRelation(sender_id, receiver_id);

    if (!relation) {
        await addRelation(sender_id, receiver_id, "blocked");
        return;
    }

    if (relation.status === "blocked") {
        throw new Error("user is already blocked");
    }


    await updateRelation(sender_id, receiver_id, { status: "blocked", updated_at: new Date() });
}

export const unblockUser = async (sender_id: string, receiver_id: string) => {

    const relation = await getRelation(sender_id, receiver_id);

    if (!relation) {
        throw new Error("no friend request found");
    }

    if (relation.status !== "blocked") {
        throw new Error("user is not blocked");
    }

    await deleteRelation(sender_id, receiver_id);
}

export const getAllRelationsService = async (userId: string) => {
    return await getAllRelations(userId);
}

export const getUserProfile = async (userId: string) => {
    return await findUserById(userId);
}

export const updateUserProfile = async (userId: string, data: UpdateUserData) => {
    return await updateProfile(userId, data);
}

export const searchUser = async (searchQuery: string) => {
    return await findUserByUsername(searchQuery);
}
