import db from './src/db/knex';
import { getBundleForDevice, upsertUserKey, upsertOneTimePrekeys } from './src/repositories/key.repository';

async function main() {
    const userId = '00000000-0000-0000-0000-000000000001';
    const deviceId = '00000000-0000-0000-0000-000000000002';

    try {
        console.log('Cleaning up existing keys for test user/device...');
        await db('one_time_prekeys').where({ user_id: userId, device_id: deviceId }).del();
        await db('user_keys').where({ user_id: userId, device_id: deviceId }).del();

        console.log('Inserting test user key...');
        await upsertUserKey({
            userId,
            deviceId,
            identityPublicKey: 'id-pub-key',
            signingPublicKey: 'sign-pub-key',
            signedPrekeyId: 1,
            signedPrekeyPub: 'spk-pub',
            signedPrekeySignature: 'spk-sig',
        });

        console.log('Inserting EXACTLY ONE unused OTK...');
        await upsertOneTimePrekeys([{
            userId,
            deviceId,
            keyId: 42,
            publicKey: 'otk-pub-42'
        }]);

        console.log('Firing two getBundleForDevice calls concurrently...');
        const results = await Promise.all([
            getBundleForDevice(userId, deviceId),
            getBundleForDevice(userId, deviceId)
        ]);

        console.log('\n--- Results ---');
        results.forEach((res: any, index: number) => {
            console.log(`Call ${index + 1} OTK:`, res?.oneTimePrekey ? res.oneTimePrekey.keyId : null);
        });

        const call1Otk = results[0]?.oneTimePrekey;
        const call2Otk = results[1]?.oneTimePrekey;

        if (call1Otk && call2Otk) {
            console.error('\nFAIL: Both calls got an OTK!');
        } else if (!call1Otk && !call2Otk) {
            console.error('\nFAIL: Neither call got an OTK!');
        } else {
            console.log('\nSUCCESS: Exactly one call got the OTK, the other got null.');
        }

    } catch (err) {
        console.error('Error during test:', err);
    } finally {
        console.log('Cleaning up...');
        await db('one_time_prekeys').where({ user_id: userId, device_id: deviceId }).del();
        await db('user_keys').where({ user_id: userId, device_id: deviceId }).del();
        await db.destroy();
    }
}

main();
