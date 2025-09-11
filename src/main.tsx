
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SecurityHeaders } from './utils/security/securityHeaders'

// Initialize security measures before app starts
try {
  SecurityHeaders.initialize();
} catch (error) {
  console.warn('Security initialization failed:', error);
}

createRoot(document.getElementById("root")!).render(
  <App />
);
