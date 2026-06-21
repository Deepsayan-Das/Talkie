import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('verification_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.uuid('user_id').notNullable()
      .references('id')
      .inTable('users_auth')
      .onDelete('CASCADE')
    table.string('token_hash', 255).unique().notNullable()
    table.boolean('is_used').defaultTo(false)
    table.timestamp('expires_at').notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())
  })

  await knex.schema.raw(
    'CREATE INDEX idx_verification_tokens_user_id ON verification_tokens(user_id)'
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('verification_tokens')
}