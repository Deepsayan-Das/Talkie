import { DBSchema, IDBPDatabase, openDB } from "idb"
import { RatchetSession } from "../crypto/dhratchet";

interface IdentityKeyRecord {
    deviceId: string,
    publicKey: string,
    privateKey: string,
    signingPublicKey: string,
    signingPrivateKey: string,
    signedPrekeyId?: number,
    signedPrekeyPublic?: string,
    signedPrekeyPrivate?: string,
    signedPrekeySignature?: string,
    createdAt: Date
}

interface OneTimePreKeyRecord {
    id: number;
    publicKey: string;
    privateKey: string;
    createdAt: Date;
}

interface SignedPrekeyRecord {
    id: number;
    publicKey: string;
    privateKey: string;
    createdAt?: Date;
}

// interface RatchetState {
//     conversationId: string,
//     rootKey: string,
//     chainKey: string
//     //more feilds to be added later
// }

interface TalkieDB extends DBSchema {
    identityKeys: {
        key: string,
        value: IdentityKeyRecord
    },
    sessions: {
        key: string,
        value: RatchetSession
    },
    oneTimePrekeys: {
        key: number,
        value: OneTimePreKeyRecord
    },
    signedPrekeys: {
        key: string,
        value: SignedPrekeyRecord
    }
}

interface SecureStoreInterface {
    setIdentityKey: (key: string, value: IdentityKeyRecord) => Promise<void>
    getIdentityKey: (key: string) => Promise<IdentityKeyRecord | null>
    setSession: (key: string, value: RatchetSession) => Promise<void>
    getSession: (key: string) => Promise<RatchetSession | null>
    saveOneTimePrekeys: (keys: OneTimePreKeyRecord[]) => Promise<void>
    getOneTimePrekeysCount: () => Promise<number>
    getMaxOneTimePrekeyId: () => Promise<number>
    consumeOneTimePrekey: (keyId: number) => Promise<OneTimePreKeyRecord | null>
    getOneTimePrekey: (keyId: number) => Promise<OneTimePreKeyRecord | null>
    pruneUsedOneTimePrekeys: (activeKeyIds: number[]) => Promise<void>
    setSignedPrekey: (deviceId: string, value: SignedPrekeyRecord) => Promise<void>
    getSignedPrekey: (deviceId: string) => Promise<SignedPrekeyRecord | null>
}

class SecureStore implements SecureStoreInterface {
    private dbPromise: Promise<IDBPDatabase<TalkieDB>> | null = null;

    private async getDB(): Promise<IDBPDatabase<TalkieDB>> {
        if (typeof window === 'undefined') {
            throw new Error("IndexedDB is not available in SSR environments");
        }
        if (!this.dbPromise) {
            this.dbPromise = openDB<TalkieDB>(
                "talkie_db", 3, {
                upgrade(db, oldVersion) {
                    if (!db.objectStoreNames.contains("identityKeys")) {
                        db.createObjectStore("identityKeys")
                    }
                    if (!db.objectStoreNames.contains("sessions")) {
                        db.createObjectStore("sessions")
                    }
                    if (!db.objectStoreNames.contains("oneTimePrekeys")) {
                        db.createObjectStore("oneTimePrekeys", { keyPath: 'id' })
                    }
                    if (!db.objectStoreNames.contains("signedPrekeys")) {
                        db.createObjectStore("signedPrekeys")
                    }
                }
            }
            );
        }
        return this.dbPromise;
    }

    async getIdentityKey(deviceId: string): Promise<IdentityKeyRecord | null> {
        const db = await this.getDB();
        const res = await db.get("identityKeys", deviceId)
        return res ?? null
    }

    async setIdentityKey(deviceId: string, key: IdentityKeyRecord): Promise<void> {
        const db = await this.getDB();
        await db.put("identityKeys", key, deviceId)
    }

    async getSession(conversationId: string): Promise<RatchetSession | null> {
        const db = await this.getDB();
        const res = await db.get("sessions", conversationId);
        return res ?? null;
    }

    async setSession(conversationId: string, state: RatchetSession): Promise<void> {
        const db = await this.getDB();
        await db.put("sessions", state, conversationId);
    }

    async saveOneTimePrekeys(keys: OneTimePreKeyRecord[]): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction('oneTimePrekeys', 'readwrite');
        await Promise.all(keys.map(k => tx.store.put(k)));
        await tx.done;
    }

    async getOneTimePrekeysCount(): Promise<number> {
        const db = await this.getDB();
        return await db.count('oneTimePrekeys');
    }

    async getMaxOneTimePrekeyId(): Promise<number> {
        const db = await this.getDB();
        const cursor = await db.transaction('oneTimePrekeys', 'readonly').store.openCursor(null, 'prev');
        return cursor?.value.id ?? -1;
    }

    async consumeOneTimePrekey(keyId: number): Promise<OneTimePreKeyRecord | null> {
        const db = await this.getDB();
        const tx = db.transaction('oneTimePrekeys', 'readwrite');
        const key = await tx.store.get(keyId);
        if (key) {
            await tx.store.delete(keyId);
        }
        await tx.done;
        return key ?? null;
    }

    async getOneTimePrekey(keyId: number): Promise<OneTimePreKeyRecord | null> {
        const db = await this.getDB();
        const res = await db.get("oneTimePrekeys", keyId);
        return res ?? null;
    }

    async pruneUsedOneTimePrekeys(activeKeyIds: number[]): Promise<void> {
        const db = await this.getDB();
        const tx = db.transaction('oneTimePrekeys', 'readwrite');
        const activeSet = new Set(activeKeyIds);
        let cursor = await tx.store.openCursor();

        while (cursor) {
            if (!activeSet.has(cursor.value.id)) {
                await cursor.delete();
            }
            cursor = await cursor.continue();
        }
        await tx.done;
    }

    async getSignedPrekey(deviceId: string): Promise<SignedPrekeyRecord | null> {
        const db = await this.getDB();
        const res = await db.get("signedPrekeys", deviceId);
        return res ?? null;
    }

    async setSignedPrekey(deviceId: string, value: SignedPrekeyRecord): Promise<void> {
        const db = await this.getDB();
        await db.put("signedPrekeys", value, deviceId);
    }
}

export const secureStore = new SecureStore();
export type { IdentityKeyRecord, SignedPrekeyRecord };


