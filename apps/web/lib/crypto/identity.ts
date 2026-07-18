import sodium from "libsodium-wrappers";
import { secureStore } from "../storage/secureStore";
import { IdentityKeyRecord } from "../storage/secureStore";

// ── User-scoped device ID ─────────────────────────────────────────────────
// Two users logged in on the same browser (same origin) must get distinct
// device identities, otherwise they overwrite each other's IndexedDB keys
// and every message shows "[Encrypted for another device]".
//
// We store each user's deviceId under `deviceId:<userId>` in localStorage.
// `setCurrentUserId` must be called at login so that subsequent parameterless
// `getOrCreateDeviceId()` calls know whose deviceId to return.

let _currentUserId: string | null = null;

export function setCurrentUserId(userId: string): void {
    _currentUserId = userId;
    if (typeof window !== 'undefined') {
        sessionStorage.setItem('currentUserId', userId);
    }
}

export function getCurrentUserId(): string | null {
    if (_currentUserId) return _currentUserId;
    if (typeof window !== 'undefined') {
        _currentUserId = sessionStorage.getItem('currentUserId');
    }
    return _currentUserId;
}

export function getOrCreateDeviceId(userId?: string): string {
    if (typeof window === 'undefined') return '';

    const uid = userId ?? getCurrentUserId();
    if (!uid) {
        // Fallback: legacy single-user key (should not happen after login)
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = crypto.randomUUID();
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    }

    const storageKey = `deviceId:${uid}`;
    let deviceId = localStorage.getItem(storageKey);
    if (!deviceId) {
        // Migrate: if there's an old un-scoped deviceId and no user-scoped one,
        // adopt it for the first user who logs in (avoids invalidating existing sessions)
        const legacy = localStorage.getItem('deviceId');
        if (legacy) {
            deviceId = legacy;
            localStorage.setItem(storageKey, deviceId);
            // Don't delete legacy yet — other code paths may still read it during migration
        } else {
            deviceId = crypto.randomUUID();
            localStorage.setItem(storageKey, deviceId);
        }
    }
    return deviceId;
}

export async function getOrCreateIdentityKey(deviceId: string) {
    await sodium.ready;
    const existing = await secureStore.getIdentityKey(deviceId);
    if (existing && existing.signingPrivateKey)
        return existing;
    const keyPair = sodium.crypto_box_keypair();
    const signingKeyPair = sodium.crypto_sign_keypair();
    const record: IdentityKeyRecord = {
        deviceId,
        publicKey: sodium.to_base64(keyPair.publicKey),
        privateKey: sodium.to_base64(keyPair.privateKey),
        signingPublicKey: sodium.to_base64(signingKeyPair.publicKey),
        signingPrivateKey: sodium.to_base64(signingKeyPair.privateKey),
        createdAt: new Date()
    };
    await secureStore.setIdentityKey(deviceId, record);
    return record;
}

export async function generatePreKeys(deviceId: string, signingPrivateKeyB64: string, serverUnusedCount: number) {
    await sodium.ready;
    const signingPrivateKey = sodium.from_base64(signingPrivateKeyB64);
    
    const signedPrekey = sodium.crypto_box_keypair();
    const signedPrekeyId = Date.now();
    const signature = sodium.crypto_sign_detached(
        signedPrekey.publicKey,
        signingPrivateKey
    );

    // Persist the signed prekey's private half locally, rotating it independently of identity keys
    await secureStore.setSignedPrekey(deviceId, {
        id: signedPrekeyId,
        publicKey: sodium.to_base64(signedPrekey.publicKey),
        privateKey: sodium.to_base64(signedPrekey.privateKey),
    });

    const TARGET_COUNT = 20;
    const needToGenerate = Math.max(0, TARGET_COUNT - serverUnusedCount);
    
    let startId = await secureStore.getMaxOneTimePrekeyId();
    if (startId < 0) startId = 0;

    const oneTimePreKeys = Array.from({ length: needToGenerate }, (_, i) => {
        const kp = sodium.crypto_box_keypair();
        return {
            id: startId + 1 + i,
            publicKey: sodium.to_base64(kp.publicKey),
            privateKey: sodium.to_base64(kp.privateKey),
            createdAt: new Date()
        }
    });

    if (oneTimePreKeys.length > 0) {
        await secureStore.saveOneTimePrekeys(oneTimePreKeys);
    }

    return {
        signedPrekey: {
            id: signedPrekeyId,
            publicKey: sodium.to_base64(signedPrekey.publicKey),
            privateKey: sodium.to_base64(signedPrekey.privateKey),
            signature: sodium.to_base64(signature)
        },
        oneTimePreKeys
    }
}