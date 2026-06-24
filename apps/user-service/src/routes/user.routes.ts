import { Router } from "express";
import { acceptBuddyReqController, blockUserController, getAllRelationsController, getUserProfileController, rejectBuddyReqController, searchUserController, sendBuddyReqController, unblockUserController, updateUserProfileController } from "../controllers/user.controller";

const router = Router();

router.get('/search', searchUserController);
router.get('/buddies', getAllRelationsController);
router.get('/:id', getUserProfileController);
router.patch('/:id', updateUserProfileController);
router.post('/:id/buddy-request', sendBuddyReqController);
router.patch('/:id/buddy-request/accept', acceptBuddyReqController);
router.patch('/:id/buddy-request/reject', rejectBuddyReqController);
router.post('/:id/block', blockUserController);
router.delete('/:id/block', unblockUserController);

export default router;