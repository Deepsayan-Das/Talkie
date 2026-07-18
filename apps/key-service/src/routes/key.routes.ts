import { Router } from "express";
import { 
    registerKeysController, 
    getUnusedCountController, 
    getBundlesForUserController,
    getDevicesForUserController,
    getBundleForDeviceController
} from "../controllers/key.controller";

const router = Router();

router.post("/register", registerKeysController);
router.get("/:deviceId/unused-count", getUnusedCountController);
router.get("/:userId/bundle", getBundlesForUserController);
router.get("/:userId/devices", getDevicesForUserController);
router.get("/:userId/devices/:deviceId/bundle", getBundleForDeviceController);

export default router;
