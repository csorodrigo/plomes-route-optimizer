const path = require('path');

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/frontend/src/setupTests.js'
  ],

  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': 'jest-transform-stub',
    '^react-leaflet$': '<rootDir>/frontend/src/__mocks__/react-leaflet.js',
    '^leaflet$': '<rootDir>/frontend/src/__mocks__/leaflet.js'
  },

  // Transform files
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }],
    '^.+\\.css$': 'jest-transform-stub'
  },

  // Coverage configuration
  collectCoverageFrom: [
    'frontend/src/**/*.{js,jsx}',
    '!frontend/src/index.js',
    '!frontend/src/setupTests.js',
    '!frontend/src/**/*.test.{js,jsx}',
    '!frontend/src/**/*.spec.{js,jsx}',
    '!frontend/src/**/__tests__/**',
    '!frontend/src/**/__mocks__/**',
    '!frontend/src/services/pdfExportService.js' // Exclude complex external dependencies
  ],

  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],

  coverageDirectory: '<rootDir>/coverage',

  // Test match patterns
  testMatch: [
    '<rootDir>/frontend/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/frontend/src/**/*.{test,spec}.{js,jsx}'
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/frontend/node_modules/',
    '<rootDir>/frontend/build/',
    '<rootDir>/frontend/src/__tests__/e2e/'
  ],

  // Module file extensions
  moduleFileExtensions: [
    'js',
    'jsx',
    'json',
    'node'
  ],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Reset modules between tests
  resetModules: true,

  // Global setup for all tests
  globals: {
    'process.env': {
      'NODE_ENV': 'test'
    }
  },

  // Transform node_modules that need transformation
  transformIgnorePatterns: [
    'node_modules/(?!(react-leaflet|@react-leaflet|leaflet)/)'
  ]
};