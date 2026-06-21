import db from '../db/knex'

export const findUserByEmail = async (email: string) => {
    return await db('users_auth').where({ email }).first()

}

export const findUserById = async (userId: string) => {
    return await db('users_auth').where({ id: userId }).first()
}

export const createUser = async (email: string, passwordHash: string) => {
    const [user] = await db('users_auth').insert({
        email,
        password_hash: passwordHash
    }).returning('*')

    return user;
}

export const assignRole = async (userId: string, role: string) => {
    return await db('user_roles').insert({
        user_id: userId,
        role: role
    })

}

export const getRolesByUserId = async (userId: string) => {
    const [user] = await db('user_roles').where({ user_id: userId }).pluck('role')
    return user;
}

export const createRefreshToken = async (userId: string, token: string, expiresAt: Date) => {
    return await db('refresh_tokens').insert({
        user_id: userId,
        token: token,
        expires_at: expiresAt
    })
}

export const createVerificationToken = async (userId: string, token: string, expiresAt: Date) => {
    return await db('verification_tokens').insert({
        user_id: userId,
        token_hash: token,
        expires_at: expiresAt
    })
}

export const findVerificationToken = async (tokenHash: string) => {
    return await db('verification_tokens').where({ token_hash: tokenHash }).first();
}

export const markTokensUsed = async (userId: string, tokenId: string) => {
    return await db('verification_tokens').where({ user_id: userId, token_hash: tokenId }).update({
        is_used: true
    });
}
export const updateUserRole = async (userId: string, role: string) => {
    return await db('user_roles').where({ user_id: userId }).update({
        role: role
    });
}

export const findLatestVerificationToken = async (userId: string) => {
    return await db('verification_tokens').where({ user_id: userId }).orderBy('created_at', 'desc').first();
}

export const rotateRefreshToken = async (userId: string, newRefreshToken: string, newExpiresAt: Date) => {
    const [token] = await db('refresh_tokens').where({ user_id: userId }).update({
        token: newRefreshToken,
        expires_at: newExpiresAt
    }).returning('*');
    return token;
}



export const deleteRefreshToken = async (userId: string) => {
    return await db('refresh_tokens').where({ user_id: userId }).del();
}

export const findRefreshToken = async (tokenHash: string) => {
    return await db('refresh_tokens').where({ token: tokenHash }).first();
}