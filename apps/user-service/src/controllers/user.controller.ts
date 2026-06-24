import { Request, Response } from "express";
import { acceptBuddyReq, blockUser, getAllRelationsService, getUserProfile, rejectBuddyReq, searchUser, sendBuddyReq, unblockUser, updateUserProfile } from "../services/user.services";

export const sendBuddyReqController = async (req: Request, res: Response) => {
    const rawSenderId = req.headers["x-user-id"];
    let sender_id = Array.isArray(rawSenderId) ? rawSenderId[0] : rawSenderId;

    if (!sender_id) {
        return res.status(400).json({ success: false, message: "Missing User ID header" });
    }
    const receiver_id = req.params.id;

    try {
        await sendBuddyReq(sender_id, receiver_id as string);
        res.status(200).json({
            success: true,
            message: "Friend request sent successfully!"
        });
    } catch (error: any) {
        if (error.message === "user is blocked you cannot send a friend request") {
            return res.status(403).json({ success: false, message: error.message });
        }
        if (error.message === "you already have a pending friend request") {
            return res.status(429).json({ success: false, message: error.message });
        }
        if (error.message === "you already have a rejected request wait for 24 hours") {
            return res.status(429).json({ success: false, message: error.message });
        }
        if (error.message === "you are already friends") {
            return res.status(409).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const acceptBuddyReqController = async (req: Request, res: Response) => {
    const rawSenderId = req.headers["x-user-id"];
    let sender_id = Array.isArray(rawSenderId) ? rawSenderId[0] : rawSenderId;

    if (!sender_id) {
        return res.status(400).json({ success: false, message: "Missing User ID header" });
    }
    const receiver_id = req.params.id;

    try {
        await acceptBuddyReq(sender_id, receiver_id as string);
        res.status(200).json({
            success: true,
            message: "Friend request accepted successfully!"
        });
    } catch (error: any) {
        if (error.message === "no friend request found") {
            return res.status(404).json({ success: false, message: error.message });
        }
        if (error.message === "no friend request found") {
            return res.status(404).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const rejectBuddyReqController = async (req: Request, res: Response) => {
    const rawSenderId = req.headers["x-user-id"];
    let sender_id = Array.isArray(rawSenderId) ? rawSenderId[0] : rawSenderId;

    if (!sender_id) {
        return res.status(400).json({ success: false, message: "Missing User ID header" });
    }
    const receiver_id = req.params.id;

    try {
        await rejectBuddyReq(sender_id, receiver_id as string);
        res.status(200).json({
            success: true,
            message: "Friend request rejected successfully!"
        });
    } catch (error: any) {
        if (error.message === "no friend request found") {
            return res.status(404).json({ success: false, message: error.message });
        }
        if (error.message === "no friend request found") {
            return res.status(404).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const blockUserController = async (req: Request, res: Response) => {
    const rawSenderId = req.headers["x-user-id"];
    let sender_id = Array.isArray(rawSenderId) ? rawSenderId[0] : rawSenderId;

    if (!sender_id) {
        return res.status(400).json({ success: false, message: "Missing User ID header" });
    }
    const receiver_id = req.params.id;

    try {
        await blockUser(sender_id, receiver_id as string);
        res.status(200).json({
            success: true,
            message: "User blocked successfully!"
        });
    } catch (error: any) {
        if (error.message === "user is already blocked") {
            return res.status(409).json({ success: false, message: error.message });
        }
        if (error.message === "no friend request found") {
            return res.status(404).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const unblockUserController = async (req: Request, res: Response) => {
    const rawSenderId = req.headers["x-user-id"];
    let sender_id = Array.isArray(rawSenderId) ? rawSenderId[0] : rawSenderId;

    if (!sender_id) {
        return res.status(400).json({ success: false, message: "Missing User ID header" });
    }
    const receiver_id = req.params.id;

    try {
        await unblockUser(sender_id, receiver_id as string);
        res.status(200).json({
            success: true,
            message: "User unblocked successfully!"
        });
    } catch (error: any) {
        if (error.message === "user is already unblocked") {
            return res.status(409).json({ success: false, message: error.message });
        }
        if (error.message === "no friend request found") {
            return res.status(404).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getAllRelationsController = async (req: Request, res: Response) => {
    const rawSenderId = req.headers["x-user-id"];
    let sender_id = Array.isArray(rawSenderId) ? rawSenderId[0] : rawSenderId;

    if (!sender_id) {
        return res.status(400).json({ success: false, message: "Missing User ID header" });
    }

    try {
        const relations = await getAllRelationsService(sender_id);
        res.status(200).json({
            success: true,
            message: "Relations fetched successfully!",
            data: relations
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getUserProfileController = async (req: Request, res: Response) => {
    const rawUserId = req.headers["x-user-id"];
    const requesterId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    if (!requesterId) {
        return res.status(400).json({ success: false, message: "Missing User ID header" });
    }

    const userId = req.params.id;

    try {
        const user = await getUserProfile(userId as string);
        res.status(200).json({ success: true, data: user });
    } catch (error: any) {
        if (error.message === "user not found!") {
            return res.status(404).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const updateUserProfileController = async (req: Request, res: Response) => {
    const rawUserId = req.headers["x-user-id"];
    const requesterId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

    if (!requesterId) {
        return res.status(400).json({ success: false, message: "Missing User ID header" });
    }

    const userId = req.params.id;

    if (requesterId !== userId) {
        return res.status(403).json({ success: false, message: "You can only update your own profile" });
    }

    try {
        await updateUserProfile(userId, req.body);
        res.status(200).json({ success: true, message: "Profile updated successfully!" });
    } catch (error: any) {
        if (error.message === "user not found!") {
            return res.status(404).json({ success: false, message: error.message });
        }
        if (error.message === "No fields provided to update!") {
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const searchUserController = async (req: Request, res: Response) => {
    const query = req.query.q as string;

    if (!query || query.trim().length === 0) {
        return res.status(400).json({ success: false, message: "Search query is required" });
    }

    try {
        const user = await searchUser(query.trim());
        if (!user) {
            return res.status(404).json({ success: false, message: "No user found" });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error: any) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}