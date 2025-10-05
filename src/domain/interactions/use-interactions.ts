import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import type { RegisterLobbyHandler } from '../chat/use-lobby-chat';
import type { LobbyMessageBodies, LobbyMessageKind } from '../../protocol';

export type Publish = <K extends LobbyMessageKind>(kind: K, body: LobbyMessageBodies[K], context?: string) => boolean;

export type Invite = {
  inviteId: string;
  fromId: string;
  toId: string;
  mapId: string;
  fieldId: string;
  verb: string;
  status: 'pending' | 'confirmed' | 'cancelled';
};

export function useInteractions(args: {
  localParticipantId: string | null;
  mapId: string;
  fieldId: string;
  publish: Publish;
  register: RegisterLobbyHandler;
}) {
  const { localParticipantId, mapId, fieldId, publish, register } = args;
  const [invites, setInvites] = useState<Invite[]>([]);
  const invitesRef = useRef(invites);
  useEffect(() => {
    invitesRef.current = invites;
  }, [invites]);

  useEffect(() => {
    const u1 = register('interact:invite' as any, (m: any) => {
      const { inviteId, fromId, toId, mapId: mid, fieldId: fid, verb } = m.body as any;
      setInvites((prev) => {
        const next = prev.filter((x) => x.inviteId !== inviteId);
        next.push({ inviteId, fromId, toId, mapId: String(mid), fieldId: String(fid), verb: String(verb), status: 'pending' });
        return next;
      });
    });
    const u2 = register('interact:confirmed' as any, (m: any) => {
      const { inviteId } = m.body as any;
      setInvites((prev) => prev.map((x) => (x.inviteId === inviteId ? { ...x, status: 'confirmed' } : x)));
    });
    const u3 = register('interact:cancel' as any, (m: any) => {
      const { inviteId } = m.body as any;
      setInvites((prev) => prev.map((x) => (x.inviteId === inviteId ? { ...x, status: 'cancelled' } : x)));
    });
    return () => {
      u1();
      u2();
      u3();
    };
  }, [register]);

  const sendInvite = useCallback(
    (toId: string, verb: string) => {
      const fromId = localParticipantId;
      if (!fromId) return false;
      const inviteId = nanoid(10);
      return publish('interact:invite' as any, { inviteId, fromId, toId, mapId, fieldId, verb } as any, 'ui:interact:invite');
    },
    [fieldId, localParticipantId, mapId, publish]
  );

  const acceptInvite = useCallback(
    (inviteId: string) => publish('interact:accept' as any, { inviteId, toId: String(localParticipantId ?? '') } as any, 'ui:interact:accept'),
    [localParticipantId, publish]
  );

  const cancelInvite = useCallback(
    (inviteId: string) => publish('interact:cancel' as any, { inviteId, byId: String(localParticipantId ?? '') } as any, 'ui:interact:cancel'),
    [localParticipantId, publish]
  );

  const incoming = useMemo(() => invites.filter((i) => i.toId === localParticipantId && i.status === 'pending'), [invites, localParticipantId]);
  const outgoing = useMemo(() => invites.filter((i) => i.fromId === localParticipantId && i.status === 'pending'), [invites, localParticipantId]);

  return { invites, incoming, outgoing, sendInvite, acceptInvite, cancelInvite } as const;
}

