import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users_auth', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    table.string('email', 255).unique().notNullable()
    table.string('password_hash', 255).notNullable()
    table.boolean('is_verified').defaultTo(false)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })

  // Why: email is the most common lookup column
  // Index makes WHERE email = ? fast at scale
  await knex.schema.raw(
    'CREATE INDEX idx_users_auth_email ON users_auth(email)'
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users_auth')
}