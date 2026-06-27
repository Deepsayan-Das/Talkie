import dotenv from "dotenv";
dotenv.config();

export const env = {
    port: process.env.PORT || 3005,
    mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/chat-app",

};