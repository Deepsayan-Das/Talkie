/**
 * test-messaging.ts
 *
 * Simulates a full X3DH + Double Ratchet message exchange between Alice and Bob,
 * verifying session initialization, message sending/receiving, key ratcheting,
 * and out-of-order delivery (skipped keys/catch-up).
 *
 * Run from apps/web folder:
 *   npx ts-node --project tsconfig.json lib/crypto/test-messaging.ts
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
import { sendEncryptedMessage, receiveEncryptedMessage } from "./messaging";

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
    const aliceIdentityPubB64 = sodium.to_base64(aliceIdentity.publicKey);

    // Store maps for our mock storage
    const identityStore = new Map<string, any>();
    const signedPrekeyStore = new Map<string, any>();
    const sessionStore = new Map<string, any>();
    const otkStore = new Map<number, any>();

    // Seed Alice's local store
    identityStore.set(aliceDeviceId, {
        deviceId: aliceDeviceId,
        publicKey: aliceIdentityPubB64,
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

    // Mock Secure Store
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
        sessionStore.set(conversationId, JSON.parse(JSON.stringify(state))); // Deep copy to prevent reference sharing
    };
    secureStore.getSession = async (conversationId: string) => {
        const session = sessionStore.get(conversationId);
        return session ? JSON.parse(JSON.stringify(session)) : null; // Deep copy to simulate storage retrieval
    };

    // Mock API
    api.get = async (url: string): Promise<any> => {
        if (url.includes(`/devices/${bobDeviceId}/bundle`)) {
            return {
                data: {
                    bundle: {
                        deviceId: bobDeviceId,
                        identityPublicKey: sodium.to_base64(bobIdentity.publicKey),
                        signingPublicKey: sodium.to_base64(bobSigning.publicKey),
                        signedPrekey: {
                            id: 777,
                            publicKey: sodium.to_base64(bobSignedPrekey.publicKey),
                            signature: "mock-signature",
                        },
                        oneTimePrekey: {
                            keyId: bobOtkId,
                            publicKey: sodium.to_base64(bobOtk.publicKey),
                        },
                    }
                }
            };
        }
        if (url.includes(`/devices/${aliceDeviceId}/bundle`)) {
            return {
                data: {
                    bundle: {
                        deviceId: aliceDeviceId,
                        identityPublicKey: aliceIdentityPubB64,
                        signingPublicKey: sodium.to_base64(aliceSigning.publicKey),
                        signedPrekey: {
                            id: 888,
                            publicKey: aliceIdentityPubB64,
                            signature: "mock-signature",
                        },
                        oneTimePrekey: null
                    }
                }
            };
        }
        throw new Error(`Unexpected Mock API call: ${url}`);
    };

    console.log("Mocking complete. Simulating conversation...");

    // ─── STEP 1: Alice sends first message to Bob ────────────────────────────
    console.log("\n[Alice] Sending first message to Bob...");
    const msg1Payload = await sendEncryptedMessage(
        bobUserId,
        bobDeviceId,
        aliceDeviceId,
        "Hello Bob!"
    );
    console.log("Alice's outgoing payload:", JSON.stringify(msg1Payload, null, 2));

    // ─── STEP 2: Bob receives and decrypts Alice's first message ─────────────
    console.log("\n[Bob] Receiving Alice's first message...");
    const bobDecrypted1 = await receiveEncryptedMessage(
        bobDeviceId,
        aliceDeviceId,
        msg1Payload
    );
    console.log("Bob decrypted message 1:", bobDecrypted1);
    if (bobDecrypted1 !== "Hello Bob!") {
        throw new Error("Failed to decrypt Alice's first message!");
    }
    console.log("✅ Alice -> Bob (First Message & X3DH initialization) succeeded.");

    // ─── STEP 3: Bob replies to Alice ────────────────────────────────────────
    console.log("\n[Bob] Replying to Alice...");
    const msg2Payload = await sendEncryptedMessage(
        "alice-user-id", // Not strictly used for local-only, but mock expects recipientUserId
        aliceDeviceId,
        bobDeviceId,
        "Hi Alice!"
    );
    console.log("Bob's outgoing payload:", JSON.stringify(msg2Payload, null, 2));

    // ─── STEP 4: Alice receives and decrypts Bob's reply ─────────────────────
    console.log("\n[Alice] Receiving Bob's reply...");
    const aliceDecrypted2 = await receiveEncryptedMessage(
        aliceDeviceId,
        bobDeviceId,
        msg2Payload
    );
    console.log("Alice decrypted message 2:", aliceDecrypted2);
    if (aliceDecrypted2 !== "Hi Alice!") {
        throw new Error("Failed to decrypt Bob's reply!");
    }
    console.log("✅ Bob -> Alice (Reply & RatchetOnSend/Receive) succeeded.");

    // ─── STEP 5: Alice sends multiple messages and we test out-of-order delivery ──
    console.log("\n[Alice] Sending Message 3 to Bob...");
    const msg3Payload = await sendEncryptedMessage(
        bobUserId,
        bobDeviceId,
        aliceDeviceId,
        "Are you there?"
    );

    console.log("[Alice] Sending Message 4 to Bob...");
    const msg4Payload = await sendEncryptedMessage(
        bobUserId,
        bobDeviceId,
        aliceDeviceId,
        "Hello??"
    );

    console.log("\n[Bob] Simulating receiving Message 4 BEFORE Message 3 (Out of order)...");
    const bobDecrypted4 = await receiveEncryptedMessage(
        bobDeviceId,
        aliceDeviceId,
        msg4Payload
    );
    console.log("Bob decrypted message 4:", bobDecrypted4);
    if (bobDecrypted4 !== "Hello??") {
        throw new Error("Failed to decrypt Bob's message 4 out-of-order!");
    }
    console.log("✅ Bob received message 4 first successfully.");

    console.log("\n[Bob] Simulating receiving Message 3 LATE (using skipped keys)...");
    const bobDecrypted3 = await receiveEncryptedMessage(
        bobDeviceId,
        aliceDeviceId,
        msg3Payload
    );
    console.log("Bob decrypted message 3:", bobDecrypted3);
    if (bobDecrypted3 !== "Are you there?") {
        throw new Error("Failed to decrypt Bob's late message 3!");
    }
    console.log("✅ Bob received message 3 late successfully.");

    console.log("\n════════════════════════════════════════════════════════════");
    console.log("🎉 ALL TESTS PASSED: Double Ratchet & X3DH Messaging Flow works flawlessly!");
    console.log("════════════════════════════════════════════════════════════\n");

    process.exit(0);
}

runTest().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
