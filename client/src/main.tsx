import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import './index.css';
import { I18nProvider } from './i18n';
import { GoogleOAuthProvider } from '@react-oauth/google';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <I18nProvider>
      {clientId ? (
        <GoogleOAuthProvider clientId={clientId}>
          <App />
        </GoogleOAuthProvider>
      ) : (
        <App />
      )}
    </I18nProvider>
  </React.StrictMode>
);
