import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_roles', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid())
    // Why UNIQUE on user_id: one user has exactly one role
    // Remove this constraint only if moving to multi-role system
    table.uuid('user_id').notNullable().unique()
      .references('id')
      .inTable('users_auth')
      .onDelete('CASCADE')
    // Why VARCHAR not ENUM: enums are painful to migrate in postgres
    // Application layer enforces valid values instead
    table.string('role', 50).notNullable().defaultTo('UNVERIFIED')
    table.timestamp('assigned_at').defaultTo(knex.fn.now())
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_roles')
}