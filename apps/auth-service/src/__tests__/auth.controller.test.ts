// Mock entire service layer — controllers shouldn't hit real services in tests
jest.mock('../services/auth.service')
jest.mock('../config/redis')

import request from 'supertest'
import express from 'express'
import cookieParser from 'cookie-parser'
import authRouter from '../routes/auth.routes'
import * as authService from '../services/auth.service'

// Build a minimal express app for testing
// Why not import your real index.ts?
// index.ts calls db.raw() on startup which would fail without Docker
const app = express()
app.use(express.json())
app.use(cookieParser())
app.use('/auth', authRouter)

const mockRegisterUser = authService.registerUser as jest.Mock
const mockLoginUser = authService.loginUser as jest.Mock

describe('POST /auth/register', () => {

    beforeEach(() => jest.clearAllMocks())

    it('should return 400 if email or password missing', async () => {
        const res = await request(app)
            .post('/auth/register')
            .send({ email: 'test@test.com' }) // no password

        expect(res.status).toBe(400)
        expect(res.body.success).toBe(false)
    })

    it('should return 201 on successful registration', async () => {
        mockRegisterUser.mockResolvedValue({
            id: 'uuid',
            email: 'test@test.com'
        })

        const res = await request(app)
            .post('/auth/register')
            .send({ email: 'test@test.com', password: 'password123' })

        expect(res.status).toBe(201)
        expect(res.body.success).toBe(true)
        expect(res.body.data).toHaveProperty('email')
    })

    it('should return 409 if user already exists', async () => {
        mockRegisterUser.mockRejectedValue(new Error('User already exists'))

        const res = await request(app)
            .post('/auth/register')
            .send({ email: 'existing@test.com', password: 'password123' })

        expect(res.status).toBe(409)
    })

})

describe('POST /auth/login', () => {

    beforeEach(() => jest.clearAllMocks())

    it('should return 400 if fields missing', async () => {
        const res = await request(app)
            .post('/auth/login')
            .send({})

        expect(res.status).toBe(400)
    })

    it('should return 200 with accessToken on valid login', async () => {
        mockLoginUser.mockResolvedValue({
            accessToken: 'fake.jwt.token',
            role: 'USER'
        })

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'test@test.com', password: 'password123' })

        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
    })

    it('should return 401 on invalid credentials', async () => {
        mockLoginUser.mockRejectedValue(new Error('INVALID CREDENTIALS'))

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'test@test.com', password: 'wrong' })

        expect(res.status).toBe(401)
    })

})
