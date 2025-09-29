import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import RouteOptimizer from '../RouteOptimizer';
import api from '../../services/api';
import { toast } from 'react-toastify';

// Mock dependencies
jest.mock('../../services/api');
jest.mock('react-toastify', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn()
  }
}));

jest.mock('../../utils/translations', () => ({
  useTranslation: () => ({
    t: (key) => key
  })
}));

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children, eventHandlers, ...props }) => (
    <div
      data-testid="marker"
      data-position={JSON.stringify(props.position)}
      onClick={eventHandlers?.click}
    >
      {children}
    </div>
  ),
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  Polyline: (props) => (
    <div
      data-testid="polyline"
      data-positions={JSON.stringify(props.positions)}
      data-color={props.color}
      data-weight={props.weight}
      data-opacity={props.opacity}
      data-pane={props.pane}
    />
  ),
  Circle: (props) => (
    <div
      data-testid="circle"
      data-center={JSON.stringify(props.center)}
      data-radius={props.radius}
    />
  ),
  useMap: () => ({
    flyTo: jest.fn(),
    getZoom: () => 11
  })
}));

// Mock Material-UI components
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useTheme: () => ({
    palette: {
      primary: { main: '#1976d2' },
      secondary: { main: '#dc004e' },
      error: { main: '#f44336' },
      success: { main: '#4caf50' },
      grey: { 50: '#fafafa', 400: '#bdbdbd', 600: '#757575' },
      divider: '#e0e0e0',
      text: { secondary: '#666' },
      action: { hover: '#f5f5f5' },
      info: { light: '#e3f2fd', contrastText: '#fff' }
    },
    breakpoints: {
      down: () => false
    }
  }),
  useMediaQuery: () => false
}));

// Mock @hello-pangea/dnd
jest.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }) => <div>{children}</div>,
  Droppable: ({ children }) => children({ innerRef: jest.fn(), droppableProps: {}, placeholder: null }, {}),
  Draggable: ({ children }) => children({ innerRef: jest.fn(), draggableProps: {}, dragHandleProps: {} }, {})
}));

describe('RouteOptimizer - Polyline Rendering Tests', () => {
  const mockCustomers = [
    {
      id: '1',
      name: 'Customer A',
      latitude: -23.5505,
      longitude: -46.6333,
      street_address: 'Rua A, 123',
      city: 'São Paulo',
      cep: '01000-000'
    },
    {
      id: '2',
      name: 'Customer B',
      latitude: -23.5515,
      longitude: -46.6343,
      street_address: 'Rua B, 456',
      city: 'São Paulo',
      cep: '02000-000'
    }
  ];

  const mockOrigin = {
    lat: -23.5505,
    lng: -46.6333,
    address: 'CEP 01000-000'
  };

  const mockRouteWithRealData = {
    waypoints: [
      { lat: -23.5505, lng: -46.6333, name: 'Origem' },
      { lat: -23.5515, lng: -46.6343, name: 'Customer A', id: '1' },
      { lat: -23.5525, lng: -46.6353, name: 'Customer B', id: '2' },
      { lat: -23.5505, lng: -46.6333, name: 'Origem' }
    ],
    totalDistance: 2.5,
    estimatedTime: 15,
    realRoute: {
      decodedPath: [
        { lat: -23.5505, lng: -46.6333 },
        { lat: -23.5510, lng: -46.6338 },
        { lat: -23.5515, lng: -46.6343 },
        { lat: -23.5520, lng: -46.6348 },
        { lat: -23.5525, lng: -46.6353 },
        { lat: -23.5520, lng: -46.6348 },
        { lat: -23.5515, lng: -46.6343 },
        { lat: -23.5510, lng: -46.6338 },
        { lat: -23.5505, lng: -46.6333 }
      ]
    }
  };

  const mockRouteWithoutRealData = {
    waypoints: [
      { lat: -23.5505, lng: -46.6333, name: 'Origem' },
      { lat: -23.5515, lng: -46.6343, name: 'Customer A', id: '1' },
      { lat: -23.5525, lng: -46.6353, name: 'Customer B', id: '2' },
      { lat: -23.5505, lng: -46.6333, name: 'Origem' }
    ],
    totalDistance: 2.1,
    estimatedTime: 12
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default API mocks
    api.getCustomers.mockResolvedValue({ customers: mockCustomers });
    api.geocodeAddress.mockResolvedValue({
      success: true,
      coordinates: mockOrigin,
      address: mockOrigin.address
    });

    // Mock console methods to capture debug output
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    // Restore console methods
    console.log.mockRestore();
    console.warn.mockRestore();
    console.error.mockRestore();
  });

  describe('Polyline Rendering with Real Route Data', () => {
    test('should render polyline with real route decoded path when available', async () => {
      api.optimizeRoute.mockResolvedValue({
        success: true,
        route: mockRouteWithRealData
      });

      render(<RouteOptimizer />);

      // Load customers first
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      // Set origin
      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000-000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      // Select customers
      const markers = screen.getAllByTestId('marker');
      fireEvent.click(markers[0]); // Click first customer marker

      // Optimize route
      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
        await waitFor(() => expect(api.optimizeRoute).toHaveBeenCalled());
      });

      // Check if polyline is rendered with real route data
      const polyline = screen.getByTestId('polyline');
      expect(polyline).toBeInTheDocument();

      // Verify polyline properties
      expect(polyline).toHaveAttribute('data-color', '#FF0000');
      expect(polyline).toHaveAttribute('data-weight', '6');
      expect(polyline).toHaveAttribute('data-opacity', '1');
      expect(polyline).toHaveAttribute('data-pane', 'overlayPane');

      // Verify that real route coordinates are used
      const positions = JSON.parse(polyline.getAttribute('data-positions'));
      expect(positions).toHaveLength(mockRouteWithRealData.realRoute.decodedPath.length);
      expect(positions[0]).toEqual([-23.5505, -46.6333]); // First coordinate
      expect(positions[positions.length - 1]).toEqual([-23.5505, -46.6333]); // Last coordinate

      // Verify console logs indicate real route usage
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Using real route polyline with'),
        expect.any(Number),
        'decoded points'
      );
    });

    test('should render polyline with correct styling properties', async () => {
      api.optimizeRoute.mockResolvedValue({
        success: true,
        route: mockRouteWithRealData
      });

      render(<RouteOptimizer />);

      // Set up route optimization
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000-000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const markers = screen.getAllByTestId('marker');
      fireEvent.click(markers[0]);

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
      });

      // Verify polyline styling matches requirements
      const polyline = screen.getByTestId('polyline');
      expect(polyline).toHaveAttribute('data-color', '#FF0000'); // Red color
      expect(polyline).toHaveAttribute('data-weight', '6'); // Thick line
      expect(polyline).toHaveAttribute('data-opacity', '1'); // Fully opaque
    });
  });

  describe('Polyline Fallback to Waypoints', () => {
    test('should render polyline with waypoint coordinates when real route data is not available', async () => {
      api.optimizeRoute.mockResolvedValue({
        success: true,
        route: mockRouteWithoutRealData
      });

      render(<RouteOptimizer />);

      // Set up route optimization
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000-000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const markers = screen.getAllByTestId('marker');
      fireEvent.click(markers[0]);

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
      });

      // Check if polyline is rendered with waypoint data
      const polyline = screen.getByTestId('polyline');
      expect(polyline).toBeInTheDocument();

      // Verify that waypoint coordinates are used as fallback
      const positions = JSON.parse(polyline.getAttribute('data-positions'));
      expect(positions).toHaveLength(mockRouteWithoutRealData.waypoints.length);
      expect(positions[0]).toEqual([-23.5505, -46.6333]); // Origin
      expect(positions[1]).toEqual([-23.5515, -46.6343]); // Customer A
      expect(positions[2]).toEqual([-23.5525, -46.6353]); // Customer B
      expect(positions[3]).toEqual([-23.5505, -46.6333]); // Return to origin

      // Verify console logs indicate waypoint fallback usage
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Using waypoint straight-line polyline with'),
        expect.any(Number),
        'points'
      );
    });
  });

  describe('Polyline Error Handling', () => {
    test('should not render polyline when no route data is available', async () => {
      render(<RouteOptimizer />);

      // Load customers without optimizing route
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      // Verify no polyline is rendered
      const polylines = screen.queryAllByTestId('polyline');
      const routePolylines = polylines.filter(p =>
        p.getAttribute('data-color') === '#FF0000' &&
        p.getAttribute('data-weight') === '6'
      );
      expect(routePolylines).toHaveLength(0);

      // Verify console log indicates no route data
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('No route data available for polyline')
      );
    });

    test('should handle invalid coordinate data gracefully', async () => {
      const routeWithInvalidCoords = {
        waypoints: [
          { lat: 'invalid', lng: -46.6333, name: 'Origem' },
          { lat: -23.5515, lng: 'invalid', name: 'Customer A' },
          { lat: null, lng: undefined, name: 'Customer B' }
        ],
        totalDistance: 1.0,
        estimatedTime: 5
      };

      api.optimizeRoute.mockResolvedValue({
        success: true,
        route: routeWithInvalidCoords
      });

      render(<RouteOptimizer />);

      // Set up route optimization
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000-000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const markers = screen.getAllByTestId('marker');
      fireEvent.click(markers[0]);

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
      });

      // Verify no polyline is rendered due to invalid coordinates
      const polylines = screen.queryAllByTestId('polyline');
      const routePolylines = polylines.filter(p =>
        p.getAttribute('data-color') === '#FF0000'
      );
      expect(routePolylines).toHaveLength(0);

      // Verify console warning about invalid coordinates
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid coordinate format detected'),
        expect.anything()
      );
    });

    test('should not render polyline with insufficient coordinates', async () => {
      const routeWithSinglePoint = {
        waypoints: [
          { lat: -23.5505, lng: -46.6333, name: 'Origem' }
        ],
        totalDistance: 0,
        estimatedTime: 0
      };

      api.optimizeRoute.mockResolvedValue({
        success: true,
        route: routeWithSinglePoint
      });

      render(<RouteOptimizer />);

      // Set up route optimization
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000-000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
      });

      // Verify no polyline is rendered with insufficient points
      const polylines = screen.queryAllByTestId('polyline');
      const routePolylines = polylines.filter(p =>
        p.getAttribute('data-color') === '#FF0000'
      );
      expect(routePolylines).toHaveLength(0);

      // Verify console warning about insufficient coordinates
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Insufficient coordinates for polyline'),
        expect.anything()
      );
    });
  });

  describe('Debug Information Display', () => {
    test('should display debug panel in development environment', async () => {
      // Set NODE_ENV to development
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      api.optimizeRoute.mockResolvedValue({
        success: true,
        route: mockRouteWithRealData
      });

      render(<RouteOptimizer />);

      // Set up route optimization
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000-000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const markers = screen.getAllByTestId('marker');
      fireEvent.click(markers[0]);

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
      });

      // Check for debug panel
      expect(screen.getByText(/🐛 Debug: Polyline Info/)).toBeInTheDocument();
      expect(screen.getByText(/Real Route Available: Yes/)).toBeInTheDocument();
      expect(screen.getByText(/Decoded Path Points: 9/)).toBeInTheDocument();
      expect(screen.getByText(/Waypoints: 4/)).toBeInTheDocument();

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });

    test('should not display debug panel in production environment', async () => {
      // Set NODE_ENV to production
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      api.optimizeRoute.mockResolvedValue({
        success: true,
        route: mockRouteWithRealData
      });

      render(<RouteOptimizer />);

      // Set up route optimization
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000-000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const markers = screen.getAllByTestId('marker');
      fireEvent.click(markers[0]);

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
      });

      // Check that debug panel is not displayed
      expect(screen.queryByText(/🐛 Debug: Polyline Info/)).not.toBeInTheDocument();

      // Restore original environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Console Logging Verification', () => {
    test('should log proper debugging information during polyline rendering', async () => {
      api.optimizeRoute.mockResolvedValue({
        success: true,
        route: mockRouteWithRealData
      });

      render(<RouteOptimizer />);

      // Complete route optimization flow
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000-000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const markers = screen.getAllByTestId('marker');
      fireEvent.click(markers[0]);

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
      });

      // Verify all expected console logs
      expect(console.log).toHaveBeenCalledWith('🗺️ Route data structure:', expect.any(Object));
      expect(console.log).toHaveBeenCalledWith('🗺️ Real route data:', expect.any(Object));
      expect(console.log).toHaveBeenCalledWith('🗺️ Path source:', 'real-route');
      expect(console.log).toHaveBeenCalledWith('🗺️ Rendering polyline with', expect.any(Number), 'valid points');
    });
  });
});