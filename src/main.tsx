import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installGlobalHandlers } from './app/platform/errors';
import { watchVisibility } from './app/platform/events';
import { initNative } from './app/platform/native';

installGlobalHandlers();
watchVisibility();
initNative();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
