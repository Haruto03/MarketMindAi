import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { SharePage } from './components/SharePage';
import './index.css';

// Public share links (/share/:id) render without sign-in
const shareMatch = window.location.pathname.match(/^\/share\/([0-9a-f-]{36})\/?$/i);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {shareMatch ? <SharePage shareId={shareMatch[1]} /> : <App />}
  </StrictMode>,
);
