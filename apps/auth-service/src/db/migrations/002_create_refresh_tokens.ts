import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('user_id').notNullable()
      .references('id')
      .inTable('users_auth')
      .onDelete('CASCADE')
    table.string('token_hash', 255).unique().notNullable()
    table.boolean('is_revoked').defaultTo(false)
    table.timestamp('issued_at').defaultTo(knex.fn.now())
    table.timestamp('expires_at').notNullable()
  })

  // Why: every authenticated request looks up token_hash
  // and user_id — both need indexes for performance
  await knex.schema.raw(
    'CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id)'
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('refresh_tokens')
}