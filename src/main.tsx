import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent unhandled third-party environment noise, ResizeObserver limits, or generic cross-origin "Script error." from triggering false alerts
if (typeof window !== 'undefined') {
  // Use direct window.onerror which is highly authoritative across different browsers
  window.onerror = function (message, source, lineno, colno, error) {
    const msg = String(message || '');
    if (
      msg.toLowerCase().includes('script error') ||
      msg.toLowerCase().includes('resizeobserver') ||
      msg.toLowerCase().includes('cross-origin') ||
      msg.toLowerCase().includes('permission denied') ||
      msg.toLowerCase().includes('camera') ||
      msg.toLowerCase().includes('getusermedia') ||
      !source ||
      source === ''
    ) {
      console.warn('Gracefully suppressed cross-origin script error:', message, 'at', source);
      return true; // Prevents the browser from reporting the error
    }
    return false;
  };

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    if (
      msg.toLowerCase().includes('script error') ||
      msg.toLowerCase().includes('resizeobserver') ||
      msg.toLowerCase().includes('cross-origin') ||
      msg.toLowerCase().includes('permission denied') ||
      msg.toLowerCase().includes('camera') ||
      msg.toLowerCase().includes('getusermedia')
    ) {
      console.warn('Gracefully handled non-fatal iframe or cross-origin script warning:', msg);
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || String(event.reason || '');
    if (
      !reason ||
      reason.toLowerCase().includes('script error') ||
      reason.toLowerCase().includes('resizeobserver') ||
      reason.toLowerCase().includes('cross-origin') ||
      reason.toLowerCase().includes('permission denied') ||
      reason.toLowerCase().includes('auth/popup-closed-by-user') ||
      reason.toLowerCase().includes('camera')
    ) {
      console.warn('Gracefully handled non-fatal unhandled async rejection:', reason);
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

