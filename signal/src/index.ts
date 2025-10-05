import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { WebSocket, WebSocketServer } from 'ws';
import {
  createSignalServerMessage,
  parseSignalClientMessage,
  SignalServerMessage
} from './protocol/schema.js';

type Role = 'host' | 'guest';

type Peer = {
  role: Role;
  socket: WebSocket;
  peerId?: string;
};

type Session = {
  id: string;
  createdAt: number;
  host?: Peer;
  guests: Map<string, Peer>;
  lastOffers: Map<string, string>;
  pendingForGuest: Map<string, string[]>; // key: peerId
  pendingForHost: Map<string, string[]>; // key: peerId
};

const sessions = new Map<string, Session>();
const MAX_GUESTS = 3; // host + 3 guests = 4 players

const SESSION_TTL_MS = 1000 * 60 * 30; // 30 minutes
const PORT = Number(process.env.PORT ?? 8787);

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  maxAge: 86400
}));
app.options('*', cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', sessions: sessions.size });
});

app.post('/sessions', (_req, res) => {
  const id = generateSessionId();
  sessions.set(id, {
    id,
    createdAt: Date.now(),
    guests: new Map(),
    lastOffers: new Map(),
    pendingForGuest: new Map(),
    pendingForHost: new Map()
  });
  console.log(`[session] created ${id}`);
  res.json({ sessionId: id });
});

const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

const heartbeats = new WeakMap<WebSocket, number>();

wss.on('connection', (socket, request) => {
  const url = new URL(request.url ?? '', 'http://localhost');
  const sessionId = url.searchParams.get('session');
  const role = url.searchParams.get('role') as Role | null;

  if (!sessionId || !role || (role !== 'host' && role !== 'guest')) {
    console.warn('[ws] rejected connection due to invalid params', { sessionId, role });
    socket.close(1008, 'Invalid session parameters');
    return;
  }

  let session = sessions.get(sessionId);

  if (!session) {
    if (role === 'host') {
      session = {
        id: sessionId,
        createdAt: Date.now(),
        guests: new Map(),
        lastOffers: new Map(),
        pendingForGuest: new Map(),
        pendingForHost: new Map()
      };
      sessions.set(sessionId, session);
      console.log(`[ws] new session registered via host ${sessionId}`);
    } else {
      console.warn(`[ws] guest attempted to join missing session ${sessionId}`);
      socket.close(1011, 'Session not found');
      return;
    }
  }

  if (role === 'host') {
    if (session.host) {
      console.warn(`[ws] host already connected for ${sessionId}`);
      socket.close(1011, 'Host already connected');
      return;
    }
    session.host = { role, socket };
    console.log(`[ws] host connected ${sessionId}`);
    send(socket, createSignalServerMessage('ack', { role: 'host', sessionId }));
    for (const peerId of session.guests.keys()) {
      send(socket, createSignalServerMessage('peer-connected', { peerId }));
      flushPendingToHost(session, peerId);
    }
  } else {
    if (session.guests.size >= MAX_GUESTS) {
      console.warn(`[ws] session full ${sessionId}`);
      socket.close(1013, 'Session full');
      return;
    }
    const peerId = generatePeerId(session);
    session.guests.set(peerId, { role, socket, peerId });
    console.log(`[ws] guest connected ${sessionId} peerId=${peerId}`);
    send(socket, createSignalServerMessage('ack', { role: 'guest', sessionId, peerId }));
    if (session.host?.socket.readyState === WebSocket.OPEN) {
      send(session.host.socket, createSignalServerMessage('peer-connected', { peerId }));
    }
    const last = session.lastOffers.get(peerId);
    if (last) {
      send(socket, createSignalServerMessage('offer', { code: last, peerId }));
    }
    flushPendingToGuest(session, peerId);
  }

  heartbeats.set(socket, Date.now());

  socket.on('pong', () => {
    heartbeats.set(socket, Date.now());
  });

  socket.on('message', (raw) => {
    const parsed = parseSignalClientMessage(safeParseJson(raw.toString()));
    if (!parsed) {
      console.warn('[ws] invalid message payload', { sessionId, role, raw: raw.toString() });
      return;
    }

    const currentSession = sessions.get(sessionId);
    if (!currentSession) return;

    switch (parsed.kind) {
      case 'ping':
        send(socket, createSignalServerMessage('pong', {}));
        break;
      case 'offer': {
        if (role !== 'host') {
          console.warn('[ws] unexpected offer from guest', { sessionId });
          return;
        }
        const targetPeerId = parsed.body.peerId ?? (currentSession.guests.size === 1 ? [...currentSession.guests.keys()][0] : undefined);
        if (!targetPeerId) {
          console.warn('[ws] offer missing peerId with multiple guests', { sessionId });
          return;
        }
        console.log(`[ws] host sent offer ${sessionId} -> ${targetPeerId}`);
        currentSession.lastOffers.set(targetPeerId, parsed.body.code);
        const target = currentSession.guests.get(targetPeerId);
        if (target?.socket.readyState === WebSocket.OPEN) {
          send(target.socket, createSignalServerMessage('offer', { code: parsed.body.code, peerId: targetPeerId }));
        }
        break; }
      case 'answer': {
        if (role !== 'guest') {
          console.warn('[ws] unexpected answer from host', { sessionId });
          return;
        }
        const fromPeerId = findPeerIdBySocket(currentSession, socket);
        if (!fromPeerId) {
          console.warn('[ws] could not resolve guest peerId for answer');
          return;
        }
        console.log(`[ws] guest sent answer ${sessionId} from ${fromPeerId}`);
        if (currentSession.host?.socket.readyState === WebSocket.OPEN) {
          send(currentSession.host.socket, createSignalServerMessage('answer', { code: parsed.body.code, peerId: fromPeerId }));
        }
        break; }
      case 'candidate': {
        if (role === 'host') {
          const targetPeerId = parsed.body.peerId ?? (currentSession.guests.size === 1 ? [...currentSession.guests.keys()][0] : undefined);
          if (!targetPeerId) {
            console.warn('[ws] candidate missing peerId with multiple guests', { sessionId });
            return;
          }
          const target = currentSession.guests.get(targetPeerId);
          if (target?.socket.readyState === WebSocket.OPEN) {
            send(target.socket, createSignalServerMessage('candidate', { candidate: parsed.body.candidate, peerId: targetPeerId }));
          } else {
            enqueue(currentSession.pendingForGuest, targetPeerId, parsed.body.candidate);
          }
        } else if (role === 'guest') {
          const fromPeerId = findPeerIdBySocket(currentSession, socket);
          if (!fromPeerId) {
            console.warn('[ws] could not resolve guest peerId for candidate');
            return;
          }
          if (currentSession.host?.socket.readyState === WebSocket.OPEN) {
            send(currentSession.host.socket, createSignalServerMessage('candidate', { candidate: parsed.body.candidate, peerId: fromPeerId }));
          } else {
            enqueue(currentSession.pendingForHost, fromPeerId, parsed.body.candidate);
          }
        }
        break; }
      default:
        break;
    }
  });

  socket.on('close', () => {
    const currentSession = sessions.get(sessionId);
    if (!currentSession) return;

    if (role === 'host') {
      delete currentSession.host;
      console.log(`[ws] host disconnected ${sessionId}`);
      for (const [pid, guest] of currentSession.guests.entries()) {
        if (guest.socket.readyState === WebSocket.OPEN) {
          send(guest.socket, createSignalServerMessage('peer-disconnected', { peerId: 'host' }));
        }
      }
    } else {
      const pid = findPeerIdBySocket(currentSession, socket);
      if (pid) {
        currentSession.guests.delete(pid);
        currentSession.lastOffers.delete(pid);
        currentSession.pendingForGuest.delete(pid);
        currentSession.pendingForHost.delete(pid);
        console.log(`[ws] guest disconnected ${sessionId} peerId=${pid}`);
        if (currentSession.host?.socket.readyState === WebSocket.OPEN) {
          send(currentSession.host.socket, createSignalServerMessage('peer-disconnected', { peerId: pid }));
        }
      }
    }

    if (!currentSession.host && currentSession.guests.size === 0) {
      sessions.delete(sessionId);
      console.log(`[session] removed ${sessionId}`);
    }
  });
});

// Keepalive: ping clients and terminate stale connections
setInterval(() => {
  const now = Date.now();
  wss.clients.forEach((ws) => {
    const last = heartbeats.get(ws) ?? 0;
    if (now - last > 45_000) {
      try { ws.terminate(); } catch {}
      return;
    }
    try { ws.ping(); } catch {}
  });
}, 15_000);

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (!session.host && session.guests.size === 0 && now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}, 60_000);

server.listen(PORT, () => {
  const address = server.address() as AddressInfo;
  console.log(`Signal server listening on port ${address.port}`);
});

function send(socket: WebSocket, payload: SignalServerMessage) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}
const MAX_PENDING = 256;
function enqueue(map: Map<string, string[]>, peerId: string, candidate: string) {
  const list = map.get(peerId) ?? [];
  if (list.length >= MAX_PENDING) list.shift();
  list.push(candidate);
  map.set(peerId, list);
}

function flushPendingToGuest(session: Session, peerId: string) {
  const guest = session.guests.get(peerId);
  if (!guest || guest.socket.readyState !== WebSocket.OPEN) return;
  const list = session.pendingForGuest.get(peerId);
  if (!list || list.length === 0) return;
  for (const candidate of list.splice(0, list.length)) {
    send(guest.socket, createSignalServerMessage('candidate', { candidate, peerId }));
  }
}

function flushPendingToHost(session: Session, peerId: string) {
  const host = session.host;
  if (!host || host.socket.readyState !== WebSocket.OPEN) return;
  const list = session.pendingForHost.get(peerId);
  if (!list || list.length === 0) return;
  for (const candidate of list.splice(0, list.length)) {
    send(host.socket, createSignalServerMessage('candidate', { candidate, peerId }));
  }
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch (error) {
    console.warn('[ws] failed to parse json', { error });
    return null;
  }
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomBlock() {
  let block = '';
  for (let i = 0; i < 3; i++) {
    const index = Math.floor(Math.random() * ALPHABET.length);
    block += ALPHABET[index];
  }
  return block;
}

function generateSessionId() {
  let id: string;
  do {
    id = `${randomBlock()}-${randomBlock()}-${randomBlock()}`;
  } while (sessions.has(id));
  return id;
}

function findPeerIdBySocket(session: Session, socket: WebSocket): string | null {
  for (const [peerId, peer] of session.guests.entries()) {
    if (peer.socket === socket) return peerId;
  }
  return null;
}

function generatePeerId(session: Session): string {
  let id = '';
  do {
    id = `${randomBlock()}${randomBlock()}`;
  } while (session.guests.has(id));
  return id;
}
