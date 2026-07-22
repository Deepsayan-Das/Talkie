import express, { Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import keyRoutes from "./routes/key.routes";
import { errorMiddleware } from "./middleware/error.middleware";

export const app: Express = express();

// Key material must never be cached — each bundle request claims one-time prekeys
app.disable('etag');
app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(helmet());
app.use(morgan("dev"));

app.use("/keys", keyRoutes);

app.use(errorMiddleware);
