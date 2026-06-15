import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './i18n/config';

// Automatically unregister all service workers and clear stale caches to prevent 404 errors on /api endpoints
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    let unregisterPromise: Promise<unknown> = Promise.resolve();
    const hadSW = registrations && registrations.length > 0;
    if (hadSW) {
      registrations.forEach((registration) => {
        unregisterPromise = unregisterPromise.then(() => {
          return registration.unregister();
        });
      });
    }

    let cachePromise: Promise<unknown> = Promise.resolve();
    if ('caches' in window) {
      cachePromise = caches.keys().then((keys) => {
        if (keys && keys.length > 0) {
          return Promise.all(keys.map(key => caches.delete(key)));
        }
      });
    }

    Promise.all([unregisterPromise, cachePromise]).then(() => {
      if (navigator.serviceWorker.controller || hadSW) {
        console.log('Force reloading stale assets...');
        setTimeout(() => {
          window.location.reload();
        }, 300);
      }
    });
  }).catch((err) => {
    console.error('Service worker cleanup failed:', err);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

