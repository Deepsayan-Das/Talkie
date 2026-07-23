// TODO: user repository — DB queries for users_profile & relationships tables

import db from "../db/knex"
import { UpdateUserData, UserProfile, Relationship, RelationshipStatus, UpdateRelationData } from "../models/user.model"

export const findUserById = async (userId: string): Promise<UserProfile> => {
    const user = await db<UserProfile>('users_profile').where({ user_id: userId }).first();
    if (!user) {
        throw new Error("user not found!");
    }
    return user;
}

export const findUserByUsername = async (username: string): Promise<UserProfile | null> => {
    const cleanUsername = username.replace(/^@/, '').trim();
    const user = await db<UserProfile>('users_profile')
        .whereILike('username', cleanUsername)
        .first();
    if (!user) {
        return null;
    }
    return user;
}

export const updateProfile = async (userId: string, data: UpdateUserData): Promise<number> => {
    if (Object.keys(data).length === 0) {
        throw new Error("No fields provided to update!");
    }
    // Try to update existing profile row
    const count = await db<UserProfile>('users_profile').where({ user_id: userId }).update(data);
    if (count === 0) {
        // Profile doesn't exist yet — create it (first onboarding save)
        await db<UserProfile>('users_profile').insert({
            user_id: userId,
            ...data,
        });
    }
    return count || 1;
}
export const getRelation = async (userId: string, targetId: string): Promise<Relationship | null> => {
    const relation = await db<Relationship>('relationships')
        .where({ requester_id: userId, receiver_id: targetId })
        .orWhere({ requester_id: targetId, receiver_id: userId })
        .first();
    return relation || null;
}


export const addRelation = async (userId: string, targetId: string, status: RelationshipStatus = 'pending'): Promise<Relationship[]> => {
    // We intentionally preserve userId as requester and targetId as receiver
    // so we know exactly who initiated the buddy request.
    const relation = await db<Relationship>('relationships').insert({
        requester_id: userId,
        receiver_id: targetId,
        status
    }).returning('*');

    return relation;
}

export const updateRelation = async (userId: string, targetId: string, data: UpdateRelationData): Promise<number> => {
    // We must update the relation regardless of who initiated it.
    const count = await db<Relationship>('relationships')
        .where({ requester_id: userId, receiver_id: targetId })
        .orWhere({ requester_id: targetId, receiver_id: userId })
        .update(data);
    return count;
}

export const deleteRelation = async (userId: string, targetId: string) => {
    const count = await db<Relationship>('relationships')
        .where({ requester_id: userId, receiver_id: targetId })
        .orWhere({ requester_id: targetId, receiver_id: userId })
        .delete();
    return count;
}

export const getAllRelations = async (userId: string): Promise<Relationship[]> => {
    const relations = await db<Relationship>('relationships').where({ requester_id: userId }).orWhere({ receiver_id: userId });
    return relations;
}

export const updateLastSeen = async (userId: string, lastSeen: Date) => {
    const count = await db<UserProfile>('users_profile').where({ user_id: userId }).update({ last_seen: lastSeen });
    return count;
}

