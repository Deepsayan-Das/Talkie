import sodium from 'libsodium-wrappers';
import { secureStore } from '@/lib/storage/secureStore';
import { api } from '@/lib/api';

export async function initiateSessionForDevice(myDeviceId: string, bundle: any) {
    await sodium.ready;
    const myIdentity = await secureStore.getIdentityKey(myDeviceId);
    if (!myIdentity) throw new Error('No local identity key found');

    const ephemeral = sodium.crypto_box_keypair();

    const myIdentityPriv = sodium.from_base64(myIdentity.privateKey);
    const theirIdentityPub = sodium.from_base64(bundle.identityPublicKey);
    const theirSignedPrekeyPub = sodium.from_base64(bundle.signedPrekey.publicKey);
    const theirOtkPub = bundle.oneTimePrekey
        ? sodium.from_base64(bundle.oneTimePrekey.publicKey)
        : null;

    const dh1 = sodium.crypto_scalarmult(myIdentityPriv, theirSignedPrekeyPub);
    const dh2 = sodium.crypto_scalarmult(ephemeral.privateKey, theirIdentityPub);
    const dh3 = sodium.crypto_scalarmult(ephemeral.privateKey, theirSignedPrekeyPub);
    const dh4 = theirOtkPub
        ? sodium.crypto_scalarmult(ephemeral.privateKey, theirOtkPub)
        : new Uint8Array(0);

    const combined = new Uint8Array([...dh1, ...dh2, ...dh3, ...dh4]);
    const sharedSecret = sodium.crypto_generichash(32, combined, null);

    const initialChainKey = sodium.to_base64(
        sodium.crypto_generichash(32, new Uint8Array([...sharedSecret, ...sodium.from_string('init')]), null)
    );

    const x3dhInit = {
        identityPublicKey: myIdentity.publicKey,
        ephemeralPublicKey: sodium.to_base64(ephemeral.publicKey),
        usedOneTimePrekeyId: bundle.oneTimePrekey?.keyId ?? null,
    };

    await secureStore.setSession(bundle.deviceId, {
        rootKey: sodium.to_base64(sharedSecret),
        myRatchetPriv: sodium.to_base64(ephemeral.privateKey),
        myRatchetPub: sodium.to_base64(ephemeral.publicKey),
        theirRatchetPub: null,
        sendChainKey: initialChainKey,
        recvChainKey: null,
        sendIndex: 0,
        recvIndex: 0,
        skippedKeys: {},
        x3dhInit,
    });

    return {
        deviceId: bundle.deviceId,
        x3dhInit,
    };
}

export async function initiateSession(recipientUserId: string, myDeviceId: string) {
    await sodium.ready;

    // 1. Get MY identity key (already sitting in IndexedDB from login)
    const myIdentity = await secureStore.getIdentityKey(myDeviceId);
    if (!myIdentity) throw new Error('No local identity key found');

    // 2. Fetch the recipient's bundle(s) — the endpoint you built earlier
    const res = await api.get(`/keys/${recipientUserId}/bundle`);
    const bundles = res.data.bundles; // array, one per device

    const sessions = [];

    // Per-device: your architecture needs one session PER device, not one per person
    for (const bundle of bundles) {
        const sessionResult = await initiateSessionForDevice(myDeviceId, bundle);
        sessions.push(sessionResult);
    }

    return sessions; // one per recipient device — used when actually sending the first message
}

// lib/crypto/x3dh.ts (continued)

export async function receiveSession(
    myDeviceId: string,
    senderDeviceId: string,
    senderX3dhInit: { identityPublicKey: string; ephemeralPublicKey: string; usedOneTimePrekeyId: number | null }
) {
    await sodium.ready;

    // Pull back everything I need from MY OWN local storage — nothing from the network.
    const myIdentity = await secureStore.getIdentityKey(myDeviceId);
    const mySignedPrekey = await secureStore.getSignedPrekey(myDeviceId);
    if (!myIdentity || !mySignedPrekey) throw new Error('Missing local key material');

    let myOtkPrivate: Uint8Array | null = null;
    if (senderX3dhInit.usedOneTimePrekeyId !== null) {
        const otkRecord = await secureStore.getOneTimePrekey(senderX3dhInit.usedOneTimePrekeyId);
        if (otkRecord) myOtkPrivate = sodium.from_base64(otkRecord.privateKey);
    }

    const theirIdentityPub = sodium.from_base64(senderX3dhInit.identityPublicKey);
    const theirEphemeralPub = sodium.from_base64(senderX3dhInit.ephemeralPublicKey);
    const mySignedPrekeyPriv = sodium.from_base64(mySignedPrekey.privateKey);
    const myIdentityPriv = sodium.from_base64(myIdentity.privateKey);

    // Mirror image of Alice's computation — same pairs, roles swapped.
    const dh1 = sodium.crypto_scalarmult(mySignedPrekeyPriv, theirIdentityPub);
    const dh2 = sodium.crypto_scalarmult(myIdentityPriv, theirEphemeralPub);
    const dh3 = sodium.crypto_scalarmult(mySignedPrekeyPriv, theirEphemeralPub);
    const dh4 = myOtkPrivate
        ? sodium.crypto_scalarmult(myOtkPrivate, theirEphemeralPub)
        : new Uint8Array(0);

    const combined = new Uint8Array([...dh1, ...dh2, ...dh3, ...dh4]);
    const sharedSecret = sodium.crypto_generichash(32, combined, null);

    // Save under the SENDER's device ID so future messages from them reuse this session.
    // receiveSession — mirror: Bob's recvChainKey must equal Alice's sendChainKey
    const initialChainKey = sodium.to_base64(
        sodium.crypto_generichash(32, new Uint8Array([...sharedSecret, ...sodium.from_string('init')]), null)
    );

    await secureStore.setSession(senderDeviceId, {
        rootKey: sodium.to_base64(sharedSecret),
        myRatchetPriv: '', // Bob has none yet — generated on his FIRST send
        myRatchetPub: '',
        theirRatchetPub: senderX3dhInit.ephemeralPublicKey, // Alice's ratchet pub
        sendChainKey: null,
        recvChainKey: initialChainKey, // matches Alice's sendChainKey exactly
        sendIndex: 0,
        recvIndex: 0,
        skippedKeys: {},
    });

    return sharedSecret;
}