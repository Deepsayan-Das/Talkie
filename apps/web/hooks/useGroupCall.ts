import { useCallback, useRef, useState } from 'react';
import { getIceServer } from '@/lib/webrtc';
import { getSocket } from '@/lib/socket';

export function useGroupCall(roomId: string) {
    const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);
    const [callState, setCallState] = useState<'idle' | 'calling' | 'connected'>('idle');

    const createPeerFor = useCallback(async (targetUserId: string, token: string) => {
        const iceServers = await getIceServer();
        const pc = new RTCPeerConnection({ iceServers });

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
        }

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                getSocket(token).emit('iceCandidate', { targetUserId, candidate: e.candidate });
            }
        };
        
        pc.ontrack = (e) => {
            setRemoteStreams((prev) => {
                const next = new Map(prev);
                next.set(targetUserId, e.streams[0]);
                return next;
            });
        };

        peersRef.current.set(targetUserId, pc);
        return pc;
    }, []);

    const joinCall = useCallback(async (video: boolean, token: string, onError?: (err: string) => void) => {
        try {
            localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video });
            const socket = getSocket(token);
            
            socket.emit('joinCall', { roomId }, (err?: string) => {
                if (err) {
                    if (onError) onError(err);
                    return;
                }
                
                setCallState('connected');
                
                // Fetch existing participants
                socket.emit('getExistingParticipants', { roomId }, async (existingUserIds: string[]) => {
                    for (const userId of existingUserIds) {
                        const pc = await createPeerFor(userId, token);
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        socket.emit('callUser', { roomId, targetUserId: userId, offer });
                    }
                });
            });
        } catch (err) {
            console.error('Failed to join call:', err);
        }
    }, [roomId, createPeerFor]);

    const leaveCall = useCallback((token: string) => {
        const socket = getSocket(token);
        socket.emit('leaveCall', { roomId });
        
        peersRef.current.forEach(pc => pc.close());
        peersRef.current.clear();
        
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        
        setRemoteStreams(new Map());
        setCallState('idle');
    }, [roomId]);

    const onIncomingCall = useCallback(async ({ offer, callerId }: any, token: string) => {
        const pc = await createPeerFor(callerId, token);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        getSocket(token).emit('callAnswered', { targetUserId: callerId, answer });
    }, [createPeerFor]);

    const onCallAnswered = useCallback(async ({ answer, answererId }: any) => {
        const pc = peersRef.current.get(answererId);
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
    }, []);

    const onIceCandidate = useCallback(async ({ candidate, fromUserId }: any) => {
        const pc = peersRef.current.get(fromUserId);
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }, []);

    const onParticipantLeft = useCallback(({ userId }: any) => {
        const pc = peersRef.current.get(userId);
        if (pc) {
            pc.close();
            peersRef.current.delete(userId);
        }
        setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
        });
    }, []);
    
    const onNewParticipant = useCallback(async ({ userId }: any, token: string) => {
        // Just acknowledging that someone joined, we wait for their offer
    }, []);

    return { 
        callState,
        localStreamRef,
        remoteStreams, 
        joinCall, 
        leaveCall,
        onIncomingCall, 
        onCallAnswered, 
        onIceCandidate, 
        onParticipantLeft,
        onNewParticipant
    };
}
