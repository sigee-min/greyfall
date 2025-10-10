import { OAuth2Client } from 'google-auth-library';

export type GoogleProfile = {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  iss?: string;
  aud?: string;
  exp?: number;
};

let cachedClient: OAuth2Client | null = null;

function getClient(clientId: string) {
  if (cachedClient && (cachedClient as any)._clientId === clientId) return cachedClient;
  const cli = new OAuth2Client({ clientId });
  (cli as any)._clientId = clientId;
  cachedClient = cli;
  return cli;
}

export async function verifyGoogleIdToken(idToken: string, googleClientId: string): Promise<GoogleProfile | null> {
  try {
    const client = getClient(googleClientId);
    const ticket = await client.verifyIdToken({ idToken, audience: googleClientId });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) return null;
    return {
      sub: payload.sub,
      email: payload.email ?? undefined,
      name: payload.name ?? undefined,
      picture: payload.picture ?? undefined,
      iss: payload.iss ?? undefined,
      aud: payload.aud ?? undefined,
      exp: payload.exp ?? undefined
    };
  } catch {
    return null;
  }
}

