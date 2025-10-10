import '@testing-library/jest-dom'

// Mock Next.js environment variables
process.env.PLOOMES_API_TOKEN = 'test-token'
process.env.SYNC_WEBHOOK_URL = 'https://test-webhook.example.com'
process.env.WEBHOOK_SECRET = 'test-secret'

// Mock fetch globally
global.fetch = jest.fn()

// Mock console methods for cleaner test output
global.console = {
  ...console,
  // Uncomment to suppress error logs in tests
  // error: jest.fn(),
  // warn: jest.fn(),
  log: console.log,
}

// Setup mock implementations
beforeEach(() => {
  jest.clearAllMocks()
  // Reset fetch mock before each test
  fetch.mockClear()
})

// Mock Supabase client
jest.mock('@/lib/supabase-server', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    })),
  },
}))

// Mock Next.js response
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({
      json: () => Promise.resolve(data),
      status: init?.status || 200,
    })),
  },
}))