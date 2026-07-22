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
        let deviceId = sessionStorage.getItem('tempDeviceId');
        if (!deviceId) {
            deviceId = crypto.randomUUID();
            sessionStorage.setItem('tempDeviceId', deviceId);
        }
        return deviceId;
    }

    const storageKey = `deviceId:${uid}`;
    let deviceId = localStorage.getItem(storageKey);
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem(storageKey, deviceId);
    }
    return deviceId;
}

export async function getOrCreateIdentityKey(deviceId: string): Promise<IdentityKeyRecord> {
    await sodium.ready;
    const existing = await secureStore.getIdentityKey(deviceId);
    if (existing && existing.signingPrivateKey) {
        return existing;
    }
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

export async function ensureValidDeviceAndIdentity(userId: string) {
    await sodium.ready;
    const deviceId = getOrCreateDeviceId(userId);
    const identityKey = await getOrCreateIdentityKey(deviceId);
    return { deviceId, identityKey };
}

export async function generatePreKeys(deviceId: string, signingPrivateKeyB64: string, serverUnusedCount: number) {
    await sodium.ready;
    const signingPrivateKey = sodium.from_base64(signingPrivateKeyB64);
    
    // ── Signed prekey: reuse the existing one if it's still valid ──────────
    // Generating a new signed prekey on every login invalidates all existing
    // X3DH sessions established with the old one, causing "wrong secret key"
    // errors for every message. Only rotate when there's no local key.
    let existingSignedPrekey = await secureStore.getSignedPrekey(deviceId);
    let signedPrekeyResult;

    if (existingSignedPrekey && existingSignedPrekey.publicKey && existingSignedPrekey.privateKey) {
        // Re-sign the existing public key (the signature proves we still own the identity)
        const pubBytes = sodium.from_base64(existingSignedPrekey.publicKey);
        const signature = sodium.crypto_sign_detached(pubBytes, signingPrivateKey);
        signedPrekeyResult = {
            id: existingSignedPrekey.id,
            publicKey: existingSignedPrekey.publicKey,
            privateKey: existingSignedPrekey.privateKey,
            signature: sodium.to_base64(signature),
        };
    } else {
        // No valid signed prekey exists — create a fresh one
        const signedPrekey = sodium.crypto_box_keypair();
        const signedPrekeyId = Date.now();
        const signature = sodium.crypto_sign_detached(signedPrekey.publicKey, signingPrivateKey);

        signedPrekeyResult = {
            id: signedPrekeyId,
            publicKey: sodium.to_base64(signedPrekey.publicKey),
            privateKey: sodium.to_base64(signedPrekey.privateKey),
            signature: sodium.to_base64(signature),
        };

        await secureStore.setSignedPrekey(deviceId, {
            id: signedPrekeyId,
            publicKey: signedPrekeyResult.publicKey,
            privateKey: signedPrekeyResult.privateKey,
        });
    }

    // ── One-time prekeys: top up if the server is running low ──────────────
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
        signedPrekey: signedPrekeyResult,
        oneTimePreKeys
    }
}