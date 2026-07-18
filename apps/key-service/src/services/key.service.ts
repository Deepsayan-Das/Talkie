import * as KeyRepository from "../repositories/key.repository";

export const registerKeys = async (
    userId: string,
    deviceId: string,
    identityPublicKey: string,
    signingPublicKey: string,
    signedPrekey: { id: number; publicKey: string; signature: string },
    oneTimePrekeys: { keyId: number; publicKey: string }[]
) => {
    // Upsert the main identity and signed prekey
    await KeyRepository.upsertUserKey({
        userId,
        deviceId,
        identityPublicKey,
        signingPublicKey,
        signedPrekeyId: signedPrekey.id,
        signedPrekeyPub: signedPrekey.publicKey,
        signedPrekeySignature: signedPrekey.signature,
    });

    // Upsert the one time prekeys
    const otkPayloads = oneTimePrekeys.map((otk) => ({
        userId,
        deviceId,
        keyId: otk.keyId,
        publicKey: otk.publicKey,
    }));
    await KeyRepository.upsertOneTimePrekeys(otkPayloads);
};

export const getUnusedOtkCount = async (userId: string, deviceId: string) => {
    return await KeyRepository.getUnusedOtkCount(userId, deviceId);
};
