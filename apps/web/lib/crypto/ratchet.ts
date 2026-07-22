// lib/crypto/ratchet.ts
import sodium from 'libsodium-wrappers';

export function ratchetStep(chainKey: Uint8Array) {
    const messageKey = sodium.crypto_generichash(32, new Uint8Array([...chainKey, 1]), null);
    const nextChainKey = sodium.crypto_generichash(32, new Uint8Array([...chainKey, 2]), null);
    return { messageKey, nextChainKey };
}

export async function encryptMessage(chainKeyB64: string, plaintext: string, messageIndex: number) {
    await sodium.ready;
    const chainKey = sodium.from_base64(chainKeyB64);
    const { messageKey, nextChainKey } = ratchetStep(chainKey);

    const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = sodium.crypto_secretbox_easy(sodium.from_string(plaintext), nonce, messageKey);

    return {
        ciphertext: sodium.to_base64(ciphertext),
        nonce: sodium.to_base64(nonce),
        messageIndex,
        nextChainKey: sodium.to_base64(nextChainKey),
    };
}


// lib/crypto/ratchet.ts (extended)

// Advances the chain N steps, returns keys for EVERY step along the way —
// not just the final one. This is what lets us "catch up."
function advanceChain(chainKey: Uint8Array, steps: number) {
    const keys: { index: number; messageKey: Uint8Array }[] = [];
    let current = chainKey;
    for (let i = 0; i < steps; i++) {
        const { messageKey, nextChainKey } = ratchetStep(current);
        keys.push({ index: i, messageKey });
        current = nextChainKey;
    }
    return { keys, finalChainKey: current };
}

export async function decryptWithCatchUp(
    session: { chainKey: string; nextExpectedIndex: number; skippedKeys: Record<number, string> },
    messageIndex: number,
    ciphertextB64: string,
    nonceB64: string
) {
    await sodium.ready;

    // Case 1: we already had this key saved from an earlier "skip ahead" — a late arrival.
    if (session.skippedKeys[messageIndex]) {
        const messageKey = sodium.from_base64(session.skippedKeys[messageIndex]);
        const plaintext = sodium.crypto_secretbox_open_easy(
            sodium.from_base64(ciphertextB64), sodium.from_base64(nonceB64), messageKey
        );
        delete session.skippedKeys[messageIndex]; // used once, discard — it WAS one-time
        return { plaintext: sodium.to_string(plaintext), updatedSession: session };
    }

    // Case 2: this message is AHEAD of where we expected — skip forward, saving the gap keys.
    const stepsNeeded = messageIndex - session.nextExpectedIndex + 1;
    if (stepsNeeded < 1) throw new Error(`Ratchet desync: message index ${messageIndex} is behind chain position ${session.nextExpectedIndex} — likely already decrypted`);

    const { keys, finalChainKey } = advanceChain(sodium.from_base64(session.chainKey), stepsNeeded);

    const targetKey = keys[keys.length - 1].messageKey; // the one we actually need right now
    const plaintext = sodium.crypto_secretbox_open_easy(
        sodium.from_base64(ciphertextB64), sodium.from_base64(nonceB64), targetKey
    );

    // Save the SKIPPED ones (everything except the last) for later, in case they arrive late.
    for (const { index, messageKey } of keys.slice(0, -1)) {
        session.skippedKeys[session.nextExpectedIndex + index] = sodium.to_base64(messageKey);
    }

    session.chainKey = sodium.to_base64(finalChainKey);
    session.nextExpectedIndex = messageIndex + 1;

    return { plaintext: sodium.to_string(plaintext), updatedSession: session };
}