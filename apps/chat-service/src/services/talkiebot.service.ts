import { Server } from "socket.io";
import * as MessageRepository from "../repositories/message.repository";
import * as RoomRepository from "../repositories/room.repository";
import logger from "../config/logger";

export const TALKIE_BOT_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Determines whether @TalkieBot should process and reply to a message.
 * - In Direct Messages (kind === 'dm'): replies to all messages from the other user.
 * - In Group Chats (kind === 'group'): ONLY replies if message contains '@talkiebot' or replies to a @TalkieBot message.
 */
export const shouldTriggerTalkieBot = async (message: any, room: any): Promise<boolean> => {
    // 1. Never reply to own messages
    if (!message || message.senderId === TALKIE_BOT_ID) {
        return false;
    }

    // 2. Check if TalkieBot is a member of the room
    const isBotMember = room?.members?.some((m: any) => m.userId === TALKIE_BOT_ID);
    if (!isBotMember) {
        return false;
    }

    // 3. Direct Message room: respond to everything
    if (room.kind === "dm") {
        return true;
    }

    // 4. Group Chat room: respond ONLY if @TalkieBot is mentioned or replied to
    if (room.kind === "group") {
        const content = message.content || "";
        const mentionsBot = /@talkiebot\b/i.test(content);
        if (mentionsBot) {
            return true;
        }

        if (message.replyTo) {
            try {
                const parentMsg = await MessageRepository.findMessageById(message.replyTo);
                if (parentMsg && parentMsg.senderId === TALKIE_BOT_ID) {
                    return true;
                }
            } catch (err) {
                // Ignore lookup errors
            }
        }
    }

    return false;
};

/**
 * Invokes an open-source LLM inference endpoint (OpenAI /v1/chat/completions schema compatible).
 * Uses Pollinations text API / custom LLM server with no API key required and zero token limits.
 */
const generateLLMResponse = async (userPrompt: string, history: any[]): Promise<string> => {
    const SYSTEM_PROMPT = `You are @TalkieBot, a helpful, intelligent, friendly AI assistant integrated into the Talkie Chat app. Provide clear, helpful, and concise responses. Use markdown when useful. Keep your answers conversational and suited for real-time messaging.`;

    const messagesPayload = [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.slice().reverse().map((msg: any) => ({
            role: msg.senderId === TALKIE_BOT_ID ? "assistant" : "user",
            content: msg.content || ""
        })),
        { role: "user", content: userPrompt }
    ];

    const apiUrl = process.env.LLM_API_URL || "https://text.pollinations.ai/openai";

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: process.env.LLM_MODEL || "openai",
                messages: messagesPayload,
                temperature: 0.7,
                max_tokens: 800
            })
        });

        if (!response.ok) {
            throw new Error(`LLM API returned status ${response.status}`);
        }

        const data: any = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content && content.trim().length > 0) {
            return content.trim();
        }

        throw new Error("Empty response from LLM API");
    } catch (err: any) {
        logger.warn("Primary LLM API failed, attempting simple GET fallback", { error: err.message });
        
        // Fallback: simple text endpoint
        try {
            const encodedPrompt = encodeURIComponent(`${SYSTEM_PROMPT}\nUser: ${userPrompt}`);
            const fallbackUrl = `https://text.pollinations.ai/${encodedPrompt}`;
            const fallbackRes = await fetch(fallbackUrl);
            if (fallbackRes.ok) {
                const text = await fallbackRes.text();
                if (text && text.trim().length > 0) {
                    return text.trim();
                }
            }
        } catch (fallbackErr: any) {
            logger.error("Fallback LLM request failed", { error: fallbackErr.message });
        }

        return "Hey there! I am @TalkieBot. I'm active and ready to help, but couldn't reach the AI brain right now. Feel free to ask me again!";
    }
};

/**
 * Background processor triggered whenever a new message is saved.
 */
export const processTalkieBotMessage = async (io: Server, message: any, room: any) => {
    try {
        const trigger = await shouldTriggerTalkieBot(message, room);
        if (!trigger) return;

        const roomIdStr = room._id.toString();

        // 1. Emit typing indicator
        io.to(roomIdStr).emit("typing", { userId: TALKIE_BOT_ID, isTyping: true });

        // 2. Retrieve last 10 messages for context
        const rawHistory = await MessageRepository.findMessagesByRoomId(roomIdStr, 1, 10);
        // Exclude current message from history to prevent duplication
        const history = rawHistory.filter((m: any) => m._id.toString() !== message._id.toString());

        // Clean user prompt (remove @TalkieBot tag if present)
        const cleanPrompt = (message.content || "").replace(/@talkiebot\b/gi, "").trim() || "Hello!";

        // 3. Generate response via Open-Source LLM
        const botResponseText = await generateLLMResponse(cleanPrompt, history);

        // 4. Stop typing indicator
        io.to(roomIdStr).emit("typing", { userId: TALKIE_BOT_ID, isTyping: false });

        // 5. Save bot reply to MongoDB
        const botMessage = await MessageRepository.createMessage(
            roomIdStr,
            TALKIE_BOT_ID,
            "talkiebot-service",
            botResponseText,
            undefined,
            [],
            [],
            message._id.toString()
        );

        // 6. Broadcast response to room
        io.to(roomIdStr).emit("newMessage", botMessage);
        logger.info("TalkieBot response sent successfully", { roomId: roomIdStr, messageId: botMessage._id });
    } catch (err: any) {
        logger.error("Error processing TalkieBot message", { error: err.message });
        try {
            io.to(room._id.toString()).emit("typing", { userId: TALKIE_BOT_ID, isTyping: false });
        } catch {
            // ignore
        }
    }
};
