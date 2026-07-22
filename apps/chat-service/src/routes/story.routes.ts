import { Router } from "express";
import * as StoryController from "../controllers/story.controller";

const router = Router();

router.post("/", StoryController.createStory);
router.get("/feed", StoryController.getFeed);
router.get("/:id", StoryController.getStory);
router.delete("/:id", StoryController.deleteStory);
router.get("/:id/viewers", StoryController.getStoryViewers);

export default router;
