// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock window.matchMedia for Material-UI components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock geolocation API
const mockGeolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn()
};

global.navigator.geolocation = mockGeolocation;

// Mock performance API for performance tests
if (!global.performance) {
  global.performance = {
    now: jest.fn().mockReturnValue(Date.now()),
    mark: jest.fn(),
    measure: jest.fn()
  };
}

// Enhanced console for better test debugging
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// Allow specific console messages that are part of the test expectations
console.error = (...args) => {
  const message = args.join(' ');

  // Filter out React warnings and other expected messages during tests
  if (
    message.includes('Warning: ReactDOM.render is no longer supported') ||
    message.includes('Warning: validateDOMNesting') ||
    message.includes('Warning: Each child in a list should have a unique "key" prop')
  ) {
    return;
  }

  originalConsoleError(...args);
};

console.warn = (...args) => {
  const message = args.join(' ');

  // Filter out expected warnings
  if (
    message.includes('componentWillMount has been renamed') ||
    message.includes('componentWillReceiveProps has been renamed')
  ) {
    return;
  }

  originalConsoleWarn(...args);
};

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
};

global.localStorage = localStorageMock;

// Mock sessionStorage
global.sessionStorage = localStorageMock;

// Mock URL.createObjectURL for PDF and file operations
global.URL.createObjectURL = jest.fn().mockReturnValue('mocked-blob-url');
global.URL.revokeObjectURL = jest.fn();

// Mock canvas for map and PDF operations
HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn().mockReturnValue({
    data: new Uint8ClampedArray(4)
  }),
  putImageData: jest.fn(),
  createImageData: jest.fn().mockReturnValue({}),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn().mockReturnValue({ width: 0 }),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn()
});

// Mock Image constructor for image loading
global.Image = class {
  constructor() {
    setTimeout(() => {
      this.onload();
    }, 100);
  }

  set onload(fn) {
    this._onload = fn;
  }

  get onload() {
    return this._onload;
  }
};

// Mock File and FileReader for file operations
global.File = class {
  constructor(content, filename, options = {}) {
    this.content = content;
    this.name = filename;
    this.type = options.type || 'text/plain';
    this.size = content.length;
  }
};

global.FileReader = class {
  readAsDataURL(file) {
    this.result = 'data:image/png;base64,mock-data';
    setTimeout(() => this.onload(), 100);
  }

  readAsText(file) {
    this.result = file.content;
    setTimeout(() => this.onload(), 100);
  }
};

// Custom matchers for polyline testing
expect.extend({
  toHaveValidPolylineCoordinates(received) {
    if (!Array.isArray(received)) {
      return {
        message: () => `Expected polyline coordinates to be an array, but received ${typeof received}`,
        pass: false
      };
    }

    const isValid = received.every(coord =>
      Array.isArray(coord) &&
      coord.length === 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number' &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1])
    );

    if (isValid) {
      return {
        message: () => `Expected polyline coordinates to be invalid`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected polyline coordinates to be valid [lat, lng] pairs`,
        pass: false
      };
    }
  },

  toHavePolylineProperties(received, expected) {
    const properties = {
      color: received.getAttribute('data-color'),
      weight: received.getAttribute('data-weight'),
      opacity: received.getAttribute('data-opacity'),
      pane: received.getAttribute('data-pane')
    };

    const matches = Object.keys(expected).every(key =>
      properties[key] === expected[key]
    );

    if (matches) {
      return {
        message: () => `Expected polyline properties to not match ${JSON.stringify(expected)}`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected polyline properties ${JSON.stringify(properties)} to match ${JSON.stringify(expected)}`,
        pass: false
      };
    }
  }
});

// Global test utilities
global.testUtils = {
  // Wait for async operations
  waitFor: (condition, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const start = Date.now();

      const check = () => {
        if (condition()) {
          resolve();
        } else if (Date.now() - start >= timeout) {
          reject(new Error('Timeout waiting for condition'));
        } else {
          setTimeout(check, 100);
        }
      };

      check();
    });
  },

  // Mock console methods and capture output
  mockConsole: () => {
    const logs = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = jest.fn((...args) => {
      logs.push({ type: 'log', message: args.join(' ') });
    });

    console.warn = jest.fn((...args) => {
      logs.push({ type: 'warn', message: args.join(' ') });
    });

    console.error = jest.fn((...args) => {
      logs.push({ type: 'error', message: args.join(' ') });
    });

    return {
      logs,
      restore: () => {
        console.log = originalLog;
        console.warn = originalWarn;
        console.error = originalError;
      }
    };
  }
};

// Set up test environment for polyline debugging
if (process.env.NODE_ENV === 'test') {
  // Store polyline debug information globally for testing
  global.polylineDebugLogs = [];

  // Mock console.log to capture polyline-related logs
  const originalLog = console.log;
  console.log = (...args) => {
    const message = args.join(' ');
    if (message.includes('🗺️') || message.includes('polyline') || message.includes('route')) {
      global.polylineDebugLogs.push(message);
    }
    originalLog(...args);
  };
}