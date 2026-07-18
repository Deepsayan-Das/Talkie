import express, { Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import keyRoutes from "./routes/key.routes";
import { errorMiddleware } from "./middleware/error.middleware";

export const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(morgan("dev"));

app.use("/keys", keyRoutes);

app.use(errorMiddleware);
