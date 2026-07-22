import dotenv from "dotenv";
dotenv.config();

export const env = {
    port: process.env.PORT || 3005,
    mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/chat-app",
    meteredDomain: process.env.METERED_DOMAIN || "__talkie__.metered.live",
    meteredSecretKey: process.env.METERED_SECRET_KEY || "HFdpqHFQ39Lcdjd5QehbLSK0BtIzBw9AWFe3igBpUnaIco3Q",
    userServiceUrl: process.env.USER_SERVICE_URL || "http://localhost:3002",
};
