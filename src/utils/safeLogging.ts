// Safe logging utility for development vs production
export const safeLog = {
  // Only log in development
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, data);
    }
  },

  // Always log errors
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error);
  },

  // Only warn in development
  warn: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[WARN] ${message}`, data);
    }
  },

  // Always log info for important events
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data);
  }
}; 