import { Router } from "express";
import {
    loginController,
    logoutController,
    registerController,
    resendVerificationMailController,
    rotateTokensController,
    verifyUserController
} from "../controllers/auth.controller";

const authRouter = Router();

authRouter.post('/register', registerController);
authRouter.post('/login', loginController);
authRouter.get('/verify/:token', verifyUserController);
authRouter.post('/resend-verification', resendVerificationMailController);
authRouter.post('/rotate-tokens', rotateTokensController);
authRouter.post('/logout', logoutController);

export default authRouter;