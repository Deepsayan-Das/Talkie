/**
 * otk-concurrency-test.ts
 *
 * Isolated concurrency test for getBundleForDevice.
 *
 * What we're testing:
 *   When two callers race to claim the LAST unused OTK for a device,
 *   exactly one should receive { key_id, public_key } and the other
 *   should receive null — not both getting the same key_id.
 *
 * How to run (from the key-service directory):
 *   npx ts-node --project tsconfig.json scripts/otk-concurrency-test.ts
 *
 * Requires DB_HOST, DB_USER, DB_PASSWORD, DB_NAME env vars (same .env
 * that the service itself uses).
 */

import { config } from "dotenv";
config(); // load .env before touching the DB module

import db from "../src/db/knex";
import {
    upsertUserKey,
    upsertOneTimePrekeys,
    getBundleForDevice,
} from "../src/repositories/key.repository";

// ─── Synthetic test identities ───────────────────────────────────────────────
const TEST_USER_ID = `test-user-concurrency-${Date.now()}`;
const TEST_DEVICE_ID = `test-device-${Date.now()}`;
const SOLE_KEY_ID = 1; // exactly one OTK

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function seed() {
    // Write a minimal user_keys row so getBundleForDevice's identity lookup passes.
    await upsertUserKey({
        userId: TEST_USER_ID,
        deviceId: TEST_DEVICE_ID,
        identityPublicKey: "fake-identity-pub-key",
        signingPublicKey: "fake-signing-pub-key",
        signedPrekeyId: 1,
        signedPrekeyPub: "fake-signed-prekey-pub",
        signedPrekeySignature: "fake-signature",
    });

    // Seed EXACTLY one unused OTK.
    await upsertOneTimePrekeys([
        {
            userId: TEST_USER_ID,
            deviceId: TEST_DEVICE_ID,
            keyId: SOLE_KEY_ID,
            publicKey: "fake-otk-public-key",
        },
    ]);

    console.log(
        `[seed] Inserted user_key + 1 unused OTK (key_id=${SOLE_KEY_ID}) for`,
        `user=${TEST_USER_ID} device=${TEST_DEVICE_ID}`
    );
}

async function cleanup() {
    await db("one_time_prekeys")
        .where({ user_id: TEST_USER_ID, device_id: TEST_DEVICE_ID })
        .delete();
    await db("user_keys")
        .where({ user_id: TEST_USER_ID, device_id: TEST_DEVICE_ID })
        .delete();
    console.log("[cleanup] Test rows removed.");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
    await seed();

    console.log("\n[test] Firing two concurrent getBundleForDevice calls…\n");

    // Both calls start at the same time — this is the real concurrent scenario.
    // Promise.all doesn't "stagger" them; both transactions open before either
    // has a chance to commit, which is exactly the race we want to exercise.
    const [resultA, resultB] = await Promise.all([
        getBundleForDevice(TEST_USER_ID, TEST_DEVICE_ID),
        getBundleForDevice(TEST_USER_ID, TEST_DEVICE_ID),
    ]);

    // ── Pretty-print raw results ──────────────────────────────────────────────
    console.log("Result A:", JSON.stringify(resultA?.oneTimePrekey ?? null));
    console.log("Result B:", JSON.stringify(resultB?.oneTimePrekey ?? null));
    console.log();

    // ── Assertions ───────────────────────────────────────────────────────────
    const otkA = resultA?.oneTimePrekey ?? null;
    const otkB = resultB?.oneTimePrekey ?? null;

    const aGotKey = otkA !== null;
    const bGotKey = otkB !== null;

    // Exactly one of the two must have claimed the key.
    const exactlyOneGotKey = aGotKey !== bGotKey; // XOR

    // The two results must not share the same key_id (the core invariant).
    const sameKeyIdViolation =
        aGotKey && bGotKey && otkA!.key_id === otkB!.key_id;

    // ── Report ────────────────────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════");
    if (sameKeyIdViolation) {
        console.error("❌  FAIL — Both callers received the SAME key_id:", otkA!.key_id);
        console.error("    This would allow two parties to derive the same shared secret.");
    } else if (!exactlyOneGotKey) {
        console.error("❌  FAIL — Neither caller received a key (both got null).");
        console.error("    The OTK should have been claimable by exactly one of them.");
    } else {
        const winner = aGotKey ? "A" : "B";
        const loser  = aGotKey ? "B" : "A";
        console.log(`✅  PASS — Caller ${winner} claimed key_id=${SOLE_KEY_ID}.`);
        console.log(`           Caller ${loser} correctly received null (no double-claim).`);
        console.log("    FOR UPDATE SKIP LOCKED held under real concurrency.");
    }
    console.log("═══════════════════════════════════════════\n");

    // ── Final DB state sanity check ───────────────────────────────────────────
    const rows = await db("one_time_prekeys")
        .where({ user_id: TEST_USER_ID, device_id: TEST_DEVICE_ID })
        .select("key_id", "is_used");

    console.log("[db-check] OTK row state after both transactions:", rows);
    const markedUsed = rows.filter((r: any) => r.is_used === true || r.is_used === 1);
    if (markedUsed.length === 1) {
        console.log("[db-check] ✅  Exactly 1 OTK marked is_used=true — correct.");
    } else {
        console.error("[db-check] ❌  Unexpected is_used state:", rows);
    }

    await cleanup();
    await db.destroy(); // release the pg connection pool cleanly

    process.exit(exactlyOneGotKey && !sameKeyIdViolation ? 0 : 1);
}

run().catch((err) => {
    console.error("[fatal]", err);
    process.exit(1);
});
