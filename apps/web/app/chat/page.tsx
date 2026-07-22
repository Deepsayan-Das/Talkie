'use client'

import { Send, SquarePen, Check, CheckCheck, Search, Users, Settings, UserCircle, MessageSquare, Loader2, Smile, Paperclip, ArrowLeft, Play, Pause, Square, FileText, Reply, X, Mic, Forward, CircleStop, ShieldCheck, BarChart2, Download, Camera } from 'lucide-react'
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import toast from 'react-hot-toast'
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react'
import { useAuth } from '@/context/AuthContext'
import { resendVerification } from '@/lib/auth'
import { useSocket } from '@/context/SocketContext'
import { getUserProfile, getAllRelations, uploadFile } from '@/lib/user'
import { getStoryFeed, StoryFeedEntry } from '@/lib/stories'
import { getRooms, getMessages, createRoom, updateGroupInfo, removeMember, promoteMember, demoteMember } from '@/lib/chat'
import { joinRoom, leaveRoom, sendMessage as socketSend, sendAudioMessage, forwardMessage, emitTyping, emitStopTyping, markAsSeen, reactToMessage, messageDelivered } from '@/lib/socket'
import { decryptIncomingMessage, encryptBlob, decryptBlob } from '@/lib/crypto/messaging'
import { secureStore } from '@/lib/storage/secureStore'
import type { Room, ChatMessage } from '@/lib/chat'
import type { UserProfile } from '@/lib/user'
import { VideoCallOverlay } from '@/components/VideoCallOverlay'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(d: Date): string {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function groupByDate(messages: ChatMessage[]): { date: string; msgs: ChatMessage[] }[] {
    const groups: { date: string; msgs: ChatMessage[] }[] = []
    for (const msg of messages) {
        const label = formatDate(new Date(msg.createdAt))
        const last = groups[groups.length - 1]
        if (last && last.date === label) last.msgs.push(msg)
        else groups.push({ date: label, msgs: [msg] })
    }
    return groups
}

function lastMessage(room: Room): string {
    if (room.lastMessageRecord) {
        return room.lastMessageRecord.content;
    }
    return room.name ?? `${room.members.length} members`
}

function isAudioMessage(msg: ChatMessage): { type: 'audio'; blobKey: string; blobNonce: string; durationMs: number } | null {
    if (!msg.content || !msg.attachments?.length) return null;
    try {
        const parsed = JSON.parse(msg.content);
        if (parsed.type === 'audio') return parsed;
    } catch { /* normal text */ }
    return null;
}

function isPollMessage(msg: ChatMessage): { type: 'poll'; question: string; options: { id: string, text: string }[] } | null {
    if (!msg.content) return null;
    try {
        const parsed = JSON.parse(msg.content);
        if (parsed.type === 'poll') return parsed;
    } catch { /* normal text */ }
    return null;
}

function isSpoilerMessage(msg: ChatMessage): { type: 'spoiler'; text: string } | null {
    if (!msg.content) return null;
    try {
        const parsed = JSON.parse(msg.content);
        if (parsed.type === 'spoiler') return parsed;
    } catch { /* normal text */ }
    return null;
}

const SpoilerText = ({ text }: { text: string }) => {
    const [revealed, setRevealed] = useState(false);
    return (
        <span
            onClick={() => setRevealed(v => !v)}
            className={`inline-block px-1.5 py-0.5 rounded-xs transition-all cursor-pointer select-none ${
                revealed
                    ? 'bg-[#27272a] text-neutral-100'
                    : 'bg-[#27272a] text-transparent blur-xs hover:bg-[#3f3f46]'
            }`}
            title={revealed ? "Click to hide spoiler" : "Click to reveal spoiler"}
        >
            {text}
        </span>
    );
};

function formatDuration(ms: number): string {
    const totalSec = Math.round(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const COMMANDS = [
    { command: '/help', description: 'List available commands', usage: '/help' },
    { command: '/choose', description: 'Pick randomly from options (a, b, c)', usage: '/choose Option 1, Option 2, Option 3' },
    { command: '/topic', description: 'Get a fun conversation starter prompt', usage: '/topic' },
    { command: '/spoiler', description: 'Hide secret text behind a blur mask', usage: '/spoiler <secret text>' },
    { command: '/quote', description: 'Send a memorable quote', usage: '/quote' },
    { command: '/timer', description: 'Start a countdown timer (seconds)', usage: '/timer <seconds>' },
    { command: '/roll', description: 'Roll a die', usage: '/roll' },
    { command: '/flip', description: 'Flip a coin', usage: '/flip' },
    { command: '/8ball', description: 'Ask the magic 8-ball', usage: '/8ball <question>' },
    { command: '/shrug', description: 'Send ¯\\_(ツ)_/¯', usage: '/shrug' },
    { command: '/flip-table', description: 'Send (╯°□°)╯︵ ┻━┻', usage: '/flip-table' },
    { command: '/vote', description: 'Create a poll (options: a,b,c)', usage: '/vote <question> options: a, b, c' },
    { command: '/promote', description: 'Promote member to admin (@user)', usage: '/promote @username' },
    { command: '/demote', description: 'Demote admin to member (@user)', usage: '/demote @username' },
    { command: '/kick', description: 'Remove member from group (@user)', usage: '/kick @username' },
    { command: '/mute', description: 'Mute member for duration (@user 10m)', usage: '/mute @username <duration>' },
    { command: '/unmute', description: 'Unmute member (@user)', usage: '/unmute @username' },
    { command: '/whisper', description: 'Send private DM to group member (@user msg)', usage: '/whisper @username <message>' },
    { command: '/request', description: 'Request admin action (@user reason)', usage: '/request <action> @username [reason]' },
    { command: '/requests', description: 'List pending admin requests', usage: '/requests' },
    { command: '/approve', description: 'Approve a request (<id>)', usage: '/approve <request_id>' },
    { command: '/deny', description: 'Deny a request (<id>)', usage: '/deny <request_id>' },
];

// ─── DateSeparator ─────────────────────────────────────────────────────────────
const DateSeparator = ({ label }: { label: string }) => (
    <div className="flex items-center gap-3 my-4 px-4 font-mono text-xs text-neutral-500">
        <div className="flex-1 h-px bg-[#27272a]" />
        <span>{label}</span>
        <div className="flex-1 h-px bg-[#27272a]" />
    </div>
)

// ─── AudioPlayback Component ──────────────────────────────────────────────────
const AudioPlayback = ({ msg, isMine }: { msg: ChatMessage; isMine: boolean }) => {
    const audioMeta = isAudioMessage(msg);
    const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(audioMeta?.durationMs || 0);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const objectUrlRef = useRef<string | null>(null);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        return () => {
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const loadAndPlay = async () => {
        if (!audioMeta || !msg.attachments?.[0]) return;
        setState('loading');
        try {
            const res = await fetch(msg.attachments[0].url);
            const encryptedBytes = new Uint8Array(await res.arrayBuffer());
            const decryptedBytes = await decryptBlob(encryptedBytes, audioMeta.blobKey, audioMeta.blobNonce);
            const blob = new Blob([decryptedBytes as unknown as BlobPart], { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = url;

            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onloadedmetadata = () => {
                if (audio.duration && isFinite(audio.duration)) {
                    setDuration(audio.duration * 1000);
                }
            };

            audio.onended = () => {
                setState('idle');
                setProgress(0);
                cancelAnimationFrame(rafRef.current);
            };

            const tick = () => {
                if (audio.currentTime && audio.duration) {
                    setProgress(audio.currentTime / audio.duration);
                }
                rafRef.current = requestAnimationFrame(tick);
            };

            await audio.play();
            setState('playing');
            tick();
        } catch (err) {
            console.error('Audio playback failed:', err);
            setState('idle');
        }
    };

    const togglePlayPause = () => {
        if (!audioRef.current) return;
        if (state === 'playing') {
            audioRef.current.pause();
            setState('paused');
            cancelAnimationFrame(rafRef.current);
        } else if (state === 'paused') {
            audioRef.current.play();
            setState('playing');
            const tick = () => {
                if (audioRef.current?.currentTime && audioRef.current?.duration) {
                    setProgress(audioRef.current.currentTime / audioRef.current.duration);
                }
                rafRef.current = requestAnimationFrame(tick);
            };
            tick();
        }
    };

    const bars = Array.from({ length: 24 }, (_, i) => {
        const h = 10 + Math.sin(i * 0.7) * 8 + Math.cos(i * 1.3) * 5;
        return Math.max(4, Math.min(24, h));
    });

    return (
        <div className="flex items-center gap-3 min-w-[200px]">
            <button
                onClick={state === 'idle' ? loadAndPlay : togglePlayPause}
                disabled={state === 'loading'}
                className={`w-8 h-8 rounded-xs flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
                    isMine
                        ? 'bg-white text-black hover:bg-neutral-200'
                        : 'bg-[#27272a] text-white hover:bg-neutral-700'
                }`}
            >
                {state === 'loading' ? (
                    <Loader2 size={14} className="animate-spin" />
                ) : state === 'playing' ? (
                    <Pause size={14} fill="currentColor" />
                ) : (
                    <Play size={14} fill="currentColor" />
                )}
            </button>
            <div className="flex-1 flex flex-col gap-1">
                <div className="flex items-end gap-[2px] h-6">
                    {bars.map((h, i) => {
                        const barProgress = i / bars.length;
                        const isActive = barProgress <= progress;
                        return (
                            <div
                                key={i}
                                className="transition-all duration-100 rounded-xs"
                                style={{
                                    width: '3px',
                                    height: `${h}px`,
                                    backgroundColor: isActive
                                        ? (isMine ? '#ffffff' : '#f4f4f5')
                                        : (isMine ? 'rgba(255,255,255,0.25)' : '#3f3f46'),
                                }}
                            />
                        );
                    })}
                </div>
                <span className={`text-[10px] font-mono ${isMine ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    {duration > 0 ? formatDuration(duration) : '0:00'}
                </span>
            </div>
        </div>
    );
};

// ─── Audio Recorder Modal ─────────────────────────────────────────────────────
type RecorderState = 'idle' | 'recording' | 'paused' | 'stopped';

const AudioRecorderModal = ({
    onClose,
    onSend
}: {
    onClose: () => void;
    onSend: (blob: Blob, durationMs: number) => void;
}) => {
    const [recState, setRecState] = useState<RecorderState>('idle');
    const [elapsed, setElapsed] = useState(0);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const mediaRecRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef(0);
    const pausedElapsedRef = useRef(0);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);
    const finalBlobRef = useRef<Blob | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
                mediaRecRef.current.stop();
            }
            mediaRecRef.current?.stream?.getTracks().forEach(t => t.stop());
        };
    }, []);

    const startTimer = () => {
        startTimeRef.current = Date.now();
        timerRef.current = setInterval(() => {
            setElapsed(pausedElapsedRef.current + (Date.now() - startTimeRef.current));
        }, 100);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        pausedElapsedRef.current += (Date.now() - startTimeRef.current);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
            chunksRef.current = [];

            mr.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mr.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                finalBlobRef.current = blob;
                const url = URL.createObjectURL(blob);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(url);
            };

            mediaRecRef.current = mr;
            mr.start(250);
            setRecState('recording');
            pausedElapsedRef.current = 0;
            setElapsed(0);
            startTimer();
        } catch (err) {
            console.error('Microphone access denied:', err);
        }
    };

    const pauseRecording = () => {
        mediaRecRef.current?.pause();
        stopTimer();
        setRecState('paused');
    };

    const resumeRecording = () => {
        mediaRecRef.current?.resume();
        startTimer();
        setRecState('recording');
    };

    const stopRecording = () => {
        mediaRecRef.current?.stop();
        stopTimer();
        mediaRecRef.current?.stream?.getTracks().forEach(t => t.stop());
        setRecState('stopped');
    };

    const cancelRecording = () => {
        if (mediaRecRef.current && mediaRecRef.current.state !== 'inactive') {
            mediaRecRef.current.stop();
        }
        mediaRecRef.current?.stream?.getTracks().forEach(t => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        onClose();
    };

    const playPreview = () => {
        if (!previewUrl) return;
        if (previewAudioRef.current) previewAudioRef.current.pause();
        const audio = new Audio(previewUrl);
        previewAudioRef.current = audio;
        audio.onended = () => setIsPlaying(false);
        audio.play();
        setIsPlaying(true);
    };

    const stopPreview = () => {
        previewAudioRef.current?.pause();
        if (previewAudioRef.current) previewAudioRef.current.currentTime = 0;
        setIsPlaying(false);
    };

    const handleSend = () => {
        if (!finalBlobRef.current) return;
        onSend(finalBlobRef.current, elapsed);
    };

    const waveBars = Array.from({ length: 36 }, (_, i) => i);

    return (
        <Modal isOpen={true} onClose={cancelRecording} title="Record Voice Message" maxWidth="sm">
            <div className="flex flex-col items-center gap-5 text-center py-2">
                <div className="text-3xl font-mono font-bold text-white tracking-widest tabular-nums">
                    {formatDuration(elapsed)}
                </div>

                <div className="flex items-center gap-[3px] h-12 w-full justify-center">
                    {recState === 'recording' ? (
                        waveBars.map(i => (
                            <div
                                key={i}
                                className="w-[3px] bg-white rounded-xs"
                                style={{
                                    animation: `audioWave 0.8s ${i * 0.04}s ease-in-out infinite alternate`,
                                    height: '6px',
                                }}
                            />
                        ))
                    ) : (
                        waveBars.map(i => (
                            <div
                                key={i}
                                className="w-[3px] bg-neutral-700 rounded-xs"
                                style={{ height: `${6 + Math.sin(i * 0.5) * 10}px` }}
                            />
                        ))
                    )}
                </div>

                <div className="flex items-center gap-3 mt-2">
                    {recState === 'idle' && (
                        <Button variant="primary" size="lg" onClick={startRecording} leftIcon={<Mic className="w-4 h-4" />}>
                            START RECORDING
                        </Button>
                    )}

                    {recState === 'recording' && (
                        <>
                            <Button variant="secondary" size="md" onClick={pauseRecording} leftIcon={<Pause className="w-4 h-4" />}>
                                PAUSE
                            </Button>
                            <Button variant="primary" size="md" onClick={stopRecording} leftIcon={<Square className="w-4 h-4" />}>
                                STOP
                            </Button>
                        </>
                    )}

                    {recState === 'paused' && (
                        <>
                            <Button variant="primary" size="md" onClick={resumeRecording} leftIcon={<Mic className="w-4 h-4" />}>
                                RESUME
                            </Button>
                            <Button variant="ghost" size="md" onClick={cancelRecording}>
                                DISCARD
                            </Button>
                        </>
                    )}

                    {recState === 'stopped' && (
                        <>
                            <Button variant="secondary" size="md" onClick={isPlaying ? stopPreview : playPreview}>
                                {isPlaying ? 'STOP PREVIEW' : 'PLAY PREVIEW'}
                            </Button>
                            <Button variant="primary" size="md" onClick={handleSend} rightIcon={<Send className="w-4 h-4" />}>
                                SEND AUDIO
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// ─── Forward Modal Component ──────────────────────────────────────────────────
const ForwardModal = ({
    message,
    rooms,
    profiles,
    currentUserId,
    onClose,
    onForward,
}: {
    message: ChatMessage;
    rooms: Room[];
    profiles: Record<string, UserProfile>;
    currentUserId: string;
    onClose: () => void;
    onForward: (targetRoom: Room) => void;
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredRooms = rooms.filter(room => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        if (room.kind === 'dm') {
            const otherId = room.members.find(m => m.userId !== currentUserId)?.userId;
            const otherName = otherId ? profiles[otherId]?.displayName : '';
            return otherName?.toLowerCase().includes(q);
        }
        return room.name?.toLowerCase().includes(q);
    });

    return (
        <Modal isOpen={true} onClose={onClose} title="Forward Message" maxWidth="md">
            <div className="flex flex-col gap-4">
                <Input
                    placeholder="Search target conversation..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    leftElement={<Search className="w-4 h-4 text-neutral-500" />}
                />

                <div className="p-3 bg-[#161616] border border-[#27272a] rounded-sm text-xs">
                    <span className="text-xs text-neutral-500 block mb-1">Message Preview</span>
                    <p className="text-neutral-300 truncate">{message.content || '📎 Attachment'}</p>
                </div>

                <div className="max-h-60 overflow-y-auto flex flex-col gap-1 border border-[#27272a] p-1 rounded-sm">
                    {filteredRooms.map(room => {
                        const otherId = room.members.find(m => m.userId !== currentUserId)?.userId;
                        const otherProfile = otherId ? profiles[otherId] : null;
                        const name = room.kind === 'dm'
                            ? (otherProfile?.displayName ?? 'Unknown')
                            : (room.name ?? 'Group');
                        const avatar = room.kind === 'dm' ? otherProfile?.avatar : room.avatar;

                        return (
                            <div
                                key={room._id}
                                onClick={() => onForward(room)}
                                className="flex items-center justify-between p-2.5 hover:bg-[#18181b] cursor-pointer transition-colors border-b border-[#27272a] last:border-0 rounded-xs"
                            >
                                <div className="flex items-center gap-3">
                                    {avatar ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={avatar} alt={name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                    ) : (
                                        <div className="w-8 h-8 bg-neutral-800 text-white font-mono text-xs flex items-center justify-center rounded-full shrink-0 font-bold">
                                            {name[0]?.toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex flex-col text-left">
                                        <span className="text-sm font-semibold text-neutral-200">{name}</span>
                                        <span className="text-xs text-neutral-500">{room.kind === 'dm' ? 'Direct Message' : `${room.members.length} members`}</span>
                                    </div>
                                </div>
                                <Forward className="w-4 h-4 text-neutral-500" />
                            </div>
                        );
                    })}
                </div>
            </div>
        </Modal>
    );
};

// ─── MessageBubble Component ──────────────────────────────────────────────────
const MessageBubble = ({ msg, isMine, currentUserId, onReply, onForward, replyTarget, replyTargetName, onReact, onReplyClick, onVotePoll }: { msg: ChatMessage; isMine: boolean; currentUserId: string; onReply: () => void; onForward: () => void; replyTarget?: ChatMessage; replyTargetName?: string; onReact: (emoji: string | null) => void; onReplyClick?: (msgId: string) => void; onVotePoll: (msgId: string, optionId: string) => void }) => {
    const [showReactions, setShowReactions] = useState(false);
    const reactionsRef = useRef<HTMLDivElement>(null);
    const reactions = msg.reactions || {};
    const reactionCounts: Record<string, number> = {};
    const myReaction = reactions[currentUserId];
    let hasReactions = false;

    Object.values(reactions).forEach(emoji => {
        hasReactions = true;
        reactionCounts[emoji] = (reactionCounts[emoji] || 0) + 1;
    });

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (reactionsRef.current && !reactionsRef.current.contains(e.target as Node)) {
                setShowReactions(false);
            }
        };
        if (showReactions) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showReactions]);

    return (
        <div id={`message-${msg._id}`} className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'} px-4 py-1 group`}>
            <div className={`flex flex-col gap-1 max-w-[70%] sm:max-w-[60%] relative ${isMine ? 'items-end' : 'items-start'}`}>
                {/* Floating Quick Action Overlay */}
                <div className={`absolute top-1 ${isMine ? '-left-20' : '-right-20'} opacity-0 group-hover:opacity-100 ${showReactions ? 'opacity-100' : ''} transition-opacity z-10 flex gap-1 bg-[#161616] p-1 border border-[#27272a] rounded-sm shadow-xl`}>
                    <button onClick={onReply} className="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer" title="Reply">
                        <Reply size={13} />
                    </button>
                    <button onClick={onForward} className="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer" title="Forward">
                        <Forward size={13} />
                    </button>
                    <div className="relative" ref={reactionsRef}>
                        <button onClick={() => setShowReactions(!showReactions)} className="p-1 text-neutral-400 hover:text-white transition-colors cursor-pointer" title="React">
                            <Smile size={13} />
                        </button>
                        {showReactions && (
                            <div className="flex absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#121212] border border-[#27272a] p-1 rounded-sm shadow-2xl gap-1 z-50">
                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                    <button key={emoji} onClick={() => { onReact(myReaction === emoji ? null : emoji); setShowReactions(false); }} className="hover:scale-110 text-base p-1 cursor-pointer">
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {msg.isDeleted ? (
                    <div className="px-3.5 py-2 text-xs italic text-neutral-500 bg-[#121212] border border-[#27272a] rounded-sm">
                        Message deleted
                    </div>
                ) : (
                    <div
                        className={`px-4 py-3 text-sm flex flex-col gap-2 rounded-sm border ${
                            isMine
                                ? 'bg-[#1a1a1a] text-neutral-100 border-[#3f3f46]'
                                : 'bg-[#121212] text-neutral-200 border-[#27272a]'
                        }`}
                    >
                        {msg.forwardedFrom && (
                            <div className="flex items-center gap-1 text-xs text-neutral-500 font-medium">
                                <Forward size={12} />
                                <span>Forwarded</span>
                            </div>
                        )}
                        {replyTarget && (
                            <div
                                onClick={() => onReplyClick && onReplyClick(replyTarget._id)}
                                className="flex flex-col border-l-2 border-white/40 pl-2 py-0.5 mb-1 cursor-pointer hover:border-white transition-colors bg-black/20"
                            >
                                <span className="text-xs text-neutral-400 font-medium">
                                    Replying to {replyTargetName || 'someone'}
                                </span>
                                <span className="text-xs text-neutral-300 truncate">
                                    {replyTarget.content || 'Attachment'}
                                </span>
                            </div>
                        )}

                        {isPollMessage(msg) ? (() => {
                            const pollMeta = isPollMessage(msg)!;
                            return (
                                <div className="flex flex-col gap-2 min-w-[200px]">
                                    <span className="font-semibold text-sm flex items-center gap-1.5"><BarChart2 className="w-4 h-4 text-white shrink-0" /> {pollMeta.question}</span>
                                    {pollMeta.options.map(opt => {
                                        const votesForOption = Object.values(msg.pollVotes || {}).filter(v => v === opt.id).length;
                                        const totalVotes = Object.keys(msg.pollVotes || {}).length || 1;
                                        const percent = Math.round((votesForOption / totalVotes) * 100);
                                        const myVote = (msg.pollVotes || {})[currentUserId];

                                        return (
                                            <button
                                                key={opt.id}
                                                onClick={() => onVotePoll(msg._id, opt.id)}
                                                className={`relative overflow-hidden flex justify-between p-2 text-xs border rounded-sm transition-colors cursor-pointer ${
                                                    myVote === opt.id ? 'border-white bg-white/10' : 'border-[#27272a] hover:border-neutral-500'
                                                }`}
                                            >
                                                <div className="absolute left-0 top-0 bottom-0 bg-white/10" style={{ width: `${percent}%` }} />
                                                <span className="relative z-10 font-medium">{opt.text}</span>
                                                <span className="relative z-10 text-xs text-neutral-400">{votesForOption}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            )
                        })() : isSpoilerMessage(msg) ? (
                            <SpoilerText text={isSpoilerMessage(msg)!.text} />
                        ) : isAudioMessage(msg) ? (
                            <AudioPlayback msg={msg} isMine={isMine} />
                        ) : (
                            <>
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        {msg.attachments.map((att, i) => (
                                            att.contentType.startsWith('image/') ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img key={i} src={att.url} alt="attachment" className="max-w-full rounded-sm border border-neutral-700 bg-black/40" />
                                            ) : (
                                                <a key={i} href={att.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 underline text-xs text-neutral-200 hover:text-white">
                                                    <Download size={13} />
                                                    <span>Download File</span>
                                                </a>
                                            )
                                        ))}
                                    </div>
                                )}
                                {msg.content && <span className="leading-relaxed">{msg.content}</span>}
                            </>
                        )}
                    </div>
                )}

                {hasReactions && (
                    <div className={`flex flex-wrap gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(reactionCounts).map(([emoji, count]) => (
                            <button
                                key={emoji}
                                onClick={() => onReact(myReaction === emoji ? null : emoji)}
                                className={`text-xs px-1.5 py-0.5 rounded-xs flex items-center gap-1 border ${
                                    myReaction === emoji
                                        ? 'bg-white text-black border-white'
                                        : 'bg-[#121212] text-neutral-400 border-[#27272a] hover:border-neutral-500'
                                }`}
                            >
                                <span>{emoji}</span>
                                {count > 1 && <span>{count}</span>}
                            </button>
                        ))}
                    </div>
                )}

                <div className={`flex items-center gap-1.5 font-mono text-[10px] text-neutral-500 ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <span>{formatTime(new Date(msg.createdAt))}</span>
                    {isMine && (
                        msg.seenBy.length > 0
                            ? <CheckCheck size={12} className="text-white" />
                            : (msg.delivery?.deliveredAt
                                ? <CheckCheck size={12} className="text-neutral-500" />
                                : <Check size={12} className="text-neutral-500" />)
                    )}
                </div>
            </div>
        </div>
    )
}

const TypingIndicator = () => (
    <div className="flex justify-start px-4 py-1">
        <div className="bg-[#121212] border border-[#27272a] px-3 py-2 rounded-sm flex items-center gap-1">
            {[0, 1, 2].map(i => (
                <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-neutral-400 block"
                    style={{ animation: `typing-dot 1.2s ${i * 0.2}s infinite` }}
                />
            ))}
        </div>
    </div>
)

// ─── RoomItem Component ───────────────────────────────────────────────────────
const RoomItem = ({
    room, isActive, currentUserId, onClick, profiles, hasUnseenStory
}: {
    room: Room; isActive: boolean; currentUserId: string; onClick: () => void; profiles: Record<string, UserProfile>; hasUnseenStory?: boolean;
}) => {
    const otherId = room.members.find(m => m.userId !== currentUserId)?.userId
    const otherProfile = otherId ? profiles[otherId] : null

    const otherName = room.kind === 'dm'
        ? (otherProfile?.displayName ?? `DM-${otherId?.slice(0, 6) ?? '???'}`)
        : (room.name ?? 'Group')

    const avatar = room.kind === 'dm' ? otherProfile?.avatar : room.avatar

    return (
        <div
            onClick={onClick}
            className={`w-full p-3 border-b border-[#27272a] cursor-pointer flex items-center gap-3 transition-all ${
                isActive
                    ? 'bg-[#18181b] border-l-2 border-l-white'
                    : 'hover:bg-[#121212]'
            }`}
        >
            <div className="relative shrink-0">
                {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatar} alt={otherName} className={`h-10 w-10 rounded-full object-cover border border-neutral-700 ${hasUnseenStory ? 'ring-2 ring-white ring-offset-2 ring-offset-[#080808]' : ''}`} />
                ) : (
                    <div className="h-10 w-10 bg-neutral-800 text-white text-sm flex items-center justify-center rounded-full font-bold border border-neutral-700">
                        {otherName[0]?.toUpperCase()}
                    </div>
                )}
            </div>
            <div className="grow flex flex-col gap-0.5 overflow-hidden text-left">
                <div className="flex justify-between items-center">
                    <p className={`font-medium text-xs tracking-tight truncate ${isActive ? 'text-white font-semibold' : 'text-neutral-200'}`}>
                        {otherName}
                    </p>
                    <span className="font-mono text-[10px] text-neutral-500">
                        {room.updatedAt ? formatTime(new Date(room.updatedAt)) : ''}
                    </span>
                </div>
                <p className="text-xs text-neutral-500 truncate font-sans">
                    {lastMessage(room)}
                </p>
            </div>
        </div>
    )
}

// ─── Create Group Modal ───────────────────────────────────────────────────────
const CreateGroupModal = ({
    onClose,
    onCreate
}: {
    onClose: () => void,
    onCreate: (name: string, members: string[], avatar?: string) => void
}) => {
    const [name, setName] = useState('')
    const [avatarUrl, setAvatarUrl] = useState('')
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [buddies, setBuddies] = useState<{ id: string, name: string, avatar?: string }[]>([])
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [loading, setLoading] = useState(true)
    const avatarInputRef = useRef<HTMLInputElement>(null)
    const { user } = useAuth()

    useEffect(() => {
        getAllRelations().then(async relations => {
            const accepted = relations.filter(r => r.status === 'accepted')
            const buddyIds = accepted.map(r => r.requester_id === user?.id ? r.receiver_id : r.requester_id)
            const profs = await Promise.all(buddyIds.map(id => getUserProfile(id).catch(() => null)))
            setBuddies(profs.filter(Boolean).map(p => ({ id: p!.id, name: p!.displayName, avatar: p!.avatar })))
            setLoading(false)
        }).catch(() => {
            toast.error("Failed to load buddies")
            setLoading(false)
        })
    }, [user?.id])

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingAvatar(true)
        try {
            const res = await uploadFile(file)
            setAvatarUrl(res.url)
            toast.success("Group picture uploaded")
        } catch {
            toast.error("Failed to upload group picture")
        } finally {
            setUploadingAvatar(false)
        }
    }

    const toggleBuddy = (id: string) => {
        const next = new Set(selected)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelected(next)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim()) return toast.error("Group name is required")
        if (selected.size === 0) return toast.error("Select at least one member")
        onCreate(name.trim(), Array.from(selected), avatarUrl || undefined)
    }

    return (
        <Modal isOpen={true} onClose={onClose} title="Create New Group" maxWidth="md">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
                {/* Group Avatar Upload Area */}
                <div className="flex items-center gap-4 border-b border-[#27272a] pb-4">
                    <input
                        type="file"
                        ref={avatarInputRef}
                        onChange={handleAvatarUpload}
                        accept="image/*"
                        className="hidden"
                    />
                    <div
                        onClick={() => avatarInputRef.current?.click()}
                        className="relative w-14 h-14 rounded-full bg-[#18181b] border border-[#27272a] hover:border-white transition-all cursor-pointer flex items-center justify-center overflow-hidden shrink-0 group"
                    >
                        {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarUrl} alt="Group Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex flex-col items-center gap-1 text-neutral-400 group-hover:text-white">
                                {uploadingAvatar ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-xs font-semibold text-neutral-200">Group Picture</span>
                        <span className="text-[11px] text-neutral-500">Optional · Click icon to upload avatar photo</span>
                    </div>
                </div>

                <Input
                    label="Group Name"
                    placeholder="e.g. Project Discussion"
                    value={name}
                    onChange={e => setName(e.target.value)}
                />

                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-neutral-300">Select Members ({selected.size})</label>
                    <div className="max-h-48 overflow-y-auto border border-[#27272a] bg-[#121212] p-1 rounded-sm flex flex-col gap-1">
                        {loading ? (
                            <div className="flex justify-center py-6"><Loader2 className="animate-spin text-neutral-400" size={20} /></div>
                        ) : buddies.length === 0 ? (
                            <p className="text-center text-neutral-500 text-xs py-6">No connected buddies found</p>
                        ) : (
                            buddies.map(b => (
                                <div
                                    key={b.id}
                                    onClick={() => toggleBuddy(b.id)}
                                    className={`p-2 flex items-center justify-between cursor-pointer border rounded-xs transition-colors ${
                                        selected.has(b.id) ? 'bg-[#18181b] border-white text-white' : 'border-transparent text-neutral-300 hover:bg-[#161616]'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        {b.avatar ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={b.avatar} alt={b.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-neutral-800 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                                                {b.name[0]?.toUpperCase()}
                                            </div>
                                        )}
                                        <span className="text-xs font-medium">{b.name}</span>
                                    </div>
                                    {selected.has(b.id) && <Check size={14} className="text-white" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <Button type="submit" variant="primary" size="lg" className="w-full mt-2" isLoading={uploadingAvatar}>
                    CREATE GROUP
                </Button>
            </form>
        </Modal>
    )
}

// ─── Group Info Modal ────────────────────────────────────────────────────────
const GroupInfoModal = ({
    room,
    onClose,
    profiles,
    currentUserId,
    onRoomUpdated,
    onLeave
}: {
    room: Room,
    onClose: () => void,
    profiles: Record<string, UserProfile>,
    currentUserId: string,
    onRoomUpdated: (room: Room) => void,
    onLeave: () => void
}) => {
    const [name, setName] = useState(room.name || '')
    const myRole = room.members.find(m => m.userId === currentUserId)?.role || 'member'

    return (
        <Modal isOpen={true} onClose={onClose} title={room.name || 'Group Details'} maxWidth="md">
            <div className="flex flex-col gap-4 text-left">
                <div className="flex items-center gap-3 border-b border-[#27272a] pb-4">
                    <div className="w-12 h-12 bg-white text-black font-bold text-lg flex items-center justify-center rounded-full">
                        {room.name?.[0]?.toUpperCase() || 'G'}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-base font-bold text-neutral-100">{room.name}</span>
                        <span className="text-xs text-neutral-500">{room.members.length} members</span>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-neutral-400">Members List</span>
                    <div className="max-h-52 overflow-y-auto flex flex-col gap-1 border border-[#27272a] bg-[#121212] p-1 rounded-sm">
                        {room.members.map(m => {
                            const isMe = m.userId === currentUserId
                            const prof = profiles[m.userId]
                            return (
                                <div key={m.userId} className="flex items-center justify-between p-2 border-b border-[#27272a] last:border-0">
                                    <span className="text-xs font-semibold text-neutral-200">
                                        {prof?.displayName || 'User'} {isMe && '(You)'}
                                    </span>
                                    <Badge variant="subtle" size="sm">{m.role}</Badge>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <Button variant="danger" size="md" onClick={onLeave} className="w-full mt-2">
                    LEAVE GROUP
                </Button>
            </div>
        </Modal>
    )
}

// ─── Main Chat Inner Component ────────────────────────────────────────────────
const ChatInner = () => {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user } = useAuth()
    const { socket } = useSocket()
    const currentUserId = user?.id ?? ''

    const [rooms, setRooms] = useState<Room[]>([])
    const [activeRoom, setActiveRoom] = useState<Room | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [showEmojiPicker, setShowEmojiPicker] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [roomsLoading, setRoomsLoading] = useState(true)
    const [msgsLoading, setMsgsLoading] = useState(false)
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false)
    const [showGroupInfo, setShowGroupInfo] = useState(false)
    const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})
    const [page, setPage] = useState(1)
    const [hasMore, setHasMore] = useState(true)
    const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null)

    const bottomRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const prevRoomId = useRef<string | null>(null)
    const emojiPickerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [uploadingFile, setUploadingFile] = useState(false)
    const [hasPendingRequests, setHasPendingRequests] = useState(false)
    const [isAudioRecorderOpen, setIsAudioRecorderOpen] = useState(false)
    const [sendingAudio, setSendingAudio] = useState(false)
    const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null)
    const [storiesFeed, setStoriesFeed] = useState<StoryFeedEntry[]>([])

    // Command & Mention autocomplete state
    const { filteredCommands, commandHint, mentionSuggestions } = useMemo(() => {
        let commands: any[] = [];
        let hint = null;
        let mentions: UserProfile[] = [];

        const lastWordMatch = input.match(/(?:^|\s)(@\w*)$/);
        if (lastWordMatch && activeRoom) {
            const typedMention = lastWordMatch[1].slice(1).toLowerCase();
            const members = activeRoom.members
                .map(m => profiles[m.userId])
                .filter(Boolean);
            
            mentions = members.filter(p => p.displayName.toLowerCase().startsWith(typedMention) || p.username.toLowerCase().startsWith(typedMention));
        }

        if (input.startsWith('/')) {
            const firstSpace = input.indexOf(' ');
            if (firstSpace === -1) {
                const typed = input.toLowerCase();
                commands = COMMANDS.filter(c => c.command.startsWith(typed));
            } else {
                const typedCmd = input.slice(0, firstSpace).toLowerCase();
                const matchedCmd = COMMANDS.find(c => c.command === typedCmd);
                if (matchedCmd && matchedCmd.usage !== matchedCmd.command) {
                    hint = matchedCmd;
                }
            }
        }
        return { filteredCommands: commands, commandHint: hint, mentionSuggestions: mentions };
    }, [input, activeRoom, profiles]);

    const hasAnyUnseenStory = storiesFeed.some(entry =>
        entry._id !== currentUserId && entry.stories.some(s => !(s.viewedBy && s.viewedBy[currentUserId]))
    )

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false)
            }
        }
        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showEmojiPicker])

    useEffect(() => {
        if (!user) return
        getAllRelations()
            .then(relations => {
                const incoming = relations.filter(
                    r => r.status === 'pending' && r.receiver_id === user.id
                )
                setHasPendingRequests(incoming.length > 0)
            })
            .catch(() => {})

        getStoryFeed()
            .then(feed => setStoriesFeed(feed))
            .catch(() => {})
    }, [user])

    useEffect(() => {
        secureStore.getCachedRooms().then(cached => {
            if (cached.length > 0) {
                setRooms(prev => prev.length === 0 ? cached : prev)
                setRoomsLoading(false)
            }
        }).catch(console.error)

        getRooms()
            .then(async data => {
                await secureStore.setCachedRooms(data).catch(console.error)
                setRooms(data)

                const ids = new Set<string>()
                data.forEach(r => {
                    r.members.forEach(m => {
                        if (m.userId !== user?.id) ids.add(m.userId)
                    })
                })
                const profs: Record<string, UserProfile> = {}
                await Promise.all(Array.from(ids).map(async id => {
                    try {
                        const p = await getUserProfile(id)
                        profs[id] = p
                    } catch {}
                }))
                setProfiles(profs)

                const targetRoomId = searchParams.get('room')
                if (targetRoomId) {
                    const target = data.find(r => r._id === targetRoomId)
                    if (target) {
                        setActiveRoom(target)
                        return
                    }
                }
                if (data.length > 0) setActiveRoom(data[0])
            })
            .catch(() => toast.error('Could not load conversations'))
            .finally(() => setRoomsLoading(false))
    }, [searchParams, user?.id])

    useEffect(() => {
        if (!activeRoom || activeRoom.kind !== 'dm') return;
        const otherId = activeRoom.members.find(m => m.userId !== currentUserId)?.userId;
        if (!otherId) return;

        const refreshPresence = () => {
            getUserProfile(otherId)
                .then(p => setProfiles(prev => ({ ...prev, [otherId]: p })))
                .catch(() => {});
        };

        refreshPresence();
        const interval = setInterval(refreshPresence, 30_000);
        return () => clearInterval(interval);
    }, [activeRoom?._id, currentUserId])

    useEffect(() => {
        if (!activeRoom) return
        const roomId = activeRoom._id

        if (prevRoomId.current && prevRoomId.current !== roomId) {
            leaveRoom(prevRoomId.current)
        }
        prevRoomId.current = roomId

        joinRoom(roomId)
        setMessages([])
        setPage(1)
        setHasMore(true)
        setMsgsLoading(true)
        setReplyingTo(null)

        secureStore.getCachedMessagesForRoom(roomId).then(cached => {
            if (cached.length > 0) {
                setMessages(prev => {
                    if (prev.length > 0) return prev;
                    return cached;
                });
                setMsgsLoading(false);
            }
        }).catch(console.error);

        getMessages(roomId, 1, 50)
            .then(async data => {
                const decrypted = await Promise.all(data.map(m => decryptIncomingMessage(m)))
                setMessages(decrypted.reverse())
                setHasMore(data.length === 50)
            })
            .catch(() => toast.error('Could not load messages'))
            .finally(() => setMsgsLoading(false))
    }, [activeRoom])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isTyping])

    useEffect(() => {
        if (!socket) return

        const onMessage = async (msg: ChatMessage) => {
            if (msg.roomId === activeRoom?._id) {
                const decryptedMsg = await decryptIncomingMessage(msg)
                setMessages(prev => [...prev, decryptedMsg])
                if (msg.senderId !== user?.id) {
                    markAsSeen(msg.roomId, msg._id)
                }
            }

            if (msg.senderId !== user?.id) {
                messageDelivered(msg.roomId, msg._id)
            }

            setRooms(prev => {
                const updated = prev.map(r => r._id === msg.roomId ? { ...r, updatedAt: msg.createdAt, lastMessageRecord: msg } : r)
                return [...updated].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            })
        }

        const onTyping = ({ userId }: { userId: string }) => {
            if (userId !== user?.id) setIsTyping(true)
        }

        const onStopTyping = ({ userId }: { userId: string }) => {
            if (userId !== user?.id) setIsTyping(false)
        }

        const onMessageEdited = async (updated: ChatMessage) => {
            const decryptedMsg = await decryptIncomingMessage(updated)
            setMessages(prev => prev.map(m => m._id === updated._id ? decryptedMsg : m))
        }

        const onMessageDeleted = ({ messageId }: { messageId: string }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, isDeleted: true, content: '' } : m))
        }

        const onSeen = (data: { messageId: string, userId: string, seenAt: string }) => {
            setMessages(prev => prev.map(m => {
                if (m._id === data.messageId) {
                    return { ...m, seenBy: [...m.seenBy.filter(s => s.userId !== data.userId), { userId: data.userId, seenAt: data.seenAt }] }
                }
                return m
            }))
        }

        const onMessageReacted = (updated: ChatMessage) => {
            setMessages(prev => prev.map(m => m._id === updated._id ? { ...m, reactions: updated.reactions } : m))
        }

        const onMessageStatusUpdated = (updated: ChatMessage) => {
            setMessages(prev => prev.map(m => m._id === updated._id ? { ...m, delivery: updated.delivery, seenBy: updated.seenBy } : m))
        }

        const onError = (error: { event: string, message: string }) => {
            toast.error(`Error: ${error.message}`);
        }

        const onPollVoteUpdated = (updated: ChatMessage) => {
            setMessages(prev => prev.map(m => m._id === updated._id ? { ...m, pollVotes: updated.pollVotes } : m))
        }

        const onRoomUpdated = (updatedRoom: Room) => {
            setRooms(prev => prev.map(r => r._id === updatedRoom._id ? { ...updatedRoom, lastMessageRecord: r.lastMessageRecord } : r))
            setActiveRoom(prev => prev?._id === updatedRoom._id ? { ...updatedRoom, lastMessageRecord: prev?.lastMessageRecord } : prev)
        }

        socket.on('newMessage', onMessage)
        socket.on('userTyping', onTyping)
        socket.on('userStoppedTyping', onStopTyping)
        socket.on('messageEdited', onMessageEdited)
        socket.on('messageDeleted', onMessageDeleted)
        socket.on('messageReacted', onMessageReacted)
        socket.on('messageStatusUpdated', onMessageStatusUpdated)
        socket.on('messageSeen', onSeen)
        socket.on('error', onError)
        socket.on('pollVoteUpdated', onPollVoteUpdated)
        socket.on('roomUpdated', onRoomUpdated)

        return () => {
            socket.off('newMessage', onMessage)
            socket.off('userTyping', onTyping)
            socket.off('userStoppedTyping', onStopTyping)
            socket.off('messageEdited', onMessageEdited)
            socket.off('messageDeleted', onMessageDeleted)
            socket.off('messageReacted', onMessageReacted)
            socket.off('messageStatusUpdated', onMessageStatusUpdated)
            socket.off('messageSeen', onSeen)
            socket.off('error', onError)
            socket.off('pollVoteUpdated', onPollVoteUpdated)
            socket.off('roomUpdated', onRoomUpdated)
        }
    }, [socket, activeRoom, user?.id])

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value)
        const el = textareaRef.current
        if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }

        if (activeRoom) {
            emitTyping(activeRoom._id)
            if (typingTimer.current) clearTimeout(typingTimer.current)
            typingTimer.current = setTimeout(() => {
                if (activeRoom) emitStopTyping(activeRoom._id)
            }, 1500)
        }
    }

    // ── Send Message & Commands Handler ───────────────────────────────────────
    const sendMessageHandler = useCallback(async () => {
        let finalContent = input.trim()
        if (!finalContent || !activeRoom) return

        // ── Command Parsing ───────────────────────────────────────────────────
        if (finalContent.startsWith('/')) {
            const args = finalContent.substring(1).split(' ');
            const command = args[0].toLowerCase();

            const findUser = (name: string) => {
                if (!name) return undefined;
                let clean = name.startsWith('@') ? name.slice(1) : name;
                clean = clean.toLowerCase();
                if (clean === 'me') return currentUserId;
                
                return activeRoom.members.find(m => {
                    if (m.userId.toLowerCase() === clean) return true;
                    const p = profiles[m.userId];
                    if (!p) return false;
                    return p.username.toLowerCase() === clean || 
                           p.displayName.toLowerCase() === clean ||
                           p.displayName.toLowerCase().replace(/\s+/g, '') === clean;
                })?.userId;
            };

            if (command === 'help') {
                const helpMsg: ChatMessage = {
                    _id: 'local-' + Date.now(),
                    roomId: activeRoom._id,
                    senderId: 'system',
                    content: "Available commands:\n/choose <options: a, b, c>\n/topic - Random conversation starter\n/spoiler <text> - Send blurred secret text\n/quote - Send a random quote\n/timer <seconds> - Start a countdown\n/roll - Roll a die\n/flip - Flip a coin\n/8ball <question>\n/shrug\n/flip-table\n/vote <question> options: a,b,c\nGroup Admin: /promote @user, /demote @user, /kick @user, /mute @user <duration>, /unmute @user\nGroup: /whisper @user <msg>, /request <action> @user [reason], /requests, /approve <id>, /deny <id>",
                    seenBy: [],
                    isDeleted: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                setMessages(prev => [...prev, helpMsg]);
                setInput(''); return;
            } else if (command === 'choose') {
                const rest = args.slice(1).join(' ');
                const options = rest.split(',').map(o => o.trim()).filter(Boolean);
                if (options.length < 2) {
                    toast.error("Format: /choose Option 1, Option 2, Option 3");
                    return;
                }
                const chosen = options[Math.floor(Math.random() * options.length)];
                if (socket) {
                    socket.emit('broadcastSystemMessage', {
                        roomId: activeRoom._id,
                        content: `@${profiles[currentUserId]?.displayName || 'Someone'} asked to choose between: ${options.join(', ')}\nResult: ${chosen}`
                    });
                }
                setInput(''); return;
            } else if (command === 'topic') {
                const TOPICS = [
                    "If you could instantly master any skill in the world, what would it be?",
                    "What is the best movie or TV show you have watched recently?",
                    "If you could travel anywhere in the universe right now, where would you go?",
                    "What is your ultimate comfort food?",
                    "If you could have dinner with any historical figure, who would it be?",
                    "What is a book or movie that completely changed your perspective?",
                    "What is the most underrated superpower?",
                    "If you could only listen to one album for the rest of your life, what would it be?",
                    "What is your favorite way to unwind after a long day?",
                    "If you could create a new holiday, what would it celebrate?"
                ];
                const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
                if (socket) {
                    socket.emit('broadcastSystemMessage', {
                        roomId: activeRoom._id,
                        content: `Conversation Starter:\n"${topic}"`
                    });
                }
                setInput(''); return;
            } else if (command === 'spoiler') {
                const secretText = args.slice(1).join(' ');
                if (!secretText.trim()) {
                    toast.error("Format: /spoiler <your secret text>");
                    return;
                }
                finalContent = JSON.stringify({ type: 'spoiler', text: secretText.trim() });
            } else if (command === 'quote') {
                const QUOTES = [
                    `"Simplicity is prerequisite for reliability." — Edsger W. Dijkstra`,
                    `"Code is like humor. When you have to explain it, it’s bad." — Cory House`,
                    `"Make it work, make it right, make it fast." — Kent Beck`,
                    `"First, solve the problem. Then, write the code." — John Johnson`,
                    `"Any fool can write code that a computer can understand. Good programmers write code that humans can understand." — Martin Fowler`,
                    `"Knowledge is power." — Francis Bacon`,
                    `"The only way to do great work is to love what you do." — Steve Jobs`
                ];
                const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
                if (socket) {
                    socket.emit('broadcastSystemMessage', {
                        roomId: activeRoom._id,
                        content: `${quote}`
                    });
                }
                setInput(''); return;
            } else if (command === 'timer') {
                const sec = parseInt(args[1]);
                if (isNaN(sec) || sec <= 0 || sec > 300) {
                    toast.error("Format: /timer <seconds> (1 to 300)");
                    return;
                }
                const senderName = profiles[currentUserId]?.displayName || 'Someone';
                const roomId = activeRoom._id;
                if (socket) {
                    socket.emit('broadcastSystemMessage', {
                        roomId: roomId,
                        content: `@${senderName} started a ${sec}-second timer.`
                    });
                }
                setTimeout(() => {
                    if (socket) {
                        socket.emit('broadcastSystemMessage', {
                            roomId: roomId,
                            content: `Timer expired! (${sec}s timer requested by @${senderName})`
                        });
                    }
                }, sec * 1000);
                setInput(''); return;
            } else if (command === 'roll') {
                const result = Math.floor(Math.random() * 6) + 1;
                if (socket) socket.emit('broadcastSystemMessage', { roomId: activeRoom._id, content: `@${profiles[currentUserId]?.displayName || 'Someone'} rolled a ${result}` });
                setInput(''); return;
            } else if (command === 'flip') {
                const result = Math.random() > 0.5 ? 'Heads' : 'Tails';
                if (socket) socket.emit('broadcastSystemMessage', { roomId: activeRoom._id, content: `@${profiles[currentUserId]?.displayName || 'Someone'} flipped a coin: ${result}` });
                setInput(''); return;
            } else if (command === '8ball') {
                const question = args.slice(1).join(' ');
                const answers = ["It is certain.", "It is decidedly so.", "Without a doubt.", "Yes - definitely.", "You may rely on it.", "As I see it, yes.", "Most likely.", "Outlook good.", "Yes.", "Signs point to yes.", "Reply hazy, try again.", "Ask again later.", "Better not tell you now.", "Cannot predict now.", "Concentrate and ask again.", "Don't count on it.", "My reply is no.", "My sources say no.", "Outlook not so good.", "Very doubtful."];
                const answer = answers[Math.floor(Math.random() * answers.length)];
                if (socket) socket.emit('broadcastSystemMessage', { roomId: activeRoom._id, content: `@${profiles[currentUserId]?.displayName || 'Someone'} asks the 8-Ball: ${question}\nAnswer: ${answer}` });
                setInput(''); return;
            } else if (command === 'shrug') {
                if (socket) socket.emit('broadcastSystemMessage', { roomId: activeRoom._id, content: `@${profiles[currentUserId]?.displayName || 'Someone'} ¯\\_(ツ)_/¯` });
                setInput(''); return;
            } else if (command === 'flip-table') {
                if (socket) socket.emit('broadcastSystemMessage', { roomId: activeRoom._id, content: `@${profiles[currentUserId]?.displayName || 'Someone'} (╯°□°)╯︵ ┻━┻` });
                setInput(''); return;
            } else if (command === 'vote') {
                const rest = args.slice(1).join(' ');
                const [question, optionsStr] = rest.split('options:');
                if (question && optionsStr) {
                    const options = optionsStr.split(',').map((o, i) => ({ id: String(i), text: o.trim() }));
                    finalContent = JSON.stringify({ type: 'poll', question: question.trim(), options });
                } else {
                    toast.error("Format: /vote <question> options: a, b, c");
                    return;
                }
            } else if (command === 'promote') {
                const targetId = findUser(args[1]);
                if (!targetId) {
                    toast.error(`User '${args[1] || ''}' not found in group`);
                } else {
                    try {
                        await promoteMember(activeRoom._id, targetId);
                        toast.success("Member promoted to admin!");
                    } catch (err: any) {
                        toast.error(err.response?.data?.message || err.message || "Failed to promote");
                    }
                }
                setInput(''); return;
            } else if (command === 'demote') {
                const targetId = findUser(args[1]);
                if (!targetId) {
                    toast.error(`User '${args[1] || ''}' not found in group`);
                } else {
                    try {
                        await demoteMember(activeRoom._id, targetId);
                        toast.success("Member demoted!");
                    } catch (err: any) {
                        toast.error(err.response?.data?.message || err.message || "Failed to demote");
                    }
                }
                setInput(''); return;
            } else if (command === 'kick') {
                const targetId = findUser(args[1]);
                if (!targetId) {
                    toast.error(`User '${args[1] || ''}' not found in group`);
                } else {
                    try {
                        await removeMember(activeRoom._id, targetId);
                        toast.success("Member removed from group");
                    } catch (err: any) {
                        toast.error(err.response?.data?.message || err.message || "Failed to remove member");
                    }
                }
                setInput(''); return;
            } else if (command === 'mute') {
                const targetId = findUser(args[1]);
                if (!targetId) {
                    toast.error(`User '${args[1] || ''}' not found in group`);
                } else {
                    const rawDuration = args[2] || '60s';
                    let ms = 60 * 1000;
                    let durationLabel = '60 seconds';

                    if (/^\d+s$/i.test(rawDuration)) {
                        const sec = parseInt(rawDuration);
                        ms = sec * 1000;
                        durationLabel = `${sec} second${sec === 1 ? '' : 's'}`;
                    } else if (/^\d+m$/i.test(rawDuration)) {
                        const min = parseInt(rawDuration);
                        ms = min * 60 * 1000;
                        durationLabel = `${min} minute${min === 1 ? '' : 's'}`;
                    } else if (/^\d+h$/i.test(rawDuration)) {
                        const hrs = parseInt(rawDuration);
                        ms = hrs * 60 * 60 * 1000;
                        durationLabel = `${hrs} hour${hrs === 1 ? '' : 's'}`;
                    } else if (/^\d+$/.test(rawDuration)) {
                        const sec = parseInt(rawDuration);
                        ms = sec * 1000;
                        durationLabel = `${sec} second${sec === 1 ? '' : 's'}`;
                    }

                    if (socket) {
                        socket.emit('muteMember', { roomId: activeRoom._id, memberId: targetId, durationMs: ms });
                        const targetName = profiles[targetId]?.displayName || 'Member';
                        socket.emit('broadcastSystemMessage', {
                            roomId: activeRoom._id,
                            content: `@${targetName} was muted for ${durationLabel} by @${profiles[currentUserId]?.displayName || 'Admin'}.`
                        });
                        toast.success(`Muted @${targetName} for ${durationLabel}`);
                    }
                }
                setInput(''); return;
            } else if (command === 'unmute') {
                const targetId = findUser(args[1]);
                if (!targetId) {
                    toast.error(`User '${args[1] || ''}' not found in group`);
                } else {
                    if (socket) {
                        socket.emit('unmuteMember', { roomId: activeRoom._id, memberId: targetId });
                        const targetName = profiles[targetId]?.displayName || 'Member';
                        socket.emit('broadcastSystemMessage', {
                            roomId: activeRoom._id,
                            content: `@${targetName} was unmuted by @${profiles[currentUserId]?.displayName || 'Admin'}.`
                        });
                        toast.success(`Unmuted @${targetName}`);
                    }
                }
                setInput(''); return;
            } else if (command === 'whisper') {
                const targetId = findUser(args[1]);
                const msg = args.slice(2).join(' ');
                if (targetId && msg) {
                    let dmRoom = rooms.find(r => r.kind === 'dm' && r.members.some(m => m.userId === targetId));
                    const sendWhisper = async () => {
                        if (!dmRoom) dmRoom = await createRoom({ kind: 'dm', members: [targetId] });
                        socketSend({ recipientUserId: targetId, senderUserId: currentUserId, roomId: dmRoom._id, content: msg });
                    };
                    sendWhisper();
                }
                setInput(''); return;
            } else if (command === 'request') {
                const type = args[1];
                const targetId = findUser(args[2]);
                const reason = args.slice(3).join(' ');
                if (targetId && socket) socket.emit('createRequest', { roomId: activeRoom._id, type, targetUserId: targetId, reason });
                setInput(''); return;
            } else if (command === 'requests') {
                const reqs = activeRoom.pendingRequests || [];
                const msg = reqs.map(r => `[${r.id}] ${r.type} @${profiles[r.targetUserId]?.displayName} (by @${profiles[r.requestedBy]?.displayName}) - ${r.reason}`).join('\n') || 'No pending requests';
                const helpMsg: ChatMessage = {
                    _id: 'local-' + Date.now(), roomId: activeRoom._id, senderId: 'system',
                    content: "Pending Requests:\n" + msg,
                    seenBy: [], isDeleted: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                };
                setMessages(prev => [...prev, helpMsg]);
                setInput(''); return;
            } else if (command === 'approve') {
                if (socket) socket.emit('approveRequest', { roomId: activeRoom._id, requestId: args[1] });
                const req = activeRoom.pendingRequests?.find(r => r.id === args[1]);
                if (req) {
                    if (req.type === 'kick') removeMember(activeRoom._id, req.targetUserId);
                    if (req.type === 'promote') promoteMember(activeRoom._id, req.targetUserId);
                    if (req.type === 'demote') demoteMember(activeRoom._id, req.targetUserId);
                    if (req.type === 'mute' && socket) socket.emit('muteMember', { roomId: activeRoom._id, memberId: req.targetUserId, durationMs: 10 * 60 * 1000 });
                    if (req.type === 'unmute' && socket) socket.emit('unmuteMember', { roomId: activeRoom._id, memberId: req.targetUserId });
                }
                setInput(''); return;
            } else if (command === 'deny') {
                if (socket) socket.emit('denyRequest', { roomId: activeRoom._id, requestId: args[1] });
                setInput(''); return;
            }
        }

        const isGroupChat = activeRoom.kind === 'group';
        const recipientUserId = isGroupChat ? undefined : activeRoom.members.find(m => m.userId !== currentUserId)?.userId;
        if (!isGroupChat && !recipientUserId) {
            toast.error("Cannot send message: recipient not found")
            return
        }

        const replyToId = replyingTo?._id;
        const oldReplyingTo = replyingTo;

        setInput('')
        setShowEmojiPicker(false)
        setReplyingTo(null)
        if (textareaRef.current) textareaRef.current.style.height = 'auto'
        if (typingTimer.current) clearTimeout(typingTimer.current)
        emitStopTyping(activeRoom._id)

        try {
            await socketSend({ recipientUserId, senderUserId: currentUserId, roomId: activeRoom._id, content: finalContent, replyTo: replyToId, isGroupChat })
        } catch {
            toast.error("Failed to send message")
            setInput(finalContent)
            setReplyingTo(oldReplyingTo)
        }
    }, [input, activeRoom, replyingTo, currentUserId, profiles, rooms, socket])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessageHandler() }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !activeRoom) return
        const isGroupChat = activeRoom.kind === 'group';
        const recipientUserId = isGroupChat ? undefined : activeRoom.members.find(m => m.userId !== currentUserId)?.userId;

        setUploadingFile(true)
        try {
            const res = await uploadFile(file)
            socketSend({
                recipientUserId,
                senderUserId: currentUserId,
                roomId: activeRoom._id,
                content: '',
                isGroupChat,
                attachments: [{ url: res.url, contentType: file.type, fileSize: file.size }],
                replyTo: replyingTo?._id
            })
            setReplyingTo(null)
        } catch (err: any) {
            toast.error("Upload failed: " + (err?.response?.data?.message || err.message))
        } finally {
            setUploadingFile(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleAudioSend = useCallback(async (blob: Blob, durationMs: number) => {
        if (!activeRoom) return;
        const isGroupChat = activeRoom.kind === 'group';
        const recipientUserId = isGroupChat ? undefined : activeRoom.members.find(m => m.userId !== currentUserId)?.userId;
        
        setSendingAudio(true);
        setIsAudioRecorderOpen(false);
        try {
            const rawBytes = new Uint8Array(await blob.arrayBuffer());
            const { encryptedBlob, blobKeyB64, blobNonceB64 } = await encryptBlob(rawBytes);
            const encryptedFile = new File([encryptedBlob as any], 'voice.enc', { type: 'application/octet-stream' });
            const res = await uploadFile(encryptedFile);

            await sendAudioMessage({
                recipientUserId,
                senderUserId: currentUserId,
                roomId: activeRoom._id,
                encryptedBlobUrl: res.url,
                blobKeyB64,
                blobNonceB64,
                fileSize: encryptedBlob.length,
                durationMs,
                isGroupChat
            });
        } catch (err: any) {
            toast.error("Voice message failed: " + err.message);
        } finally {
            setSendingAudio(false);
        }
    }, [activeRoom, currentUserId]);

    const handleForward = useCallback(async (targetRoom: Room) => {
        if (!forwardingMessage) return;
        const isGroupChat = targetRoom.kind === 'group';
        const recipientUserId = isGroupChat ? undefined : targetRoom.members.find(m => m.userId !== currentUserId)?.userId;
        try {
            await forwardMessage({
                recipientUserId,
                senderUserId: currentUserId,
                targetRoomId: targetRoom._id,
                isGroupChat,
                originalMessage: forwardingMessage,
            });
            toast.success("Message forwarded!");
            setForwardingMessage(null);
        } catch {
            toast.error("Failed to forward");
        }
    }, [forwardingMessage, currentUserId]);

    const handleScroll = useCallback(async (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget
        if (el.scrollTop === 0 && hasMore && !msgsLoading && activeRoom) {
            const nextPage = page + 1
            setMsgsLoading(true)
            try {
                const older = await getMessages(activeRoom._id, nextPage, 50)
                const decryptedOlder = await Promise.all(older.map(m => decryptIncomingMessage(m)))
                setMessages(prev => [...decryptedOlder.reverse(), ...prev])
                setPage(nextPage)
                setHasMore(older.length === 50)
            } catch {
                toast.error('Could not load older messages')
            } finally {
                setMsgsLoading(false)
            }
        }
    }, [activeRoom, hasMore, msgsLoading, page])

    const grouped = groupByDate(messages)

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-[#080808]">
            <AnimatePresence>
                {isCreateGroupOpen && (
                    <CreateGroupModal
                        onClose={() => setIsCreateGroupOpen(false)}
                        onCreate={async (groupName, members, avatar) => {
                            try {
                                const room = await createRoom({ kind: 'group', members, name: groupName, avatar })
                                setRooms(prev => [room, ...prev])
                                setActiveRoom(room)
                                setIsCreateGroupOpen(false)
                                toast.success("Group created!")
                            } catch {
                                toast.error("Failed to create group")
                            }
                        }}
                    />
                )}
                {showGroupInfo && activeRoom && activeRoom.kind === 'group' && (
                    <GroupInfoModal
                        room={activeRoom}
                        onClose={() => setShowGroupInfo(false)}
                        profiles={profiles}
                        currentUserId={currentUserId}
                        onRoomUpdated={(updatedRoom) => {
                            setRooms(prev => prev.map(r => r._id === updatedRoom._id ? { ...updatedRoom, lastMessageRecord: r.lastMessageRecord } : r))
                            setActiveRoom(prev => prev?._id === updatedRoom._id ? { ...updatedRoom, lastMessageRecord: prev.lastMessageRecord } : prev)
                        }}
                        onLeave={() => {
                            setRooms(prev => prev.filter(r => r._id !== activeRoom._id))
                            setActiveRoom(null)
                            setShowGroupInfo(false)
                        }}
                    />
                )}
                {isAudioRecorderOpen && (
                    <AudioRecorderModal
                        onClose={() => setIsAudioRecorderOpen(false)}
                        onSend={handleAudioSend}
                    />
                )}
                {forwardingMessage && (
                    <ForwardModal
                        message={forwardingMessage}
                        rooms={rooms}
                        profiles={profiles}
                        currentUserId={currentUserId}
                        onClose={() => setForwardingMessage(null)}
                        onForward={handleForward}
                    />
                )}
            </AnimatePresence>

            <div className="w-full flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* ── Left Sidebar: Chat List & App Header ───────────────────────── */}
                <div className={`h-full w-full md:w-80 bg-[#121212] border-r border-[#27272a] flex-col flex-shrink-0 ${activeRoom ? 'hidden md:flex' : 'flex'}`}>
                    {/* App Branding Top Bar */}
                    <div className="h-16 border-b border-[#27272a] px-4 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-white text-black font-bold text-sm flex items-center justify-center rounded-sm">
                                T
                            </div>
                            <span className="font-bold text-base text-neutral-100 tracking-tight">
                                TALKIE
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-neutral-400">
                            <button onClick={() => setIsCreateGroupOpen(true)} title="Create Group" className="p-1.5 hover:text-white transition-colors cursor-pointer">
                                <Users size={18} />
                            </button>
                            <button onClick={() => router.push('/buddies')} title="Buddies" className="p-1.5 hover:text-white transition-colors relative cursor-pointer">
                                <SquarePen size={18} />
                                {hasPendingRequests && (
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="p-3 border-b border-[#27272a]">
                        <Input
                            placeholder="Search conversations..."
                            leftElement={<Search className="w-4 h-4 text-neutral-500" />}
                        />
                    </div>

                    {/* Chat Rooms Directory */}
                    <div className="flex-1 overflow-y-auto flex flex-col">
                        {roomsLoading ? (
                            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-neutral-500" /></div>
                        ) : rooms.length === 0 ? (
                            <p className="text-center text-xs text-neutral-500 py-12">No conversations yet</p>
                        ) : rooms.map(room => {
                            const otherId = room.kind === 'dm' ? room.members.find(m => m.userId !== currentUserId)?.userId : null;
                            const hasUnseenStory = (otherId && otherId !== currentUserId) ? storiesFeed.some(entry => entry._id === otherId && entry.stories.some(s => !(s.viewedBy && s.viewedBy[currentUserId]))) : false;
                            return (
                                <RoomItem
                                    key={room._id}
                                    room={room}
                                    isActive={activeRoom?._id === room._id}
                                    currentUserId={currentUserId}
                                    onClick={() => setActiveRoom(room)}
                                    profiles={profiles}
                                    hasUnseenStory={hasUnseenStory}
                                />
                            )
                        })}
                    </div>
                </div>

                {/* ── Main Chat Area ─────────────────────────────────────────────── */}
                <div className={`h-full flex-1 bg-[#080808] flex-col ${!activeRoom ? 'hidden md:flex' : 'flex'}`}>
                    {!activeRoom ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-neutral-500 gap-2 bg-grid-pattern">
                            <ShieldCheck className="w-8 h-8 text-neutral-600 mb-2" />
                            <span>Select a conversation to start messaging</span>
                        </div>
                    ) : (
                        <>
                            {/* Active Chat Header with Prominent DP */}
                            <div className="h-16 flex-shrink-0 bg-[#121212] border-b border-[#27272a] flex items-center justify-between px-4 sm:px-6">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setActiveRoom(null)} className="md:hidden text-neutral-400 hover:text-white p-1">
                                        <ArrowLeft size={18} />
                                    </button>

                                    {/* Display Picture (DP) */}
                                    <div className="relative shrink-0">
                                        {(() => {
                                            const otherId = activeRoom.members.find(m => m.userId !== currentUserId)?.userId;
                                            const otherProfile = otherId ? profiles[otherId] : null;
                                            const avatar = activeRoom.kind === 'dm' ? otherProfile?.avatar : activeRoom.avatar;
                                            const title = activeRoom.kind === 'dm'
                                                ? (otherProfile?.displayName ?? 'Direct Message')
                                                : (activeRoom.name ?? 'Group Chat');

                                            return avatar ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={avatar} alt={title} className="h-10 w-10 rounded-full object-cover border border-neutral-700" />
                                            ) : (
                                                <div className="h-10 w-10 bg-neutral-800 text-white font-bold text-sm flex items-center justify-center rounded-full border border-neutral-700">
                                                    {title[0]?.toUpperCase()}
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Name & Status */}
                                    <div
                                        className={`flex flex-col text-left ${activeRoom.kind === 'group' ? 'cursor-pointer hover:opacity-80' : ''}`}
                                        onClick={() => activeRoom.kind === 'group' && setShowGroupInfo(true)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <h2 className="text-sm font-bold text-neutral-100 tracking-tight">
                                                {activeRoom.kind === 'dm'
                                                    ? (profiles[activeRoom.members.find(m => m.userId !== currentUserId)?.userId ?? '']?.displayName ?? 'Direct Message')
                                                    : (activeRoom.name ?? 'Group Chat')}
                                            </h2>
                                            <Badge variant="active" dot>E2EE</Badge>
                                        </div>
                                        <span className="text-xs text-neutral-500">
                                            {activeRoom.kind === 'dm'
                                                ? (profiles[activeRoom.members.find(m => m.userId !== currentUserId)?.userId ?? '']?.isOnline ? 'Online' : 'Offline')
                                                : `${activeRoom.members.length} members`}
                                        </span>
                                    </div>
                                </div>

                                <VideoCallOverlay
                                    roomId={activeRoom._id}
                                    activeRoomName={activeRoom.kind === 'dm' ? (profiles[activeRoom.members.find(m => m.userId !== currentUserId)?.userId ?? '']?.displayName ?? 'Direct Message') : (activeRoom.name ?? 'Group Chat')}
                                />
                            </div>

                            {/* Messages Stream */}
                            <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-1" onScroll={handleScroll}>
                                {msgsLoading && page === 1 ? (
                                    <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-neutral-500" /></div>
                                ) : (
                                    <>
                                        {msgsLoading && page > 1 && (
                                            <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-neutral-500" /></div>
                                        )}
                                        {grouped.map(group => (
                                            <React.Fragment key={group.date}>
                                                <DateSeparator label={group.date} />
                                                {group.msgs.map(msg => {
                                                    let targetMsg = msg.replyTo ? messages.find(m => m._id === msg.replyTo) : undefined;
                                                    const targetName = targetMsg ? (targetMsg.senderId === currentUserId ? 'yourself' : (profiles[targetMsg.senderId]?.displayName || 'someone')) : undefined;

                                                    if (msg.senderId === 'system') {
                                                        return (
                                                            <div key={msg._id} className="w-full flex justify-center my-2">
                                                                <div className="bg-[#161616] text-neutral-400 text-xs px-3 py-1.5 rounded-sm border border-[#27272a] max-w-[85%] text-center font-mono">
                                                                    {msg.content}
                                                                </div>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <MessageBubble
                                                            key={msg._id}
                                                            msg={msg}
                                                            isMine={msg.senderId === currentUserId}
                                                            currentUserId={currentUserId}
                                                            onReply={() => setReplyingTo(msg)}
                                                            onForward={() => setForwardingMessage(msg)}
                                                            replyTarget={targetMsg}
                                                            replyTargetName={targetName}
                                                            onReact={(emoji) => {
                                                                if (activeRoom) reactToMessage(activeRoom._id, msg._id, emoji)
                                                            }}
                                                            onVotePoll={(msgId, optionId) => {
                                                                if (socket && activeRoom) socket.emit('voteOnPoll', { roomId: activeRoom._id, messageId: msgId, optionId })
                                                            }}
                                                        />
                                                    )
                                                })}
                                            </React.Fragment>
                                        ))}
                                        {isTyping && <TypingIndicator />}
                                        <div ref={bottomRef} />
                                    </>
                                )}
                            </div>

                            {/* Replying Banner */}
                            {replyingTo && (
                                <div className="flex-shrink-0 bg-[#121212] border-t border-[#27272a] px-4 py-2 flex items-center justify-between text-xs">
                                    <div className="flex flex-col border-l-2 border-white pl-2 text-left truncate">
                                        <span className="text-xs text-neutral-400">Replying to {replyingTo.senderId === currentUserId ? 'yourself' : profiles[replyingTo.senderId]?.displayName || 'someone'}</span>
                                        <span className="text-neutral-200 truncate">{replyingTo.content || 'Attachment'}</span>
                                    </div>
                                    <button onClick={() => setReplyingTo(null)} className="text-neutral-500 hover:text-white p-1 cursor-pointer">
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Message Input Box with Commands Popover */}
                            <div className="flex-shrink-0 p-3 bg-[#121212] border-t border-[#27272a] flex items-end gap-2 relative" ref={emojiPickerRef}>
                                {/* Commands Autocomplete Popover */}
                                {filteredCommands.length > 0 && (
                                    <div className="absolute bottom-full left-4 mb-2 bg-[#161616] border border-[#27272a] p-1.5 flex flex-col gap-1 w-[280px] max-h-[220px] overflow-y-auto z-50 rounded-sm shadow-2xl">
                                        {filteredCommands.map(c => (
                                            <button
                                                key={c.command}
                                                onClick={() => {
                                                    setInput(c.command + ' ');
                                                    textareaRef.current?.focus();
                                                }}
                                                className="text-left p-2 hover:bg-[#252525] flex flex-col group transition-colors cursor-pointer rounded-xs"
                                            >
                                                <span className="text-white font-mono text-xs font-bold">{c.command}</span>
                                                <span className="text-[11px] text-neutral-400">{c.description}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {commandHint && (
                                    <div className="absolute bottom-full left-4 mb-2 bg-[#161616] border border-[#27272a] p-3 flex flex-col gap-1 w-auto max-w-[360px] z-50 rounded-sm shadow-2xl">
                                        <span className="text-neutral-400 font-mono text-xs uppercase">Usage</span>
                                        <span className="text-white font-mono text-xs bg-black/40 p-1.5 rounded-xs border border-neutral-800">{commandHint.usage}</span>
                                        <span className="text-neutral-400 text-xs mt-0.5">{commandHint.description}</span>
                                    </div>
                                )}

                                {mentionSuggestions.length > 0 && (
                                    <div className="absolute bottom-full left-4 mb-2 bg-[#161616] border border-[#27272a] p-1 flex flex-col gap-1 w-[240px] max-h-[220px] overflow-y-auto z-50 rounded-sm shadow-2xl">
                                        {mentionSuggestions.map(user => (
                                            <button
                                                key={user.id}
                                                onClick={() => {
                                                    const match = input.match(/(?:^|\s)(@\w*)$/);
                                                    if (match) {
                                                        const replacement = `@${user.username} `;
                                                        const newInput = input.substring(0, match.index) + (match[0].startsWith(' ') ? ' ' : '') + replacement;
                                                        setInput(newInput);
                                                        textareaRef.current?.focus();
                                                    }
                                                }}
                                                className="text-left p-2 hover:bg-[#252525] flex items-center gap-2.5 cursor-pointer rounded-xs"
                                            >
                                                {user.avatar ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={user.avatar} alt={user.displayName} className="w-6 h-6 rounded-full object-cover" />
                                                ) : (
                                                    <div className="h-6 w-6 bg-neutral-800 text-white font-bold text-xs flex items-center justify-center rounded-full">
                                                        {user.displayName[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                                <div className="flex flex-col text-left">
                                                    <span className="text-white font-semibold text-xs">{user.displayName}</span>
                                                    <span className="text-[10px] text-neutral-400">@{user.username}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {showEmojiPicker && (
                                    <div className="absolute bottom-full left-4 mb-2 z-50">
                                        <EmojiPicker
                                            theme={Theme.DARK}
                                            onEmojiClick={(emojiData: EmojiClickData) => setInput(prev => prev + emojiData.emoji)}
                                        />
                                    </div>
                                )}

                                <button
                                    onClick={() => setShowEmojiPicker(prev => !prev)}
                                    className="h-10 w-10 flex-shrink-0 bg-[#18181b] border border-[#27272a] flex items-center justify-center text-neutral-400 hover:text-white transition-colors rounded-sm cursor-pointer"
                                >
                                    <Smile size={18} />
                                </button>

                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingFile}
                                    className="h-10 w-10 flex-shrink-0 bg-[#18181b] border border-[#27272a] flex items-center justify-center text-neutral-400 hover:text-white transition-colors rounded-sm cursor-pointer disabled:opacity-50"
                                >
                                    {uploadingFile ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
                                </button>

                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={handleInput}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Type a message or /command..."
                                    rows={1}
                                    className="flex-1 bg-[#18181b] text-neutral-100 placeholder:text-neutral-600 px-3 py-2.5 text-sm border border-[#27272a] rounded-sm focus:outline-none focus:border-neutral-400 transition-all resize-none max-h-32 overflow-y-auto leading-relaxed"
                                    style={{ minHeight: '40px' }}
                                />

                                <Button
                                    onClick={() => input.trim() ? sendMessageHandler() : setIsAudioRecorderOpen(true)}
                                    variant="primary"
                                    size="md"
                                    className="h-10 w-10 px-0 shrink-0"
                                >
                                    {input.trim() ? <Send size={16} /> : <Mic size={16} />}
                                </Button>
                            </div>
                        </>
                    )}
                </div>

                {/* ── Right Sidebar Navigation ──────────────────────────────────── */}
                <div className="h-14 w-full md:h-full md:w-14 bg-[#121212] border-t md:border-l md:border-t-0 border-[#27272a] flex-shrink-0 flex flex-row md:flex-col items-center justify-around md:justify-start py-0 md:py-4 gap-3 order-last">
                    {[
                        { href: '/chat', icon: <MessageSquare size={18} />, title: 'Chats' },
                        { href: '/stories', icon: <Play size={18} />, title: 'Stories', dot: hasAnyUnseenStory },
                        { href: '/search', icon: <Search size={18} />, title: 'Search' },
                        { href: '/buddies', icon: <Users size={18} />, title: 'Buddies' },
                        { href: '/settings', icon: <Settings size={18} />, title: 'Settings' },
                        { href: '/profile/me', icon: <UserCircle size={18} />, title: 'My Profile' },
                    ].map(({ href, icon, title, dot }) => {
                        const isActive = pathname === href
                        return (
                            <Link
                                key={href}
                                href={href}
                                title={title}
                                className={`w-9 h-9 flex items-center justify-center rounded-sm transition-all relative ${
                                    isActive
                                        ? 'bg-white text-black font-bold'
                                        : 'text-neutral-500 hover:text-neutral-200 hover:bg-[#18181b]'
                                }`}
                            >
                                {icon}
                                {dot && (
                                    <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-400 rounded-full" />
                                )}
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

const ChatPage = () => {
    return (
        <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#080808]"><Loader2 size={24} className="animate-spin text-white" /></div>}>
            <ChatInner />
        </React.Suspense>
    )
}

export default ChatPage