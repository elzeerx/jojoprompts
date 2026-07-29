
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'
import { SecurityHeaders } from './utils/security/securityHeaders'
import { createLogger } from './utils/logging'
import { startWebVitalsMonitoring } from './lib/v2/webVitals'

const logger = createLogger('main');

// Initialize security measures before app starts
try {
  SecurityHeaders.initialize();
} catch (error) {
  logger.warn('Security initialization failed', { error: error instanceof Error ? error.message : error });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

startWebVitalsMonitoring();
