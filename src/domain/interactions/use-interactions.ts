import { useCallback, useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    const unsubscribeInvite = register('interact:invite', (message) => {
      const { inviteId, fromId, toId, mapId: mid, fieldId: fid, verb } = message.body;
      setInvites((prev) => {
        const next = prev.filter((x) => x.inviteId !== inviteId);
        next.push({ inviteId, fromId, toId, mapId: String(mid), fieldId: String(fid), verb: String(verb), status: 'pending' });
        return next;
      });
    });
    const unsubscribeConfirmed = register('interact:confirmed', (message) => {
      const { inviteId } = message.body;
      setInvites((prev) => prev.map((x) => (x.inviteId === inviteId ? { ...x, status: 'confirmed' } : x)));
    });
    const unsubscribeCancel = register('interact:cancel', (message) => {
      const { inviteId } = message.body;
      setInvites((prev) => prev.map((x) => (x.inviteId === inviteId ? { ...x, status: 'cancelled' } : x)));
    });
    return () => {
      unsubscribeInvite();
      unsubscribeConfirmed();
      unsubscribeCancel();
    };
  }, [register]);

  const sendInvite = useCallback(
    (toId: string, verb: string) => {
      const fromId = localParticipantId;
      if (!fromId) return false;
      const inviteId = nanoid(10);
      const body: LobbyMessageBodies['interact:invite'] = { inviteId, fromId, toId, mapId, fieldId, verb };
      return publish('interact:invite', body, 'ui:interact:invite');
    },
    [fieldId, localParticipantId, mapId, publish]
  );

  const acceptInvite = useCallback(
    (inviteId: string) => {
      const toId = localParticipantId;
      if (!toId) return false;
      const body: LobbyMessageBodies['interact:accept'] = { inviteId, toId };
      return publish('interact:accept', body, 'ui:interact:accept');
    },
    [localParticipantId, publish]
  );

  const cancelInvite = useCallback(
    (inviteId: string) => {
      const byId = localParticipantId;
      if (!byId) return false;
      const body: LobbyMessageBodies['interact:cancel'] = { inviteId, byId };
      return publish('interact:cancel', body, 'ui:interact:cancel');
    },
    [localParticipantId, publish]
  );

  const incoming = useMemo(() => invites.filter((i) => i.toId === localParticipantId && i.status === 'pending'), [invites, localParticipantId]);
  const outgoing = useMemo(() => invites.filter((i) => i.fromId === localParticipantId && i.status === 'pending'), [invites, localParticipantId]);

  return { invites, incoming, outgoing, sendInvite, acceptInvite, cancelInvite } as const;
}
