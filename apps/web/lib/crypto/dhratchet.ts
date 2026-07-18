import sodium from 'libsodium-wrappers';

export interface RatchetSession {
    rootKey: string;
    myRatchetPriv: string;
    myRatchetPub: string;
    theirRatchetPub: string | null; // null until they reply once
    sendChainKey: string | null;
    recvChainKey: string | null;
    sendIndex: number;
    recvIndex: number;
    skippedKeys: Record<number, string>;
}

// One DH step + KDF, mixing into the root key. Same trick as X3DH, reused.
function turnRatchet(rootKeyB64: string, myPriv: Uint8Array, theirPub: Uint8Array) {
    const dhOut = sodium.crypto_scalarmult(myPriv, theirPub);
    const combined = new Uint8Array([...sodium.from_base64(rootKeyB64), ...dhOut]);
    const hash = sodium.crypto_generichash(64, combined, null); // 64 bytes = split into two 32-byte keys
    return {
        newRootKey: sodium.to_base64(hash.slice(0, 32)),
        newChainKey: sodium.to_base64(hash.slice(32, 64)),
    };
}

// Call this the FIRST time I need to send, after receiving their ratchet pub key.
export async function ratchetOnSend(session: RatchetSession): Promise<RatchetSession> {
    await sodium.ready;
    if (!session.theirRatchetPub) throw new Error('No peer ratchet key yet');

    // Fresh keypair for MY side of this turn.
    const kp = sodium.crypto_box_keypair();
    const { newRootKey, newChainKey } = turnRatchet(
        session.rootKey,
        kp.privateKey,
        sodium.from_base64(session.theirRatchetPub)
    );

    return {
        ...session,
        rootKey: newRootKey,
        myRatchetPriv: sodium.to_base64(kp.privateKey),
        myRatchetPub: sodium.to_base64(kp.publicKey),
        sendChainKey: newChainKey,
        sendIndex: 0,
    };
}

// Call this when I receive a message carrying a NEW ratchet pub key from them.
export async function ratchetOnReceive(session: RatchetSession, theirNewRatchetPub: string): Promise<RatchetSession> {
    await sodium.ready;
    const { newRootKey, newChainKey } = turnRatchet(
        session.rootKey,
        sodium.from_base64(session.myRatchetPriv),
        sodium.from_base64(theirNewRatchetPub)
    );

    return {
        ...session,
        rootKey: newRootKey,
        theirRatchetPub: theirNewRatchetPub,
        recvChainKey: newChainKey,
        recvIndex: 0,
        skippedKeys: {}, // old chain's skipped keys are irrelevant now — new chain, new keys
    };
}