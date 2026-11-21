import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import {App} from './App';

createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={new QueryClient()}><BrowserRouter><App/></BrowserRouter></QueryClientProvider></StrictMode>);
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'));
