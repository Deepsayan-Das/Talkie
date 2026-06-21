// Tell Jest to mock the entire repository module
// Every function in auth.repository becomes a jest.fn()
// This means NO real database calls happen
jest.mock('../repositories/auth.repository')
jest.mock('../config/redis')

import { registerUser, loginUser } from '../services/auth.service'
import * as repo from '../repositories/auth.repository'

// Cast to jest mocks so TypeScript knows they're mockable
const mockFindUserByEmail = repo.findUserByEmail as jest.Mock
const mockCreateUser = repo.createUser as jest.Mock
const mockAssignRole = repo.assignRole as jest.Mock

describe('Auth Service — registerUser', () => {

    // Reset all mocks before each test
    // Why: previous test's mock return values bleed into next test
    beforeEach(() => jest.clearAllMocks())

    it('should throw if user already exists', async () => {
        // Arrange — fake that DB found an existing user
        mockFindUserByEmail.mockResolvedValue({ id: 'uuid', email: 'test@test.com' })

        // Act + Assert — registerUser should throw
        await expect(registerUser('test@test.com', 'password123'))
            .rejects
            .toThrow('User already exists')
    })

    it('should create user and assign UNVERIFIED role on success', async () => {
        // Arrange — fake that no user exists, then fake the created user
        mockFindUserByEmail.mockResolvedValue(null)
        mockCreateUser.mockResolvedValue({
            id: 'new-uuid',
            email: 'test@test.com',
            password_hash: 'hashed'
        })
        mockAssignRole.mockResolvedValue({})

        // Act
        const result = await registerUser('test@test.com', 'password123')

        // Assert
        expect(mockCreateUser).toHaveBeenCalledTimes(1)
        expect(mockAssignRole).toHaveBeenCalledWith('new-uuid', 'UNVERIFIED')
        // password_hash must never appear in result
        expect(result).not.toHaveProperty('password_hash')
        expect(result).toHaveProperty('email', 'test@test.com')
    })

})

describe('Auth Service — loginUser', () => {

    beforeEach(() => jest.clearAllMocks())

    it('should throw if user not found', async () => {
        mockFindUserByEmail.mockResolvedValue(null)

        await expect(loginUser('ghost@test.com', 'password'))
            .rejects
            .toThrow('INVALID CREDENTIALS')
    })

    it('should throw if password is wrong', async () => {
        mockFindUserByEmail.mockResolvedValue({
            id: 'uuid',
            email: 'test@test.com',
            // bcrypt hash of 'correctpassword'
            password_hash: '$2b$12$invalidhashthatiswrong'
        })

        await expect(loginUser('test@test.com', 'wrongpassword'))
            .rejects
            .toThrow('INVALID CREDENTIALS')
    })

})