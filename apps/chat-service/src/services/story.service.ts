import * as StoryRepository from "../repositories/story.repository";

export const createStory = async (authorId: string, type: 'text' | 'photo' | 'video' | 'audio', data: {
    content?: string,
    mediaUrl?: string,
    backgroundColor?: string,
    durationMs?: number,
}) => {
    // Expires 24 hours from now
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    return await StoryRepository.createStory({
        authorId,
        type,
        ...data,
        expiresAt
    });
}

export const getFeed = async (buddyIds: string[]) => {
    return await StoryRepository.getFeed(buddyIds);
}

export const getStoryById = async (storyId: string) => {
    const story = await StoryRepository.getStoryById(storyId);
    if (!story) {
        throw new Error("Story not found");
    }
    return story;
}

export const getStory = async (storyId: string, requestingUserId: string, buddyIds: string[]) => {
    const story = await StoryRepository.getStoryById(storyId);
    if (!story) throw new Error("Story not found");

    if (story.authorId !== requestingUserId && !buddyIds.includes(story.authorId)) {
        throw new Error("Not authorized to view this story");
    }

    return story;
}

export const deleteStory = async (storyId: string, userId: string) => {
    const story = await StoryRepository.getStoryById(storyId);
    if (!story) {
        throw new Error("Story not found");
    }
    
    if (story.authorId !== userId) {
        throw new Error("You don't have permission to delete this story");
    }
    
    await StoryRepository.deleteStory(storyId);
    return { message: "Story deleted successfully" };
}

export const markViewed = async (storyId: string, userId: string, buddyIds: string[]) => {
    const story = await StoryRepository.getStoryById(storyId);
    if (!story) {
        throw new Error("Story not found");
    }
    
    if (story.authorId !== userId && !buddyIds.includes(story.authorId)) {
        throw new Error("Not authorized to view this story");
    }
    
    // Don't record the author viewing their own story as a "view"
    if (story.authorId === userId) return story;
    
    // Repository handles deduplication by using a Map keyed by userId
    return await StoryRepository.markViewed(storyId, userId);
}

export const getViewers = async (storyId: string, userId: string) => {
    const story = await StoryRepository.getStoryById(storyId);
    if (!story) {
        throw new Error("Story not found");
    }
    
    if (story.authorId !== userId) {
        throw new Error("Only the author can see viewers");
    }
    
    const viewedByMap = story.viewedBy as Map<string, Date>;
    const viewers: { userId: string, viewedAt: Date }[] = [];
    
    if (viewedByMap) {
        for (const [viewerId, viewedAt] of viewedByMap.entries()) {
            viewers.push({ userId: viewerId, viewedAt });
        }
    }
    
    return viewers;
}
