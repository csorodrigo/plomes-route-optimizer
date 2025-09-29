// Mock for Leaflet library
const L = {
  Icon: class {
    constructor(options) {
      this.options = options;
    }

    static Default = {
      prototype: {
        _getIconUrl: () => 'mock-icon-url'
      },
      mergeOptions: jest.fn()
    }
  },

  DivIcon: class {
    constructor(options) {
      this.options = options;
    }
  },

  map: jest.fn().mockReturnValue({
    setView: jest.fn(),
    addLayer: jest.fn(),
    removeLayer: jest.fn(),
    flyTo: jest.fn(),
    getZoom: jest.fn().mockReturnValue(11),
    panTo: jest.fn(),
    fitBounds: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    getContainer: jest.fn().mockReturnValue(document.createElement('div'))
  }),

  tileLayer: jest.fn().mockReturnValue({
    addTo: jest.fn()
  }),

  marker: jest.fn().mockReturnValue({
    addTo: jest.fn(),
    bindPopup: jest.fn(),
    setLatLng: jest.fn(),
    getLatLng: jest.fn().mockReturnValue({ lat: -23.5505, lng: -46.6333 })
  }),

  polyline: jest.fn().mockReturnValue({
    addTo: jest.fn(),
    setStyle: jest.fn(),
    getLatLngs: jest.fn().mockReturnValue([])
  }),

  circle: jest.fn().mockReturnValue({
    addTo: jest.fn(),
    setRadius: jest.fn(),
    setLatLng: jest.fn()
  }),

  popup: jest.fn().mockReturnValue({
    setContent: jest.fn(),
    openOn: jest.fn()
  }),

  latLng: jest.fn((lat, lng) => ({ lat, lng })),

  latLngBounds: jest.fn().mockReturnValue({
    extend: jest.fn(),
    isValid: jest.fn().mockReturnValue(true)
  }),

  // Control classes
  Control: {
    extend: jest.fn()
  },

  // Utility functions
  Util: {
    extend: jest.fn(),
    bind: jest.fn(),
    stamp: jest.fn(),
    falseFn: jest.fn().mockReturnValue(false),
    formatNum: jest.fn()
  },

  // Browser detection
  Browser: {
    ie: false,
    ielt9: false,
    edge: false,
    webkit: true,
    android: false,
    android23: false,
    chrome: true,
    gecko: false,
    safari: false,
    opera: false,
    win: false,
    ie3d: false,
    webkit3d: true,
    gecko3d: false,
    opera3d: false,
    any3d: true,
    mobile: false,
    mobileWebkit: false,
    mobileWebkit3d: false,
    mobileOpera: false,
    mobileGecko: false,
    touch: false,
    msPointer: false,
    pointer: false,
    retina: false
  },

  // Version info
  version: '1.9.4'
};

// Set up Icon defaults mock
L.Icon.Default.prototype._getIconUrl = undefined;

export default L;