/**
 * test-x3dh.ts
 *
 * Simulates a full X3DH key exchange between Alice and Bob using
 * initiateSession and receiveSession, verifying that both parties
 * compute the exact same shared secret byte-for-byte.
 *
 * Run from apps/web folder:
 *   npx ts-node --project tsconfig.json lib/crypto/test-x3dh.ts
 */

// 1. Mock global browser APIs before importing any modules
const dummyStorage = {
    getItem: () => null,
    setItem: () => null,
    removeItem: () => null,
    clear: () => null,
    length: 0,
    key: () => null,
};

global.window = {} as any;
global.localStorage = dummyStorage;
global.sessionStorage = dummyStorage;

// Resolve Next.js '@/' path alias under Node.js compiled CommonJS environment
import path from "path";
const Module = require("module");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request: string, parent: any, isMain: boolean) {
    if (request.startsWith("@/")) {
        const targetDir = path.resolve(__dirname, "..", "..");
        request = request.replace("@/", targetDir + "/");
    }
    return originalResolveFilename.call(this, request, parent, isMain);
};

// Mock the 'idb' module completely so it doesn't try to access global IndexedDB in Node environment
const mockIdb = {
    openDB: async () => ({
        objectStoreNames: { contains: () => true },
        createObjectStore: () => {}
    })
};
require.cache[require.resolve("idb")] = {
    id: require.resolve("idb"),
    filename: require.resolve("idb"),
    loaded: true,
    exports: mockIdb
} as any;

import sodium from "libsodium-wrappers";
import { secureStore } from "../storage/secureStore";
import { api } from "../api";
import { initiateSession, receiveSession } from "./x3dh";

// ─── Main Test Logic ─────────────────────────────────────────────────────────

async function runTest() {
    await sodium.ready;
    console.log("Libsodium ready.");

    // Generate keys for Alice (Sender)
    const aliceIdentity = sodium.crypto_box_keypair();
    const aliceSigning = sodium.crypto_sign_keypair();

    // Generate keys for Bob (Recipient)
    const bobIdentity = sodium.crypto_box_keypair();
    const bobSigning = sodium.crypto_sign_keypair();
    const bobSignedPrekey = sodium.crypto_box_keypair();
    const bobOtk = sodium.crypto_box_keypair();
    const bobOtkId = 999;

    // Devices & IDs
    const aliceDeviceId = "alice-device-123";
    const bobDeviceId = "bob-device-456";
    const bobUserId = "bob-user-id";

    // Store maps for our mock storage
    const identityStore = new Map<string, any>();
    const signedPrekeyStore = new Map<string, any>();
    const sessionStore = new Map<string, any>();
    const otkStore = new Map<number, any>();

    // Seed Alice's local store
    identityStore.set(aliceDeviceId, {
        deviceId: aliceDeviceId,
        publicKey: sodium.to_base64(aliceIdentity.publicKey),
        privateKey: sodium.to_base64(aliceIdentity.privateKey),
        signingPublicKey: sodium.to_base64(aliceSigning.publicKey),
        signingPrivateKey: sodium.to_base64(aliceSigning.privateKey),
        createdAt: new Date(),
    });

    // Seed Bob's local store
    identityStore.set(bobDeviceId, {
        deviceId: bobDeviceId,
        publicKey: sodium.to_base64(bobIdentity.publicKey),
        privateKey: sodium.to_base64(bobIdentity.privateKey),
        signingPublicKey: sodium.to_base64(bobSigning.publicKey),
        signingPrivateKey: sodium.to_base64(bobSigning.privateKey),
        createdAt: new Date(),
    });
    signedPrekeyStore.set(bobDeviceId, {
        id: 777,
        publicKey: sodium.to_base64(bobSignedPrekey.publicKey),
        privateKey: sodium.to_base64(bobSignedPrekey.privateKey),
    });
    otkStore.set(bobOtkId, {
        id: bobOtkId,
        publicKey: sodium.to_base64(bobOtk.publicKey),
        privateKey: sodium.to_base64(bobOtk.privateKey),
        createdAt: new Date(),
    });

    // ─── Mock Secure Store ─────────────────────────────────────────────────────
    secureStore.getIdentityKey = async (deviceId: string) => {
        return identityStore.get(deviceId) || null;
    };
    secureStore.getSignedPrekey = async (deviceId: string) => {
        return signedPrekeyStore.get(deviceId) || null;
    };
    secureStore.getOneTimePrekey = async (keyId: number) => {
        return otkStore.get(keyId) || null;
    };
    secureStore.setSession = async (conversationId: string, state: any) => {
        sessionStore.set(conversationId, state);
    };
    secureStore.getSession = async (conversationId: string) => {
        return sessionStore.get(conversationId) || null;
    };

    // ─── Mock API ─────────────────────────────────────────────────────────────
    // Stub the network request where Alice fetches Bob's E2EE bundle from the server
    api.get = async (url: string): Promise<any> => {
        if (url.includes(`/keys/${bobUserId}/bundle`)) {
            return {
                data: {
                    bundles: [
                        {
                            deviceId: bobDeviceId,
                            identityPublicKey: sodium.to_base64(bobIdentity.publicKey),
                            signingPublicKey: sodium.to_base64(bobSigning.publicKey),
                            signedPrekey: {
                                id: 777,
                                publicKey: sodium.to_base64(bobSignedPrekey.publicKey),
                                signature: "mock-signature-here",
                            },
                            oneTimePrekey: {
                                keyId: bobOtkId,
                                publicKey: sodium.to_base64(bobOtk.publicKey),
                            },
                        },
                    ],
                },
            };
        }
        throw new Error(`Unexpected Mock API GET call: ${url}`);
    };

    console.log("Mocking completed. Simulating key exchange...");

    // ─── Step 1: Alice initiates the session ─────────────────────────────────
    console.log("\n[Alice] Running initiateSession...");
    const sessions = await initiateSession(bobUserId, aliceDeviceId);
    
    if (sessions.length === 0) {
        throw new Error("No sessions returned by initiateSession!");
    }

    const aliceSessionResult = sessions[0];
    const aliceStoredSession = await secureStore.getSession(bobDeviceId);
    
    if (!aliceStoredSession) {
        throw new Error("Alice's computed session was not saved in secureStore!");
    }
    const aliceRootKey = aliceStoredSession.rootKey;

    console.log("Alice's x3dhInit payload to send:", JSON.stringify(aliceSessionResult.x3dhInit, null, 2));
    console.log("Alice's calculated rootKey (Base64):", aliceRootKey);

    // ─── Step 2: Bob receives the session init payload ────────────────────────
    console.log("\n[Bob] Running receiveSession with Alice's payload...");
    await receiveSession(bobDeviceId, aliceDeviceId, aliceSessionResult.x3dhInit);
    
    // Retrieve Bob's stored session
    const bobStoredSession = await secureStore.getSession(aliceDeviceId);
    if (!bobStoredSession) {
        throw new Error("Bob's computed session was not saved in secureStore!");
    }
    const bobRootKey = bobStoredSession.rootKey;

    console.log("Bob's calculated rootKey (Base64):  ", bobRootKey);

    // ─── Step 3: Compare Results ─────────────────────────────────────────────
    console.log("\n════════════════════════════════════════════════════════════");
    if (aliceRootKey === bobRootKey) {
        console.log("✅ SUCCESS: Alice's and Bob's computed rootKeys match byte-for-byte!");
        console.log("   Shared secret:", aliceRootKey);
    } else {
        console.error("❌ FAILURE: Root key mismatch!");
        console.error("   Alice got:", aliceRootKey);
        console.error("   Bob got:  ", bobRootKey);
    }
    console.log("════════════════════════════════════════════════════════════\n");

    process.exit(aliceRootKey === bobRootKey ? 0 : 1);
}

runTest().catch(err => {
    console.error("Test failed with error:", err);
    process.exit(1);
});
