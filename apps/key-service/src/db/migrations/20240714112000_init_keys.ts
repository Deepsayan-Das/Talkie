import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable("user_keys", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
        table.uuid("user_id").notNullable();
        table.string("device_id").notNullable();
        table.text("identity_pub_key").notNullable();
        table.text("signing_pub_key").notNullable();
        table.bigInteger("signed_prekey_id").notNullable();
        table.text("signed_prekey_pub").notNullable();
        table.text("signed_prekey_signature").notNullable();
        table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
        table.unique(["user_id", "device_id"]);
    });

    await knex.schema.createTable("one_time_prekeys", (table) => {
        table.uuid("id").primary().defaultTo(knex.raw("gen_random_uuid()"));
        table.uuid("user_id").notNullable();
        table.string("device_id").notNullable();
        table.integer("key_id").notNullable();
        table.text("public_key").notNullable();
        table.boolean("is_used").defaultTo(false);
        table.timestamp("created_at", { useTz: true }).defaultTo(knex.fn.now());
        table.unique(["user_id", "device_id", "key_id"]);
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists("one_time_prekeys");
    await knex.schema.dropTableIfExists("user_keys");
}
