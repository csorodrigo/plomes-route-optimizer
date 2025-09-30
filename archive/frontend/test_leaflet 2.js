// Test React Leaflet imports
try {
  // We need to mock the browser environment for leaflet
  global.window = {
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: (id) => clearTimeout(id)
  };
  global.document = {
    createElement: () => ({ style: {}, addEventListener: () => {} }),
    documentElement: { style: {} }
  };
  global.navigator = { userAgent: 'node' };

  const reactLeaflet = require('react-leaflet');
  const leafletExports = Object.keys(reactLeaflet);

  const requiredExports = ['MapContainer', 'TileLayer', 'Marker', 'Popup', 'Circle', 'Polyline', 'useMap'];
  const foundExports = requiredExports.filter(exp => leafletExports.includes(exp));

  console.log('React Leaflet exports found:', foundExports);
  console.log('✓ All React Leaflet exports available:', foundExports.length === requiredExports.length);
} catch (error) {
  console.error('React Leaflet test error:', error.message);
}