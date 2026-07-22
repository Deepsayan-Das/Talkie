import { api } from "./api";

export async function getIceServer() {
    try {
        const res = await api.get('/chat/turn-credentials')
        return res.data.iceServers
    } catch (err) {
        console.log("Something went wrong,try again", err)
    }
}