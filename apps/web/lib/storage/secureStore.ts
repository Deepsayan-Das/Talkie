import { DBSchema, IDBPDatabase, openDB } from "idb"

interface IdentityKeyRecord {
    deviceId: string,
    publicKeyId: string,
    privateKeyId: string,
    createdAt: Date
}

interface RatchetState {
    conversationId: string,
    rootKey: string,
    chainKey: string
    //more feilds to be added later
}

interface TalkieDB extends DBSchema {
    identityKeys: {
        key: string,
        value: IdentityKeyRecord
    },
    sessions: {
        key: string,
        value: RatchetState
    }
}

interface SecureStoreInterface {
    setIdentityKey: (key: string, value: IdentityKeyRecord) => Promise<void>
    getIdentityKey: (key: string) => Promise<IdentityKeyRecord | null>
    setSession: (key: string, value: RatchetState) => Promise<void>
    getSession: (key: string) => Promise<RatchetState | null>
}

class SecureStore implements SecureStoreInterface {
    private dbPromise: Promise<IDBPDatabase<TalkieDB>> = openDB<TalkieDB>(
        "talkie_db", 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains("identityKeys")) {
                db.createObjectStore("identityKeys")
            }
            if (!db.objectStoreNames.contains("sessions")) {
                db.createObjectStore("sessions")
            }
        }
    }
    )

    async getIdentityKey(deviceId: string): Promise<IdentityKeyRecord | null> {
        const db = await this.dbPromise;
        const res = await db.get("identityKeys", deviceId)
        return res ?? null
    }

    async setIdentityKey(deviceId: string, key: IdentityKeyRecord): Promise<void> {
        const db = await this.dbPromise
        await db.put("identityKeys", key, deviceId)
    }

    async getSession(conversationId: string): Promise<RatchetState | null> {
        const db = await this.dbPromise;
        const res = await db.get("sessions", conversationId);
        return res ?? null;
    }

    async setSession(conversationId: string, state: RatchetState): Promise<void> {
        const db = await this.dbPromise;
        await db.put("sessions", state, conversationId);
    }


}

export const secureStore = new SecureStore();
export type { RatchetState, IdentityKeyRecord };


