jest.mock('../services/user.services')

import request from 'supertest'
import express from 'express'
import userRouter from '../routes/user.routes'
import * as userService from '../services/user.services'

const app = express()
app.use(express.json())
app.use('/users', userRouter)

const mockSendBuddyReq = userService.sendBuddyReq as jest.Mock
const mockAcceptBuddyReq = userService.acceptBuddyReq as jest.Mock
const mockRejectBuddyReq = userService.rejectBuddyReq as jest.Mock
const mockBlockUser = userService.blockUser as jest.Mock
const mockUnblockUser = userService.unblockUser as jest.Mock
const mockGetAllRelations = userService.getAllRelationsService as jest.Mock
const mockGetUserProfile = userService.getUserProfile as jest.Mock
const mockUpdateUserProfile = userService.updateUserProfile as jest.Mock
const mockSearchUser = userService.searchUser as jest.Mock

describe('POST /users/:id/buddy-request', () => {
    beforeEach(() => jest.clearAllMocks())

    it('should return 400 if X-User-Id header is missing', async () => {
        const res = await request(app)
            .post('/users/target-123/buddy-request')
        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
    })

    it('should return 201 on success', async () => {
        mockSendBuddyReq.mockResolvedValue(undefined)
        const res = await request(app)
            .post('/users/target-123/buddy-request')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
    })

    it('should return 403 if user is blocked', async () => {
        mockSendBuddyReq.mockRejectedValue(new Error('user is blocked you cannot send a friend request'))
        const res = await request(app)
            .post('/users/target-123/buddy-request')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(403)
    })

    it('should return 429 if request already pending', async () => {
        mockSendBuddyReq.mockRejectedValue(new Error('you already have a pending friend request'))
        const res = await request(app)
            .post('/users/target-123/buddy-request')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(429)
    })

    it('should return 409 if already friends', async () => {
        mockSendBuddyReq.mockRejectedValue(new Error('you are already friends'))
        const res = await request(app)
            .post('/users/target-123/buddy-request')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(409)
    })
})

describe('PATCH /users/:id/buddy-request/accept', () => {
    beforeEach(() => jest.clearAllMocks())

    it('should return 400 if X-User-Id header is missing', async () => {
        const res = await request(app)
            .patch('/users/target-123/buddy-request/accept')
        expect(res.status).toBe(400)
    })

    it('should return 200 on success', async () => {
        mockAcceptBuddyReq.mockResolvedValue(undefined)
        const res = await request(app)
            .patch('/users/target-123/buddy-request/accept')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
    })

    it('should return 404 if no pending request found', async () => {
        mockAcceptBuddyReq.mockRejectedValue(new Error('no friend request found'))
        const res = await request(app)
            .patch('/users/target-123/buddy-request/accept')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(404)
    })
})

describe('PATCH /users/:id/buddy-request/reject', () => {
    beforeEach(() => jest.clearAllMocks())

    it('should return 400 if X-User-Id header is missing', async () => {
        const res = await request(app)
            .patch('/users/target-123/buddy-request/reject')
        expect(res.status).toBe(400)
    })

    it('should return 200 on success', async () => {
        mockRejectBuddyReq.mockResolvedValue(undefined)
        const res = await request(app)
            .patch('/users/target-123/buddy-request/reject')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
    })

    it('should return 404 if no pending request found', async () => {
        mockRejectBuddyReq.mockRejectedValue(new Error('no friend request found'))
        const res = await request(app)
            .patch('/users/target-123/buddy-request/reject')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(404)
    })
})

describe('POST /users/:id/block', () => {
    beforeEach(() => jest.clearAllMocks())

    it('should return 400 if X-User-Id header is missing', async () => {
        const res = await request(app)
            .post('/users/target-123/block')
        expect(res.status).toBe(400)
    })

    it('should return 200 on success', async () => {
        mockBlockUser.mockResolvedValue(undefined)
        const res = await request(app)
            .post('/users/target-123/block')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
    })

    it('should return 409 if already blocked', async () => {
        mockBlockUser.mockRejectedValue(new Error('user is already blocked'))
        const res = await request(app)
            .post('/users/target-123/block')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(409)
    })
})

describe('DELETE /users/:id/block', () => {
    beforeEach(() => jest.clearAllMocks())

    it('should return 400 if X-User-Id header is missing', async () => {
        const res = await request(app)
            .delete('/users/target-123/block')
        expect(res.status).toBe(400)
    })

    it('should return 200 on success', async () => {
        mockUnblockUser.mockResolvedValue(undefined)
        const res = await request(app)
            .delete('/users/target-123/block')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
    })
})

describe('GET /users/buddies', () => {
    beforeEach(() => jest.clearAllMocks())

    it('should return 400 if X-User-Id header is missing', async () => {
        const res = await request(app).get('/users/buddies')
        expect(res.status).toBe(400)
    })

    it('should return 200 with relations', async () => {
        mockGetAllRelations.mockResolvedValue([{ id: 'rel-1', status: 'accepted' }])
        const res = await request(app)
            .get('/users/buddies')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
    })
})

describe('GET /users/:id', () => {
    beforeEach(() => jest.clearAllMocks())

    it('should return 400 if X-User-Id header is missing', async () => {
        const res = await request(app).get('/users/target-123')
        expect(res.status).toBe(400)
    })

    it('should return 200 with user profile', async () => {
        mockGetUserProfile.mockResolvedValue({ id: 'target-123', username: 'john' })
        const res = await request(app)
            .get('/users/target-123')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(200)
        expect(res.body.data).toHaveProperty('username')
    })

    it('should return 404 if user not found', async () => {
        mockGetUserProfile.mockRejectedValue(new Error('user not found!'))
        const res = await request(app)
            .get('/users/target-123')
            .set('x-user-id', 'sender-123')
        expect(res.status).toBe(404)
    })
})

describe('PATCH /users/:id', () => {
    beforeEach(() => jest.clearAllMocks())

    it('should return 400 if X-User-Id header is missing', async () => {
        const res = await request(app).patch('/users/target-123')
        expect(res.status).toBe(400)
    })

    it('should return 403 if user tries to update someone elses profile', async () => {
        const res = await request(app)
            .patch('/users/target-123')
            .set('x-user-id', 'different-user')
            .send({ bio: 'hacked' })
        expect(res.status).toBe(403)
    })

    it('should return 200 on successful update', async () => {
        mockUpdateUserProfile.mockResolvedValue(1)
        const res = await request(app)
            .patch('/users/target-123')
            .set('x-user-id', 'target-123')
            .send({ bio: 'new bio' })
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
    })
})

describe('GET /users/search', () => {
    beforeEach(() => jest.clearAllMocks())

    it('should return 400 if query is missing', async () => {
        const res = await request(app).get('/users/search')
        expect(res.status).toBe(400)
    })

    it('should return 404 if no user found', async () => {
        mockSearchUser.mockResolvedValue(null)
        const res = await request(app)
            .get('/users/search')
            .query({ q: 'ghost' })
        expect(res.status).toBe(404)
    })

    it('should return 200 with user data', async () => {
        mockSearchUser.mockResolvedValue({ id: 'uuid', username: 'ghost' })
        const res = await request(app)
            .get('/users/search')
            .query({ q: 'ghost' })
        expect(res.status).toBe(200)
        expect(res.body.data).toHaveProperty('username')
    })
})

// todo : - tests are giving error 