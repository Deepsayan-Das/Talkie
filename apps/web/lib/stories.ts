import { api } from './api'

export interface Story {
    _id: string
    authorId: string
    type: 'text' | 'photo' | 'video' | 'audio'
    content?: string
    mediaUrl?: string
    backgroundColor?: string
    durationMs?: number
    createdAt: string
    expiresAt: string
    viewedBy: Record<string, string>
}

export interface StoryFeedEntry {
    _id: string // this is the authorId
    stories: Story[]
    latestAt: string
}

export async function getStoryFeed(): Promise<StoryFeedEntry[]> {
    const { data } = await api.get('/stories/feed')
    return data.feed
}

export async function createStory(payload: {
    type: string
    content?: string
    mediaUrl?: string
    backgroundColor?: string
    durationMs?: number
}): Promise<Story> {
    const { data } = await api.post('/stories', payload)
    return data.story
}

export async function getStory(id: string): Promise<Story> {
    const { data } = await api.get(`/stories/${id}`)
    return data.story
}

export async function deleteStory(id: string): Promise<void> {
    await api.delete(`/stories/${id}`)
}

export async function getStoryViewers(id: string): Promise<{ userId: string, viewedAt: string }[]> {
    const { data } = await api.get(`/stories/${id}/viewers`)
    return data.viewers
}
