import { Request, Response } from "express";
import * as KeyService from "../services/key.service";
import * as KeyRepository from "../repositories/key.repository";

export const registerKeysController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { deviceId, identityPublicKey, signingPublicKey, signedPrekey, oneTimePrekeys } = req.body;

        if (!deviceId || !identityPublicKey || !signingPublicKey || !signedPrekey || !oneTimePrekeys) {
            return res.status(400).json({ success: false, message: "Missing required key material" });
        }

        await KeyService.registerKeys(
            userId,
            deviceId,
            identityPublicKey,
            signingPublicKey,
            signedPrekey,
            oneTimePrekeys
        );

        return res.status(200).json({ success: true, message: "Keys registered successfully" });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getUnusedCountController = async (req: Request, res: Response) => {
    try {
        const userId = req.headers["x-user-id"] as string;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const { deviceId } = req.params;
        if (!deviceId) {
            return res.status(400).json({ success: false, message: "Device ID required" });
        }
        
        const result = await KeyService.getUnusedOtkCount(userId, deviceId);
        return res.status(200).json({ success: true, count: result.count, keyIds: result.keyIds });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET /keys/:userId/bundle
 *
 * Returns one key bundle per registered device for the given userId.
 * Each bundle atomically claims one unused OTK (FOR UPDATE SKIP LOCKED),
 * so concurrent callers targeting the same user cannot receive the same key.
 *
 * Response shape:
 *   200  { success: true,  bundles: Bundle[] }   — ≥0 bundles (empty array if no devices)
 *   400  { success: false, message: string }      — missing userId param
 *   500  { success: false, message: string }      — unexpected server error
 */
export const getBundlesForUserController = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        if (!userId || userId.trim() === "") {
            return res.status(400).json({ success: false, message: "userId param is required" });
        }

        const bundles = await KeyRepository.getBundlesForUser(userId.trim());

        // Empty array is a valid response — the user exists but has no registered devices yet.
        return res.status(200).json({ success: true, bundles });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getDevicesForUserController = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;

        if (!userId || userId.trim() === "") {
            return res.status(400).json({ success: false, message: "userId param is required" });
        }

        const devices = await KeyRepository.getDevicesForUser(userId.trim());
        return res.status(200).json({ success: true, devices });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getBundleForDeviceController = async (req: Request, res: Response) => {
    try {
        const { userId, deviceId } = req.params;

        if (!userId || userId.trim() === "" || !deviceId || deviceId.trim() === "") {
            return res.status(400).json({ success: false, message: "userId and deviceId params are required" });
        }

        const bundle = await KeyRepository.getBundleForDevice(userId.trim(), deviceId.trim());
        if (!bundle) {
            return res.status(404).json({ success: false, message: "Device not found" });
        }
        return res.status(200).json({ success: true, bundle });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
