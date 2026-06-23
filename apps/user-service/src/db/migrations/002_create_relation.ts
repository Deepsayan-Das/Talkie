import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('relationships', (table) => {
        table.uuid('id').primary().defaultTo(knex.fn.uuid())

        // Both UUIDs reference users_profile.user_id at the application layer
        // (cross-service boundary — no DB-level FK)
        table.uuid('requester_id').notNullable()
        table.uuid('receiver_id').notNullable()

        // Possible lifecycle states:
        //   pending  — request sent, awaiting response
        //   accepted — both parties are friends / connected
        //   rejected — receiver declined (can be re-requested after cooldown)
        //   blocked  — one party has blocked the other
        table.string('status', 20).notNullable().defaultTo('pending')
        table.boolean('is_active').notNullable().defaultTo(true)

        table.timestamp('created_at').notNullable().defaultTo(knex.fn.now())
        table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now())

        // Prevent duplicate pairs regardless of who initiated
        table.unique(['requester_id', 'receiver_id'])
    })

    // Enforce canonical ordering: requester_id < receiver_id
    // This makes (A→B) and (B→A) map to the same row, working in tandem
    // with the UNIQUE constraint to prevent mirrored duplicates.
    await knex.schema.raw(`
        ALTER TABLE relationships
        ADD CONSTRAINT chk_relationships_pair_ordering
        CHECK (requester_id < receiver_id)
    `)

    // Prevent self-relationships
    await knex.schema.raw(`
        ALTER TABLE relationships
        ADD CONSTRAINT chk_relationships_no_self
        CHECK (requester_id <> receiver_id)
    `)

    // Lookup indexes
    await knex.schema.raw(
        'CREATE INDEX idx_relationships_requester ON relationships(requester_id)'
    )
    await knex.schema.raw(
        'CREATE INDEX idx_relationships_receiver ON relationships(receiver_id)'
    )
    await knex.schema.raw(
        'CREATE INDEX idx_relationships_status ON relationships(status)'
    )
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('relationships')
    await knex.schema.raw('DROP TYPE IF EXISTS relationship_status')
}
