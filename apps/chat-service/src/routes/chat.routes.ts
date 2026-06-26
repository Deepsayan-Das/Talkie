import { Router } from "express";
import { createRoomController, getRoomsController, getRoomByIdController, updateGroupController, deleteRoomController, addMemberController, removeMemberController, promoteMemberController, demoteMemberController, getMessagesController } from "../controllers/chat.controller";

const router = Router();

router.post('/room', createRoomController)
router.get('/room', getRoomsController)
router.get('/room/:roomId', getRoomByIdController)
router.patch('/room/:roomId', updateGroupController)
router.delete('/room/:roomId', deleteRoomController)
router.post('/room/:roomId/member', addMemberController)
router.delete('/room/:roomId/member', removeMemberController)
router.patch('/room/:roomId/member/:memberId/promote', promoteMemberController)
router.patch('/room/:roomId/member/:memberId/demote', demoteMemberController)
router.get('/room/:roomId/messages', getMessagesController)

export default router