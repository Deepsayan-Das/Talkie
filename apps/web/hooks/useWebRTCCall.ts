import { getSocket } from "@/lib/socket";
import { getIceServer } from "@/lib/webrtc";
import { useCallback, useRef, useState } from "react";

export function useWebRTCCall(roomId: string) {
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'disconnected'>('idle');
    
    const createPeerConnection = useCallback(
        async (onIceCandidate: (c: RTCIceCandidate) => void) => {
            const iceServers = await getIceServer();
            const pc = new RTCPeerConnection({
                iceServers
            });

            pc.onicecandidate = (e) => {
                if (e.candidate)
                    onIceCandidate(e.candidate);
            }
            pc.ontrack = (e) => {
                setRemoteStream(e.streams[0]);
            }
            pcRef.current = pc;
            return pc;
        }, []
    )

    const startLocalMedia = useCallback(async (video: boolean) => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
        localStreamRef.current = stream;
        return stream;
    }, []);

    const startCall = useCallback(async (video: boolean, token: string) => {
        const socket = getSocket(token);
        const stream = await startLocalMedia(video);
        const pc = await createPeerConnection((candidate) => {
            socket.emit('iceCandidate', { roomId, candidate });
        });

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('callUser', { roomId, offer });

        setCallState('calling');
    }, [roomId, startLocalMedia, createPeerConnection]);

    const answerCall = useCallback(async (offer: RTCSessionDescriptionInit, video: boolean, token: string) => {
        const socket = getSocket(token);
        const stream = await startLocalMedia(video);
        const pc = await createPeerConnection((candidate) => {
            socket.emit('iceCandidate', { roomId, candidate });
        });

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('callAnswered', { roomId, answer });

        setCallState('connected');
    }, [roomId, startLocalMedia, createPeerConnection]);

    const handleCallAnswered = useCallback(async (answer: RTCSessionDescriptionInit) => {
        if (pcRef.current) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
            setCallState('connected');
        }
    }, []);

    const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
        if (pcRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }, []);

    return { 
        pcRef, 
        localStreamRef, 
        remoteStream, 
        callState, 
        setCallState, 
        createPeerConnection, 
        startLocalMedia,
        startCall,
        answerCall,
        handleCallAnswered,
        handleIceCandidate
    };
}
