import { Request, Response } from "express";
import * as ChatService from "../services/chat.service";

const resolveStatus = (message: string): number => {
    if (message.toLowerCase().includes("not found")) return 404;
    if (message.startsWith("you can not")) return 400;
    if (
        message.includes("not the memeber") ||
        message.includes("don't have permission")
    ) return 403;
    return 500;
};

export const createRoomController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers["x-user-id"] as string;
        const { members, kind, name } = req.body;
        const room = await ChatService.createRoom(userId, members, kind, name);
        return res.status(201).json({ success: true, data: room });
    } catch (error: any) {
        return res.status(resolveStatus(error.message)).json({ success: false, message: error.message });
    }
}

export const getRoomsController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers["x-user-id"] as string;
        const rooms = await ChatService.getRoomByUserId(userId);
        return res.status(200).json({ success: true, data: rooms });
    } catch (error: any) {
        return res.status(resolveStatus(error.message)).json({ success: false, message: error.message });
    }
}

export const getRoomByIdController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers["x-user-id"] as string;
        const { roomId } = req.params;
        const room = await ChatService.getRoomById(roomId as string);
        return res.status(200).json({ success: true, data: room });
    } catch (error: any) {
        return res.status(resolveStatus(error.message)).json({ success: false, message: error.message });
    }
}

export const updateGroupController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers["x-user-id"] as string;
        const { groupId } = req.params;
        const { name, description, avatar } = req.body;
        const updatedRoom = await ChatService.updateGroup(groupId as string, userId, { name, description, avatar });
        return res.status(200).json({ success: true, data: updatedRoom });
    } catch (error: any) {
        return res.status(resolveStatus(error.message)).json({ success: false, message: error.message });
    }
}

export const deleteRoomController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers["x-user-id"] as string;
        const { roomId } = req.params;
        const deletedRoom = await ChatService.deleteRoom(roomId as string, userId);
        return res.status(200).json({ success: true, data: deletedRoom });
    } catch (error: any) {
        return res.status(resolveStatus(error.message)).json({ success: false, message: error.message });
    }
}

export const addMemberController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers["x-user-id"] as string;
        const { roomId } = req.params;
        const { memberId } = req.body;
        const updatedRoom = await ChatService.addMember(roomId as string, userId, memberId as string);
        return res.status(200).json({ success: true, data: updatedRoom });
    } catch (error: any) {
        return res.status(resolveStatus(error.message)).json({ success: false, message: error.message });
    }
}

export const removeMemberController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers["x-user-id"] as string;
        const { roomId } = req.params;
        const { memberId } = req.body;
        const updatedRoom = await ChatService.removeMember(roomId as string, userId, memberId);
        return res.status(200).json({ success: true, data: updatedRoom });
    } catch (error: any) {
        return res.status(resolveStatus(error.message)).json({ success: false, message: error.message });
    }
}

export const promoteMemberController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers["x-user-id"] as string;
        const { roomId } = req.params;
        const { memberId } = req.body;
        const updatedRoom = await ChatService.promoteMember(roomId as string, userId, memberId);
        return res.status(200).json({ success: true, data: updatedRoom });
    } catch (error: any) {
        return res.status(resolveStatus(error.message)).json({ success: false, message: error.message });
    }
}

export const demoteMemberController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers["x-user-id"] as string;
        const { roomId } = req.params;
        const { memberId } = req.body;
        const updatedRoom = await ChatService.demoteMember(roomId as string, userId, memberId);
        return res.status(200).json({ success: true, data: updatedRoom });
    } catch (error: any) {
        return res.status(resolveStatus(error.message)).json({ success: false, message: error.message });
    }
}

export const getMessagesController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers["x-user-id"] as string;
        const { roomId } = req.params;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 50;
        const messages = await ChatService.getMessages(roomId as string, userId, Number(page), Number(limit));
        return res.status(200).json({ success: true, data: messages });
    } catch (error: any) {
        return res.status(resolveStatus(error.message)).json({ success: false, message: error.message });
    }
}
