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
};

type Session = {
  id: string;
  createdAt: number;
  host?: Peer;
  guest?: Peer;
  lastOffer?: string;
  pendingForGuest: string[];
  pendingForHost: string[];
};

const sessions = new Map<string, Session>();

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
  sessions.set(id, { id, createdAt: Date.now(), pendingForGuest: [], pendingForHost: [] });
  console.log(`[session] created ${id}`);
  res.json({ sessionId: id });
});

const server = createServer(app);

const wss = new WebSocketServer({ server, path: '/ws' });

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
        pendingForGuest: [],
        pendingForHost: []
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
    if (session.guest) {
      send(socket, createSignalServerMessage('peer-connected', {}));
      flushPending(session, 'host');
    }
  } else {
    if (session.guest) {
      console.warn(`[ws] guest already connected for ${sessionId}`);
      socket.close(1011, 'Guest already connected');
      return;
    }
    session.guest = { role, socket };
    console.log(`[ws] guest connected ${sessionId}`);
    send(socket, createSignalServerMessage('ack', { role: 'guest', sessionId }));
    if (session.host?.socket.readyState === WebSocket.OPEN) {
      send(session.host.socket, createSignalServerMessage('peer-connected', {}));
    }
    if (session.lastOffer) {
      send(socket, createSignalServerMessage('offer', { code: session.lastOffer }));
    }
    flushPending(session, 'guest');
  }

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
      case 'offer':
        if (role !== 'host') {
          console.warn('[ws] unexpected offer from guest', { sessionId });
          return;
        }
        console.log(`[ws] host sent offer ${sessionId}`);
        currentSession.lastOffer = parsed.body.code;
        if (currentSession.guest?.socket.readyState === WebSocket.OPEN) {
          send(currentSession.guest.socket, createSignalServerMessage('offer', { code: parsed.body.code }));
        }
        break;
      case 'answer':
        if (role !== 'guest') {
          console.warn('[ws] unexpected answer from host', { sessionId });
          return;
        }
        console.log(`[ws] guest sent answer ${sessionId}`);
        if (currentSession.host?.socket.readyState === WebSocket.OPEN) {
          send(currentSession.host.socket, createSignalServerMessage('answer', { code: parsed.body.code }));
        }
        break;
      case 'candidate':
        if (role === 'host') {
          if (currentSession.guest?.socket.readyState === WebSocket.OPEN) {
            send(
              currentSession.guest.socket,
              createSignalServerMessage('candidate', { candidate: parsed.body.candidate })
            );
          } else {
            currentSession.pendingForGuest.push(parsed.body.candidate);
          }
        } else if (role === 'guest') {
          if (currentSession.host?.socket.readyState === WebSocket.OPEN) {
            send(
              currentSession.host.socket,
              createSignalServerMessage('candidate', { candidate: parsed.body.candidate })
            );
          } else {
            currentSession.pendingForHost.push(parsed.body.candidate);
          }
        }
        break;
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
      if (currentSession.guest?.socket.readyState === WebSocket.OPEN) {
        send(currentSession.guest.socket, createSignalServerMessage('peer-disconnected', {}));
      }
    } else {
      delete currentSession.guest;
      console.log(`[ws] guest disconnected ${sessionId}`);
      if (currentSession.host?.socket.readyState === WebSocket.OPEN) {
        send(currentSession.host.socket, createSignalServerMessage('peer-disconnected', {}));
      }
    }

    if (!currentSession.host && !currentSession.guest) {
      sessions.delete(sessionId);
      console.log(`[session] removed ${sessionId}`);
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (!session.host && !session.guest && now - session.createdAt > SESSION_TTL_MS) {
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

function flushPending(session: Session, target: Role) {
  const list = target === 'guest' ? session.pendingForGuest : session.pendingForHost;
  if (list.length === 0) return;
  const peerSocket = target === 'guest' ? session.guest?.socket : session.host?.socket;
  if (!peerSocket || peerSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  for (const candidate of list.splice(0, list.length)) {
    send(peerSocket, createSignalServerMessage('candidate', { candidate }));
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
