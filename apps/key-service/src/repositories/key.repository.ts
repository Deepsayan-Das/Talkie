import db from "../db/knex";

export interface UserKeyPayload {
    userId: string;
    deviceId: string;
    identityPublicKey: string;
    signingPublicKey: string;
    signedPrekeyId: number;
    signedPrekeyPub: string;
    signedPrekeySignature: string;
}

export interface OneTimePrekeyPayload {
    userId: string;
    deviceId: string;
    keyId: number;
    publicKey: string;
}

export const upsertUserKey = async (payload: UserKeyPayload) => {
    await db("user_keys")
        .insert({
            user_id: payload.userId,
            device_id: payload.deviceId,
            identity_pub_key: payload.identityPublicKey,
            signing_pub_key: payload.signingPublicKey,
            signed_prekey_id: payload.signedPrekeyId,
            signed_prekey_pub: payload.signedPrekeyPub,
            signed_prekey_signature: payload.signedPrekeySignature,
        })
        .onConflict(["user_id", "device_id"])
        .merge({
            identity_pub_key: payload.identityPublicKey,
            signing_pub_key: payload.signingPublicKey,
            signed_prekey_id: payload.signedPrekeyId,
            signed_prekey_pub: payload.signedPrekeyPub,
            signed_prekey_signature: payload.signedPrekeySignature,
        });
};

export const upsertOneTimePrekeys = async (payloads: OneTimePrekeyPayload[]) => {
    if (payloads.length === 0) return;

    const rows = payloads.map(p => ({
        user_id: p.userId,
        device_id: p.deviceId,
        key_id: p.keyId,
        public_key: p.publicKey,
        is_used: false
    }));

    await db("one_time_prekeys")
        .insert(rows)
        .onConflict(["user_id", "device_id", "key_id"])
        .ignore();
};

export const getUnusedOtkCount = async (userId: string, deviceId: string): Promise<{ count: number, keyIds: number[] }> => {
    const results = await db("one_time_prekeys")
        .select("key_id")
        .where({ user_id: userId, device_id: deviceId, is_used: false });

    return {
        count: results.length,
        keyIds: results.map((r: any) => r.key_id)
    };
};


export const getBundleForDevice = async (userId: string, deviceId: string) => {
    return await db.transaction(async (trx: any) => {
        // Grab the device's identity + signed prekey — this part is just a read.
        const identity = await trx('user_keys')
            .where({ user_id: userId, device_id: deviceId })
            .first();

        if (!identity) return null;

        // Atomically claim ONE unused OTK. FOR UPDATE SKIP LOCKED means: if another
        // concurrent transaction is already mid-claim on a row, don't wait for it
        // and don't grab it — just look at the next available row instead. This is
        // what makes two simultaneous requests physically incapable of claiming
        // the same key, even under real concurrency.
        const claimed = await trx.raw(
            `UPDATE one_time_prekeys
       SET is_used = true
       WHERE id = (
         SELECT id FROM one_time_prekeys
         WHERE user_id = ? AND device_id = ? AND is_used = false
         ORDER BY key_id ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING key_id, public_key`,
            [userId, deviceId]
        );

        // Normalize snake_case Postgres column names → camelCase at the repository
        // boundary so every caller sees a consistent shape.
        const rawOtk = claimed.rows[0] ?? null;
        const oneTimePrekey = rawOtk
            ? { keyId: rawOtk.key_id, publicKey: rawOtk.public_key }
            : null;

        return {
            deviceId: identity.device_id,
            identityPublicKey: identity.identity_pub_key,
            signingPublicKey: identity.signing_pub_key,
            signedPrekey: {
                id: identity.signed_prekey_id,
                publicKey: identity.signed_prekey_pub,
                signature: identity.signed_prekey_signature,
            },
            oneTimePrekey, // { keyId, publicKey } or null
        };
    });
};

export const getBundlesForUser = async (userId: string) => {
    const devices = await db('user_keys').where({ user_id: userId }).select('device_id');
    const bundles = await Promise.all(
        devices.map((d: any) => getBundleForDevice(userId, d.device_id))
    );
    return bundles.filter(Boolean); // drop any null (shouldn't happen, but be defensive)
};

export const getDevicesForUser = async (userId: string): Promise<string[]> => {
    const rows = await db('user_keys').where({ user_id: userId }).select('device_id');
    return rows.map((r: any) => r.device_id);
};
