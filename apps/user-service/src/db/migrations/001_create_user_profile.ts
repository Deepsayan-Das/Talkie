import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('users_profile', (table) => {
        table.uuid('id').primary().defaultTo(knex.fn.uuid())
        // No FK constraint — users_auth lives in a different database
        // Application layer enforces this relationship
        table.uuid('user_id').notNullable().unique()
        table.string('username', 50).notNullable().unique()
        table.string('avatar_url', 500).nullable()
        table.timestamp('last_seen').nullable()
        table.string('bio', 300).nullable()
        table.timestamp('created_at').defaultTo(knex.fn.now())
        table.timestamp('updated_at').defaultTo(knex.fn.now())
    })

    await knex.schema.raw(
        'CREATE INDEX idx_users_profile_user_id ON users_profile(user_id)'
    )
    await knex.schema.raw(
        'CREATE INDEX idx_users_profile_username ON users_profile(username)'
    )
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('users_profile')
}