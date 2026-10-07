import '@testing-library/jest-dom';
import { jest } from "@jest/globals";
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder for jsdom (needed by jose)
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

// Polyfill structuredClone for jsdom (needed by jose v5)
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = <T>(val: T): T => JSON.parse(JSON.stringify(val));
}

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock window.matchMedia (jsdom only)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });

  // Mock IntersectionObserver
  class MockIntersectionObserver {
    observe = jest.fn();
    disconnect = jest.fn();
    unobserve = jest.fn();
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });

  // Mock ResizeObserver
  class MockResizeObserver {
    observe = jest.fn();
    disconnect = jest.fn();
    unobserve = jest.fn();
  }

  Object.defineProperty(window, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: MockResizeObserver,
  });
}

// Suppress console errors in tests
const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') || args[0].includes('act(...)'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};
