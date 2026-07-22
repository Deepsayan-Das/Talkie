import { secureStore } from "../storage/secureStore";
import { ratchetOnSend, ratchetOnReceive } from "./dhratchet";
import { api } from "../api";
import { initiateSession, receiveSession, initiateSessionForDevice } from "./x3dh";
import { encryptMessage, decryptWithCatchUp } from "./ratchet";
import { getOrCreateDeviceId } from "./identity";
import type { ChatMessage } from "../chat";
import sodium from "libsodium-wrappers";

export async function sendEncryptedMessage(
    recipientUserId: string,
    recipientDeviceId: string,
    myDeviceId: string,
    plaintext: string
) {
    await sodium.ready;

    // Self-encryption (bypassing ratchet)
    if (recipientDeviceId === myDeviceId) {
        const myIdentity = await secureStore.getIdentityKey(myDeviceId);
        if (!myIdentity) throw new Error("No identity key found for self-encryption");
        
        const selfKey = sodium.crypto_generichash(32, sodium.from_base64(myIdentity.privateKey), null);
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
        const ciphertext = sodium.crypto_secretbox_easy(sodium.from_string(plaintext), nonce, selfKey);
        
        return {
            ciphertext: sodium.to_base64(ciphertext),
            nonce: sodium.to_base64(nonce),
            messageIndex: -1,
            myRatchetPub: 'SELF',
            x3dhInit: null
        };
    }

    let session = await secureStore.getSession(recipientDeviceId);
    let x3dhInit = null;

    if (!session) {
        // First message ever to this device — do X3DH first for this specific device.
        const res = await api.get(`/keys/${recipientUserId}/devices/${recipientDeviceId}/bundle`);
        const bundle = res.data.bundle;
        const result = await initiateSessionForDevice(myDeviceId, bundle);
        session = await secureStore.getSession(recipientDeviceId);
        x3dhInit = result.x3dhInit;
    } else if (!session.theirRatchetPub && session.x3dhInit) {
        // Recipient has not turned the ratchet back to us yet — continue sending x3dhInit until they reply
        x3dhInit = session.x3dhInit;
    }

    if (!session) {
        throw new Error(`Failed to initiate session for device ${recipientDeviceId}`);
    }

    if (!session.sendChainKey) {
        // I have no send chain yet — must be replying for the first time. Turn the ratchet.
        session = await ratchetOnSend(session);
        await secureStore.setSession(recipientDeviceId, session);
    }

    if (!session.sendChainKey) {
        throw new Error("Send chain key is missing after ratchet turn");
    }

    const { ciphertext, nonce, messageIndex, nextChainKey } =
        await encryptMessage(session.sendChainKey, plaintext, session.sendIndex);

    session.sendChainKey = nextChainKey;
    session.sendIndex += 1;
    await secureStore.setSession(recipientDeviceId, session);

    return {
        ciphertext,
        nonce,
        messageIndex,
        myRatchetPub: session.myRatchetPub,
        x3dhInit,
    };
}

export async function receiveEncryptedMessage(
    myDeviceId: string,
    senderKey: string,
    payload: {
        ciphertext: string;
        nonce: string;
        messageIndex: number;
        myRatchetPub: string;
        x3dhInit?: any;
    }
) {
    await sodium.ready;

    // Self-decryption (bypassed ratchet)
    if (payload.myRatchetPub === 'SELF') {
        const myIdentity = await secureStore.getIdentityKey(myDeviceId);
        if (!myIdentity) throw new Error("No identity key found for self-decryption");
        
        const selfKey = sodium.crypto_generichash(32, sodium.from_base64(myIdentity.privateKey), null);
        const plaintext = sodium.crypto_secretbox_open_easy(
            sodium.from_base64(payload.ciphertext),
            sodium.from_base64(payload.nonce),
            selfKey
        );
        return sodium.to_string(plaintext);
    }

    let session = await secureStore.getSession(senderKey);

    if (!session) {
        if (!payload.x3dhInit) {
            throw new Error("No session found and no X3DH initialization payload provided");
        }
        await receiveSession(myDeviceId, senderKey, payload.x3dhInit);
        session = await secureStore.getSession(senderKey);
    }

    if (!session) {
        throw new Error("Failed to retrieve session after X3DH initialization");
    }

    // Did they turn to a NEW ratchet pub since last time? → I must turn too.
    if (payload.myRatchetPub !== session.theirRatchetPub) {
        session = await ratchetOnReceive(session, payload.myRatchetPub);
    }

    if (!session.recvChainKey) {
        throw new Error("No receive chain key available for decryption");
    }

    // Adapt session fields to match structure expected by decryptWithCatchUp
    const tempSession = {
        chainKey: session.recvChainKey,
        nextExpectedIndex: session.recvIndex,
        skippedKeys: session.skippedKeys,
    };

    const { plaintext, updatedSession } = await decryptWithCatchUp(
        tempSession,
        payload.messageIndex,
        payload.ciphertext,
        payload.nonce
    );

    session.recvChainKey = updatedSession.chainKey;
    session.recvIndex = updatedSession.nextExpectedIndex;
    session.skippedKeys = updatedSession.skippedKeys;

    await secureStore.setSession(senderKey, session);
    return plaintext;
}

export async function decryptIncomingMessage(msg: ChatMessage): Promise<ChatMessage> {
    const cached = await secureStore.getCachedMessage(msg._id);
    if (cached !== null) {
        // Merge network metadata (like reactions, seenBy) with cached content
        const updatedMsg = { ...msg, content: cached.content };
        await secureStore.setCachedMessage(updatedMsg).catch(console.error);
        return updatedMsg;
    }

    if (!msg.deviceCiphertexts || msg.isDeleted) {
        return msg;
    }

    const myDeviceId = getOrCreateDeviceId();
    const payload = msg.deviceCiphertexts[myDeviceId];

    if (!payload) {
        return {
            ...msg,
            content: '[Encrypted for another device]',
        };
    }

    try {
        const senderKey = msg.senderDeviceId || msg.senderId;
        const decryptedContent = await receiveEncryptedMessage(myDeviceId, senderKey, payload);
        const fullyDecrypted = { ...msg, content: decryptedContent };
        
        // Cache the fully decrypted message object (handles sender and receiver paths when echoed back)
        await secureStore.setCachedMessage(fullyDecrypted).catch(console.error);
        
        return fullyDecrypted;
    } catch (err: any) {
        console.error('Failed to decrypt message:', err);
        return {
            ...msg,
            content: '[Failed to decrypt message]',
        };
    }
}

// ─── Binary blob E2EE (for audio/file encryption) ─────────────────────────────
// Uses a random symmetric key encrypted per-message. The key is embedded in the
// encrypted text content so existing E2EE ratchet protects it automatically.

export async function encryptBlob(data: Uint8Array): Promise<{
    encryptedBlob: Uint8Array;
    blobKeyB64: string;
    blobNonceB64: string;
}> {
    await sodium.ready;
    const key = sodium.randombytes_buf(sodium.crypto_secretbox_KEYBYTES);
    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const encryptedBlob = sodium.crypto_secretbox_easy(data, nonce, key);
    return {
        encryptedBlob,
        blobKeyB64: sodium.to_base64(key),
        blobNonceB64: sodium.to_base64(nonce),
    };
}

export async function decryptBlob(
    encryptedData: Uint8Array,
    blobKeyB64: string,
    blobNonceB64: string
): Promise<Uint8Array> {
    await sodium.ready;
    const key = sodium.from_base64(blobKeyB64);
    const nonce = sodium.from_base64(blobNonceB64);
    return sodium.crypto_secretbox_open_easy(encryptedData, nonce, key);
}