const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
];
function encodeBase64(payload) {
    const g = globalThis;
    if (typeof g !== 'undefined' && typeof g.btoa === 'function') {
        return g.btoa(payload);
    }
    throw new Error('Base64 encoding unavailable in this runtime');
}
function decodeBase64(payload) {
    const g = globalThis;
    if (typeof g !== 'undefined' && typeof g.atob === 'function') {
        return g.atob(payload);
    }
    throw new Error('Base64 decoding unavailable in this runtime');
}
export function serialiseSignal(signal) {
    const payload = JSON.stringify(signal);
    const safe = encodeURIComponent(payload);
    return encodeBase64(safe);
}
export function deserialiseSignal(code) {
    const decoded = decodeBase64(code);
    const restored = decodeURIComponent(decoded);
    return JSON.parse(restored);
}
export function createDataChannelPeer(events, iceServers = ICE_SERVERS) {
    const peer = new RTCPeerConnection({ iceServers });
    const channel = peer.createDataChannel('greyfall');
    channel.addEventListener('open', () => events.onOpen?.(channel));
    channel.addEventListener('close', (event) => events.onClose?.(event));
    channel.addEventListener('error', (event) => events.onError?.(event));
    channel.addEventListener('message', (event) => {
        try {
            const payload = JSON.parse(event.data);
            events.onMessage(payload, channel);
        }
        catch (error) {
            console.error('Failed to parse message', error);
        }
    });
    return { peer, channel };
}
export async function startHostSession(events, onIceCandidate) {
    const { peer, channel } = createDataChannelPeer(events);
    let appliedAnswerSdp = null;
    peer.addEventListener('icecandidate', (event) => {
        if (!event.candidate)
            return;
        try {
            onIceCandidate?.(event.candidate.toJSON());
        }
        catch (error) {
            console.warn('[webrtc] host icecandidate error', error);
        }
    });
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const offerSignal = { type: 'offer', sdp: offer.sdp ?? '' };
    let currentOfferCode = serialiseSignal(offerSignal);
    async function acceptAnswer(answerCode) {
        const signal = deserialiseSignal(answerCode);
        if (signal.type !== 'answer') {
            throw new Error('Provided answer code is not an RTC answer');
        }
        if (appliedAnswerSdp && appliedAnswerSdp === signal.sdp) {
            console.debug('[webrtc] duplicate answer ignored');
            return;
        }
        const state = peer.signalingState;
        if (state === 'stable') {
            if (peer.currentRemoteDescription?.sdp === signal.sdp) {
                console.debug('[webrtc] identical answer already applied');
                appliedAnswerSdp = signal.sdp;
                return;
            }
            console.warn('[webrtc] host received answer while stable; ignoring new answer');
            return;
        }
        if (state !== 'have-local-offer') {
            console.warn('[webrtc] host acceptAnswer unexpected signaling state', { state });
            return;
        }
        await peer.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
        appliedAnswerSdp = signal.sdp;
    }
    const refreshOffer = async (options = { iceRestart: true }) => {
        const refreshedOffer = await peer.createOffer(options);
        await peer.setLocalDescription(refreshedOffer);
        const refreshedSignal = { type: 'offer', sdp: refreshedOffer.sdp ?? '' };
        currentOfferCode = serialiseSignal(refreshedSignal);
        return currentOfferCode;
    };
    const hostSession = {
        role: 'host',
        peer,
        channel,
        close: () => peer.close(),
        get offerCode() {
            return currentOfferCode;
        },
        acceptAnswer,
        refreshOffer
    };
    return hostSession;
}
export async function joinHostSession(joinCode, events, onAnswer, onIceCandidate) {
    console.debug('[webrtc] joinHostSession start', { joinCodePreview: joinCode.slice(0, 32) });
    const decoded = decodeBase64(joinCode);
    console.debug('[webrtc] base64 decoded', { decodedPreview: decoded.slice(0, 32) });
    const restored = decodeURIComponent(decoded);
    console.debug('[webrtc] uri decoded', { restoredPreview: restored.slice(0, 32) });
    const signal = JSON.parse(restored);
    console.debug('[webrtc] parsed signal', { type: signal.type, sdpLength: signal.sdp?.length ?? 0 });
    if (signal.type !== 'offer') {
        throw new Error('Join code is not a valid RTC offer');
    }
    const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peer.addEventListener('icecandidate', (event) => {
        if (!event.candidate)
            return;
        try {
            onIceCandidate?.(event.candidate.toJSON());
        }
        catch (error) {
            console.warn('[webrtc] guest icecandidate error', error);
        }
    });
    const channelPromise = new Promise((resolve) => {
        peer.addEventListener('datachannel', (event) => {
            const channel = event.channel;
            channel.addEventListener('open', () => events.onOpen?.(channel));
            channel.addEventListener('close', (ev) => events.onClose?.(ev));
            channel.addEventListener('error', (ev) => events.onError?.(ev));
            channel.addEventListener('message', (messageEvent) => {
                try {
                    const payload = JSON.parse(messageEvent.data);
                    events.onMessage(payload, channel);
                }
                catch (error) {
                    console.error('Failed to parse message', error);
                }
            });
            resolve(channel);
        });
    });
    await peer.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
    console.debug('[webrtc] remote description set');
    const answer = await peer.createAnswer();
    console.debug('[webrtc] answer created', { sdpLength: answer.sdp?.length ?? 0 });
    await peer.setLocalDescription(answer);
    console.debug('[webrtc] local description set');
    const answerSignal = { type: 'answer', sdp: answer.sdp ?? '' };
    const answerCode = serialiseSignal(answerSignal);
    try {
        onAnswer?.(answerCode);
    }
    catch (error) {
        console.error('[webrtc] onAnswer callback failed', error);
    }
    console.debug('[webrtc] serialised answer', { answerCodePreview: answerCode.slice(0, 32) });
    const channel = await channelPromise;
    console.debug('[webrtc] datachannel ready');
    return {
        role: 'guest',
        peer,
        channel,
        close: () => peer.close(),
        answerCode
    };
}
export function createHostPeer(events, iceServers = ICE_SERVERS) {
    const peer = new RTCPeerConnection({ iceServers });
    const channel = peer.createDataChannel('greyfall');
    channel.addEventListener('open', () => events.onOpen?.(channel));
    channel.addEventListener('close', (ev) => events.onClose?.(ev));
    channel.addEventListener('error', (ev) => events.onError?.(ev));
    channel.addEventListener('message', (messageEvent) => {
        try {
            const payload = JSON.parse(messageEvent.data);
            events.onMessage(payload, channel);
        }
        catch (error) {
            console.error('Failed to parse message', error);
        }
    });
    return { peer, channel };
}
export async function createOfferCodeForPeer(peer, options) {
    const offer = await peer.createOffer(options);
    await peer.setLocalDescription(offer);
    const offerSignal = { type: 'offer', sdp: offer.sdp ?? '' };
    return serialiseSignal(offerSignal);
}
export async function applyAnswerCodeToPeer(peer, answerCode) {
    const signal = deserialiseSignal(answerCode);
    if (signal.type !== 'answer')
        throw new Error('Provided answer code is not an RTC answer');
    await peer.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
}
