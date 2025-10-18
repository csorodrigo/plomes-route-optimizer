import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SWRConfig } from 'swr';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    pathname: '/dashboard',
    query: {},
    asPath: '/dashboard',
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/dashboard',
}));

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  swrConfig?: any;
}

function AllTheProviders({ children, queryClient, swrConfig }: {
  children: React.ReactNode;
  queryClient?: QueryClient;
  swrConfig?: any;
}) {
  const defaultQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });

  const defaultSWRConfig = {
    dedupingInterval: 0,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
    ...swrConfig
  };

  return (
    <QueryClientProvider client={queryClient || defaultQueryClient}>
      <SWRConfig value={defaultSWRConfig}>
        {children}
      </SWRConfig>
    </QueryClientProvider>
  );
}

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { queryClient, swrConfig, ...renderOptions } = options;

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders queryClient={queryClient} swrConfig={swrConfig}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  });
};

// Helper to create mock fetch responses
export const createMockResponse = (data: any, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
};

// Helper to mock fetch globally
export const mockFetch = (responses: Record<string, any>) => {
  global.fetch = jest.fn((url) => {
    const urlString = url instanceof Request ? url.url : url;

    // Find matching response based on URL pattern
    for (const [pattern, response] of Object.entries(responses)) {
      if (urlString.includes(pattern)) {
        return createMockResponse(response);
      }
    }

    // Default error response
    return createMockResponse({ error: 'Not found' }, 404);
  });
};

// Helper to clear all mocks
export const clearAllMocks = () => {
  jest.clearAllMocks();
  if (global.fetch && jest.isMockFunction(global.fetch)) {
    global.fetch.mockClear();
  }
};

// Helper to wait for async operations
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0));

// Custom matchers for better test assertions
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Type augmentation for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };