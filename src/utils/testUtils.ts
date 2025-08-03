import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';
import { BrowserRouter } from 'react-router-dom';

// Mock implementations for common dependencies
export const mockToast = {
  title: '',
  description: '',
  variant: 'default' as const,
  showToast: jest.fn(),
  hideToast: jest.fn()
};

export const mockSafeLog = {
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

export const mockErrorMonitor = {
  reportError: jest.fn(),
  reportPaymentError: jest.fn(),
  reportNetworkError: jest.fn(),
  reportAuthError: jest.fn(),
  getErrorReports: jest.fn(),
  getErrorStats: jest.fn(),
  clearErrorReports: jest.fn()
};

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      {children}
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Test data factories
export const createMockError = (message: string = 'Test error', stack?: string): Error => {
  const error = new Error(message);
  if (stack) {
    error.stack = stack;
  }
  return error;
};

export const createMockPaymentContext = (overrides: Partial<{
  planId: string;
  orderId: string;
  paymentId: string;
  userId: string;
}> = {}) => ({
  planId: 'test-plan-123',
  orderId: 'test-order-456',
  paymentId: 'test-payment-789',
  userId: 'test-user-abc',
  ...overrides
});

export const createMockPrompt = (overrides: Partial<{
  id: string;
  title: string;
  description: string;
  prompt_text: string;
  metadata: any;
}> = {}) => ({
  id: 'test-prompt-123',
  title: 'Test Prompt',
  description: 'A test prompt for testing',
  prompt_text: 'This is a test prompt text',
  metadata: {
    category: 'chatgpt',
    style: 'professional',
    tags: ['test', 'example'],
    workflow_steps: [],
    workflow_files: [],
    media_files: []
  },
  ...overrides
});

// Async test helpers
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const waitForElementToBeRemoved = async (element: HTMLElement) => {
  return new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      if (!document.contains(element)) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
};

// Mock localStorage
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    })
  };
};

// Mock window.location
export const mockWindowLocation = (overrides: Partial<Location> = {}) => {
  const originalLocation = window.location;
  
  Object.defineProperty(window, 'location', {
    value: {
      href: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
      origin: 'http://localhost:3000',
      ...overrides
    },
    writable: true
  });

  return () => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true
    });
  };
};

// Mock navigator
export const mockNavigator = (overrides: Partial<Navigator> = {}) => {
  const originalNavigator = navigator;
  
  Object.defineProperty(window, 'navigator', {
    value: {
      userAgent: 'Mozilla/5.0 (Test Browser)',
      ...overrides
    },
    writable: true
  });

  return () => {
    Object.defineProperty(window, 'navigator', {
      value: originalNavigator,
      writable: true
    });
  };
};

// Test environment setup
export const setupTestEnvironment = () => {
  // Mock console methods to reduce noise in tests
  const originalConsole = { ...console };
  
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
  });
};

// Re-export everything from testing library
export * from '@testing-library/react';
export { customRender as render }; 