
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeSecurity } from './utils/securityHeaders'

// Initialize security measures before app starts
try {
  initializeSecurity();
} catch (error) {
  console.warn('Security initialization failed:', error);
}

createRoot(document.getElementById("root")!).render(
  <App />
);
