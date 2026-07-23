import { UpdateUserData } from "../models/user.model";
import { addRelation, deleteRelation, findUserById, findUserByUsername, getAllRelations, getRelation, updateProfile, updateRelation } from "../repositories/user.repository"
import logger from "../config/logger";

export const TALKIE_BOT_ID = '00000000-0000-0000-0000-000000000001';

export const sendBuddyReq = async (sender_id: string, receiver_id: string) => {
    logger.info('Sending buddy request', { sender_id, receiver_id });
    if (sender_id === receiver_id) {
        logger.warn('Buddy request blocked — cannot send request to yourself', { sender_id });
        throw new Error("you cannot send a friend request to yourself");
    }

    if (receiver_id === TALKIE_BOT_ID) {
        const relation = await getRelation(sender_id, receiver_id);
        if (!relation) {
            await addRelation(sender_id, receiver_id, 'accepted');
        } else if (relation.status !== 'accepted') {
            await updateRelation(sender_id, receiver_id, { status: 'accepted', updated_at: new Date() });
        }
        logger.info('Buddy request to TalkieBot auto-accepted', { sender_id });
        return;
    }

    const relation = await getRelation(sender_id, receiver_id);
    if (!relation) {
        //no entry create e request with pending status 
        await addRelation(sender_id, receiver_id);
        logger.info('Buddy request created', { sender_id, receiver_id });
        return;
    }
    if (relation.status === 'blocked') {
        logger.warn('Buddy request blocked — sender is blocked', { sender_id, receiver_id });
        throw new Error("user is blocked you cannot send a friend request");
    }
    if (relation.status === 'pending') {
        logger.warn('Buddy request blocked — pending request already exists', { sender_id, receiver_id });
        throw new Error("you already have a pending friend request");
    }
    if (relation.status === 'rejected') {
        if (relation.updated_at.getTime() + 24 * 60 * 60 * 1000 < Date.now()) {
            await updateRelation(sender_id, receiver_id, { status: 'pending', updated_at: new Date() },)
            logger.info('Buddy request re-sent after rejection cooldown', { sender_id, receiver_id });
            return;
        }
        logger.warn('Buddy request blocked — rejection cooldown not yet elapsed', { sender_id, receiver_id });
        throw new Error("you already have a rejected request wait for 24 hours");

    }
    if (relation.status === 'accepted') {
        logger.warn('Buddy request blocked — users are already friends', { sender_id, receiver_id });
        throw new Error("you are already friends");
    }

}

export const acceptBuddyReq = async (sender_id: string, receiver_id: string) => {
    logger.info('Accepting buddy request', { sender_id, receiver_id });
    const relation = await getRelation(sender_id, receiver_id);

    if (!relation) {
        logger.warn('Accept buddy request failed — no relation found', { sender_id, receiver_id });
        throw new Error("no friend request found");
    }

    if (relation.status !== "pending") {
        logger.warn('Accept buddy request failed — relation is not pending', { sender_id, receiver_id, status: relation.status });
        throw new Error("no friend request found");
    }

    await updateRelation(sender_id, receiver_id, { status: "accepted", updated_at: new Date() });
    logger.info('Buddy request accepted', { sender_id, receiver_id });
}

export const rejectBuddyReq = async (sender_id: string, receiver_id: string) => {
    logger.info('Rejecting buddy request', { sender_id, receiver_id });
    const relation = await getRelation(sender_id, receiver_id);

    if (!relation) {
        logger.warn('Reject buddy request failed — no relation found', { sender_id, receiver_id });
        throw new Error("no friend request found");
    }

    if (relation.status !== "pending") {
        logger.warn('Reject buddy request failed — relation is not pending', { sender_id, receiver_id, status: relation.status });
        throw new Error("no friend request found");
    }

    await updateRelation(sender_id, receiver_id, { status: "rejected", updated_at: new Date() });
    logger.info('Buddy request rejected', { sender_id, receiver_id });
}

export const blockUser = async (sender_id: string, receiver_id: string) => {
    logger.info('Blocking user', { sender_id, receiver_id });
    const relation = await getRelation(sender_id, receiver_id);

    if (!relation) {
        await addRelation(sender_id, receiver_id, "blocked");
        logger.info('User blocked (new relation created)', { sender_id, receiver_id });
        return;
    }

    if (relation.status === "blocked") {
        logger.warn('Block user failed — user already blocked', { sender_id, receiver_id });
        throw new Error("user is already blocked");
    }

    await updateRelation(sender_id, receiver_id, { status: "blocked", updated_at: new Date() });
    logger.info('User blocked (relation updated)', { sender_id, receiver_id });
}

export const unblockUser = async (sender_id: string, receiver_id: string) => {
    logger.info('Unblocking user', { sender_id, receiver_id });
    const relation = await getRelation(sender_id, receiver_id);

    if (!relation) {
        logger.warn('Unblock user failed — no relation found', { sender_id, receiver_id });
        throw new Error("no friend request found");
    }

    if (relation.status !== "blocked") {
        logger.warn('Unblock user failed — user is not blocked', { sender_id, receiver_id, status: relation.status });
        throw new Error("user is not blocked");
    }

    await deleteRelation(sender_id, receiver_id);
    logger.info('User unblocked', { sender_id, receiver_id });
}

export const getAllRelationsService = async (userId: string) => {
    logger.info('Fetching all relations', { userId });
    return await getAllRelations(userId);
}

export const getUserProfile = async (userId: string) => {
    logger.info('Fetching user profile', { userId });
    return await findUserById(userId);
}

export const updateUserProfile = async (userId: string, data: UpdateUserData) => {
    logger.info('Updating user profile', { userId, fields: Object.keys(data) });
    return await updateProfile(userId, data);
}

export const searchUser = async (searchQuery: string) => {
    logger.info('Searching for user', { searchQuery });
    const clean = searchQuery.replace(/^@/, '').trim().toLowerCase();
    if (['talkiebot', 'talkie', 'bot', 'ai'].includes(clean)) {
        const bot = await findUserById(TALKIE_BOT_ID).catch(() => null);
        if (bot) return bot;
    }
    return await findUserByUsername(searchQuery);
}
