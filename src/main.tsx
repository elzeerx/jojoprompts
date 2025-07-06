
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeSecurity } from './utils/securityHeaders'

// Initialize security measures before app starts
initializeSecurity();

createRoot(document.getElementById("root")!).render(
  <App />
);
