import React, { useEffect, useState, useRef } from 'react';
import { useGroupCall } from '@/hooks/useGroupCall';
import { useSocket } from '@/context/SocketContext';
import { useAuth } from '@/context/AuthContext';
import { Video, PhoneOff, Mic, MicOff, VideoOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const RemoteVideo = ({ stream, index, total }: { stream: MediaStream, index: number, total: number }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className="relative bg-black rounded-xl overflow-hidden border-2 border-[#333] shadow-lg flex items-center justify-center h-full w-full">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />
        </div>
    );
};

export const VideoCallOverlay = ({ roomId, activeRoomName }: { roomId: string, activeRoomName?: string }) => {
    const { socket } = useSocket();
    const { accessToken } = useAuth();
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const {
        callState, localStreamRef, remoteStreams,
        joinCall, leaveCall,
        onIncomingCall, onCallAnswered, onIceCandidate, onParticipantLeft, onNewParticipant
    } = useGroupCall(roomId);

    const localVideoRef = useRef<HTMLVideoElement>(null);

    // Sync local stream to local video element
    useEffect(() => {
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
    }, [localStreamRef.current, callState]);

    // Socket Listeners
    useEffect(() => {
        if (!socket || !accessToken) return;

        const handleIncomingCall = (data: any) => onIncomingCall(data, accessToken);
        const handleCallAnswered = (data: any) => onCallAnswered(data);
        const handleIceCandidate = (data: any) => onIceCandidate(data);
        const handleNewParticipant = (data: any) => onNewParticipant(data, accessToken);
        const handleParticipantLeft = (data: any) => onParticipantLeft(data);

        socket.on('incomingCall', handleIncomingCall);
        socket.on('callAnswered', handleCallAnswered);
        socket.on('iceCandidate', handleIceCandidate);
        socket.on('newParticipant', handleNewParticipant);
        socket.on('participantLeft', handleParticipantLeft);

        return () => {
            socket.off('incomingCall', handleIncomingCall);
            socket.off('callAnswered', handleCallAnswered);
            socket.off('iceCandidate', handleIceCandidate);
            socket.off('newParticipant', handleNewParticipant);
            socket.off('participantLeft', handleParticipantLeft);
        };
    }, [socket, accessToken, onIncomingCall, onCallAnswered, onIceCandidate, onNewParticipant, onParticipantLeft]);

    const handleJoinCall = async () => {
        if (!accessToken) return;
        await joinCall(true, accessToken, (err) => {
            toast.error(err);
        });
    };

    const handleLeaveCall = () => {
        if (!accessToken) return;
        leaveCall(accessToken);
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(t => {
                t.enabled = !t.enabled;
            });
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach(t => {
                t.enabled = !t.enabled;
            });
            setIsVideoOff(!isVideoOff);
        }
    };

    const streamsArray = Array.from(remoteStreams.values());

    return (
        <>
            {/* Minimal button to join/start call */}
            {callState === 'idle' && (
                <button
                    onClick={handleJoinCall}
                    className="w-10 h-10 flex items-center justify-center transition-colors text-[#555] hover:text-[#ff4d00] hover:bg-[#ff4d00]/10"
                    style={{ clipPath: 'polygon(6px 0%,100% 0%,100% calc(100% - 6px),calc(100% - 6px) 100%,0% 100%,0% 6px)' }}
                    title="Join Video Call"
                >
                    <Video size={20} />
                </button>
            )}

            <AnimatePresence>
                {callState === 'connected' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 backdrop-blur-md z-[500] flex items-center justify-center p-4"
                    >
                        <div className="w-full max-w-6xl h-[90vh] flex flex-col gap-4">
                            <div className="flex-1 relative bg-[#111] rounded-2xl overflow-hidden border-2 border-[#333] shadow-2xl p-4">
                                
                                {/* Mesh Video Grid */}
                                {streamsArray.length === 0 ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-[#555]">
                                        <Loader2 size={48} className="animate-spin mb-4 text-[#ff4d00]" />
                                        <p className="font-bold tracking-widest uppercase text-white/50">Waiting for others to join...</p>
                                    </div>
                                ) : (
                                    <div className={`w-full h-full grid gap-4 ${
                                        streamsArray.length === 1 ? 'grid-cols-1' :
                                        streamsArray.length === 2 ? 'grid-cols-2' :
                                        'grid-cols-2 grid-rows-2'
                                    }`}>
                                        {streamsArray.map((stream, idx) => (
                                            <RemoteVideo key={stream.id} stream={stream} index={idx} total={streamsArray.length} />
                                        ))}
                                    </div>
                                )}

                                {/* Local Video (PIP or Grid cell depending on design) */}
                                <div className="absolute bottom-6 right-6 w-48 aspect-video bg-black rounded-xl overflow-hidden border-2 border-[#ff4d00] shadow-2xl z-10">
                                    <video
                                        ref={localVideoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className={`w-full h-full object-cover ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
                                    />
                                    {isVideoOff && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-[#222]">
                                            <VideoOff size={24} className="text-[#555]" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Call Controls */}
                            <div className="flex items-center justify-center gap-6 py-4">
                                <button onClick={toggleMute} className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-lg ${isMuted ? 'bg-red-500/20 text-red-500 border-2 border-red-500' : 'bg-[#333] hover:bg-[#444] text-white border-2 border-transparent'}`}>
                                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                                </button>
                                <button onClick={handleLeaveCall} className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white shadow-xl shadow-red-500/20 transition-all hover:scale-105 border-2 border-red-400">
                                    <PhoneOff size={28} />
                                </button>
                                <button onClick={toggleVideo} className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors shadow-lg ${isVideoOff ? 'bg-red-500/20 text-red-500 border-2 border-red-500' : 'bg-[#333] hover:bg-[#444] text-white border-2 border-transparent'}`}>
                                    {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
