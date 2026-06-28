import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("files", (table) => {
        table.uuid('id').primary().defaultTo(knex.fn.uuid());
        table.uuid('owner_id').notNullable();
        table.string('original_name', 255).notNullable()
        table.string('mime_type', 255).notNullable()
        table.integer('size').notNullable()
        table.string('storage_key').notNullable()
        table.string('url').notNullable()
        table.timestamp('created_at').defaultTo(knex.fn.now())
        table.timestamp('updated_at').defaultTo(knex.fn.now())
    })
    await knex.schema.raw('CREATE INDEX idx_files_owner_id ON files(owner_id)')
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('files')
}