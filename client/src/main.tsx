import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import './index.css';
import { I18nProvider } from './i18n';
import { GoogleOAuthProvider } from '@react-oauth/google';

let clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

if (!clientId) {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const j = (await res.json()) as { googleClientId?: string };
      clientId = j.googleClientId || undefined;
    }
  } catch {}
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      {clientId ? (
        <GoogleOAuthProvider clientId={clientId}>
          <App hasGoogleClient={true} />
        </GoogleOAuthProvider>
      ) : (
        <App hasGoogleClient={false} />
      )}
    </I18nProvider>
  </React.StrictMode>
);
