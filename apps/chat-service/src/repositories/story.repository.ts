import { Story } from "../models/stories.model";

export const createStory = async (storyData: any) => {
    return await Story.create(storyData);
}

export const getFeed = async (buddyIds: string[]) => {
    return await Story.aggregate([
        { $match: { authorId: { $in: buddyIds }, expiresAt: { $gt: new Date() } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$authorId', stories: { $push: '$$ROOT' }, latestAt: { $max: '$createdAt' } } },
        { $sort: { latestAt: -1 } }
    ]);
}

export const getStoryById = async (storyId: string) => {
    return await Story.findById(storyId);
}

export const deleteStory = async (storyId: string) => {
    return await Story.findByIdAndDelete(storyId);
}

export const markViewed = async (storyId: string, userId: string) => {
    // Model viewedBy as a Map keyed by userId to correctly deduplicate views
    return await Story.findByIdAndUpdate(storyId, {
        $set: {
            [`viewedBy.${userId}`]: new Date()
        }
    }, { new: true });
}
