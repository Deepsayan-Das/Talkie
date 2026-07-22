import { Request, Response } from "express";
import * as StoryService from "../services/story.service";
import logger from "../config/logger";
import { env } from "../config/env";

async function fetchUserBuddyIds(userId: string): Promise<string[]> {
    try {
        const response = await fetch(`${env.userServiceUrl}/api/v1/user/buddies`, {
            headers: { 'x-user-id': userId }
        });
        if (!response.ok) {
            throw new Error(`User service responded with ${response.status}`);
        }
        const json = await response.json() as any;
        if (!json.success || !json.data) return [];
        
        return json.data
            .filter((r: any) => r.status === 'accepted')
            .map((r: any) => r.requester_id === userId ? r.receiver_id : r.requester_id);
    } catch (error: any) {
        logger.error(`Failed to fetch buddies for user ${userId}: ${error.message}`);
        return [];
    }
}

export const createStory = async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { type, content, mediaUrl, backgroundColor, durationMs } = req.body;
        
        if (!['text', 'photo', 'video', 'audio'].includes(type)) {
            return res.status(400).json({ message: "Invalid story type" });
        }

        const story = await StoryService.createStory(userId, type, { content, mediaUrl, backgroundColor, durationMs });
        res.status(201).json({ story });
    } catch (error: any) {
        logger.error(`Error in createStory: ${error.message}`);
        res.status(500).json({ message: error.message });
    }
}

export const getFeed = async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const buddyIds = await fetchUserBuddyIds(userId);
        
        // Always include the user's own ID so they can see their own active stories in the feed if desired
        buddyIds.push(userId);
        
        const feed = await StoryService.getFeed(buddyIds);
        res.status(200).json({ feed });
    } catch (error: any) {
        logger.error(`Error in getFeed: ${error.message}`);
        res.status(500).json({ message: error.message });
    }
}

export const getStory = async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const storyId = req.params.id as string;
        
        const buddyIds = await fetchUserBuddyIds(userId);
        
        // Fetch the story and also mark it as viewed
        const story = await StoryService.markViewed(storyId, userId, buddyIds);
        
        res.status(200).json({ story });
    } catch (error: any) {
        logger.error(`Error in getStory: ${error.message}`);
        if (error.message === "Story not found") {
            return res.status(404).json({ message: error.message });
        }
        if (error.message === "Not authorized to view this story") {
            return res.status(403).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
}

export const deleteStory = async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const storyId = req.params.id as string;
        
        const result = await StoryService.deleteStory(storyId, userId);
        res.status(200).json(result);
    } catch (error: any) {
        logger.error(`Error in deleteStory: ${error.message}`);
        if (error.message === "Story not found") {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes("permission")) {
            return res.status(403).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
}

export const getStoryViewers = async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const storyId = req.params.id as string;
        
        const viewers = await StoryService.getViewers(storyId, userId);
        res.status(200).json({ viewers });
    } catch (error: any) {
        logger.error(`Error in getStoryViewers: ${error.message}`);
        if (error.message === "Story not found") {
            return res.status(404).json({ message: error.message });
        }
        if (error.message.includes("Only the author")) {
            return res.status(403).json({ message: error.message });
        }
        res.status(500).json({ message: error.message });
    }
}
