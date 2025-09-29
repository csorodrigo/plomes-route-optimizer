import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import RouteOptimizer from '../RouteOptimizer';
import api from '../../services/api';
import PolylineTestFactory from '../../__tests__/utils/polylineTestFactory';
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

// Mock react-leaflet with more detailed implementation
jest.mock('react-leaflet', () => ({
  MapContainer: ({ children, center, zoom, style }) => (
    <div
      data-testid="map-container"
      data-center={JSON.stringify(center)}
      data-zoom={zoom}
      style={style}
    >
      {children}
    </div>
  ),
  TileLayer: (props) => (
    <div data-testid="tile-layer" data-url={props.url} />
  ),
  Marker: ({ children, eventHandlers, position, icon, draggable, ...props }) => (
    <div
      data-testid="marker"
      data-position={JSON.stringify(position)}
      data-draggable={draggable}
      data-icon={icon?.options?.className || 'default-marker'}
      onClick={() => eventHandlers?.click && eventHandlers.click()}
      onMouseMove={() => eventHandlers?.dragend && eventHandlers.dragend({
        target: { getLatLng: () => ({ lat: position[0], lng: position[1] }) }
      })}
    >
      {children}
    </div>
  ),
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  Polyline: ({ positions, color, weight, opacity, pane, dashArray, ...props }) => (
    <div
      data-testid="polyline"
      data-positions={JSON.stringify(positions)}
      data-color={color}
      data-weight={weight}
      data-opacity={opacity}
      data-pane={pane}
      data-dash-array={dashArray}
      data-coordinates-count={positions?.length || 0}
    />
  ),
  Circle: ({ center, radius, fillColor, fillOpacity, color, weight }) => (
    <div
      data-testid="circle"
      data-center={JSON.stringify(center)}
      data-radius={radius}
      data-fill-color={fillColor}
      data-fill-opacity={fillOpacity}
      data-color={color}
      data-weight={weight}
    />
  ),
  useMap: () => ({
    flyTo: jest.fn(),
    getZoom: () => 11
  })
}));

// Mock Material-UI
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

jest.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children }) => <div>{children}</div>,
  Droppable: ({ children }) => children({ innerRef: jest.fn(), droppableProps: {}, placeholder: null }, {}),
  Draggable: ({ children }) => children({ innerRef: jest.fn(), draggableProps: {}, dragHandleProps: {} }, {})
}));

describe('RouteOptimizer - Integration Tests for Polyline Map Display', () => {
  let consoleLogSpy, consoleWarnSpy, consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup console spies
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Setup default API mocks
    api.getCustomers.mockResolvedValue({
      customers: PolylineTestFactory.createMockCustomers(3)
    });
    api.geocodeAddress.mockResolvedValue({
      success: true,
      coordinates: PolylineTestFactory.createMockOrigin(),
      address: 'CEP 01000-000 - Centro, São Paulo'
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Complete Route Optimization and Polyline Rendering Flow', () => {
    test('should complete full workflow from customer loading to polyline rendering', async () => {
      const mockRoute = PolylineTestFactory.createRouteWithRealData();
      api.optimizeRoute.mockResolvedValue(
        PolylineTestFactory.createSuccessfulOptimizationResponse(mockRoute)
      );

      render(<RouteOptimizer />);

      // Step 1: Load customers
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);

      await waitFor(() => {
        expect(api.getCustomers).toHaveBeenCalled();
        expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('3'));
      });

      // Verify customers are loaded and displayed
      const customerMarkers = screen.getAllByTestId('marker');
      expect(customerMarkers.length).toBeGreaterThan(0);

      // Step 2: Set origin via CEP
      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);

      await waitFor(() => {
        expect(api.geocodeAddress).toHaveBeenCalled();
        expect(screen.getByText('📍 Origem definida:')).toBeInTheDocument();
      });

      // Verify origin marker and coverage circle
      const originMarkers = screen.getAllByTestId('marker').filter(
        m => m.getAttribute('data-icon')?.includes('draggable-origin-marker')
      );
      expect(originMarkers.length).toBe(1);

      const coverageCircle = screen.getByTestId('circle');
      expect(coverageCircle).toBeInTheDocument();

      // Step 3: Select customers
      const selectableMarkers = screen.getAllByTestId('marker').filter(
        m => !m.getAttribute('data-icon')?.includes('draggable-origin-marker')
      );

      // Click first two customers
      fireEvent.click(selectableMarkers[0]);
      fireEvent.click(selectableMarkers[1]);

      await waitFor(() => {
        expect(screen.getByText(/routeOptimizer\.selected.*2/)).toBeInTheDocument();
      });

      // Step 4: Optimize route
      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      expect(optimizeButton).not.toBeDisabled();

      await act(async () => {
        fireEvent.click(optimizeButton);
        await waitFor(() => expect(api.optimizeRoute).toHaveBeenCalled());
      });

      // Step 5: Verify polyline rendering
      const routePolyline = screen.getByTestId('polyline');
      expect(routePolyline).toBeInTheDocument();

      // Verify polyline properties
      expect(routePolyline).toHaveAttribute('data-color', '#FF0000');
      expect(routePolyline).toHaveAttribute('data-weight', '6');
      expect(routePolyline).toHaveAttribute('data-opacity', '1');
      expect(routePolyline).toHaveAttribute('data-pane', 'overlayPane');

      // Verify coordinates count matches expected real route data
      const coordinatesCount = parseInt(routePolyline.getAttribute('data-coordinates-count'));
      expect(coordinatesCount).toBe(mockRoute.realRoute.decodedPath.length);

      // Step 6: Verify route information card
      expect(screen.getByText('route.optimizedRoute')).toBeInTheDocument();
      expect(screen.getByText('5.2')).toBeInTheDocument(); // Distance
      expect(screen.getByText(/18/)).toBeInTheDocument(); // Estimated time

      // Step 7: Verify console logging
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Route data structure:'),
        expect.any(Object)
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Using real route polyline with'),
        expect.any(Number),
        'decoded points'
      );
    });

    test('should handle route optimization with waypoint fallback', async () => {
      const mockRoute = PolylineTestFactory.createRouteWithoutRealData();
      api.optimizeRoute.mockResolvedValue(
        PolylineTestFactory.createSuccessfulOptimizationResponse(mockRoute)
      );

      render(<RouteOptimizer />);

      // Complete setup flow
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      // Select customers and optimize
      const selectableMarkers = screen.getAllByTestId('marker').filter(
        m => !m.getAttribute('data-icon')?.includes('draggable-origin-marker')
      );
      fireEvent.click(selectableMarkers[0]);

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
      });

      // Verify waypoint fallback polyline
      const routePolyline = screen.getByTestId('polyline');
      expect(routePolyline).toBeInTheDocument();

      const coordinatesCount = parseInt(routePolyline.getAttribute('data-coordinates-count'));
      expect(coordinatesCount).toBe(mockRoute.waypoints.length);

      // Verify console indicates waypoint usage
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Using waypoint straight-line polyline with'),
        expect.any(Number),
        'points'
      );
    });

    test('should handle API failure gracefully with local optimization fallback', async () => {
      api.optimizeRoute.mockRejectedValue(new Error('Network error'));

      render(<RouteOptimizer />);

      // Complete setup
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const selectableMarkers = screen.getAllByTestId('marker').filter(
        m => !m.getAttribute('data-icon')?.includes('draggable-origin-marker')
      );
      fireEvent.click(selectableMarkers[0]);

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
        await waitFor(() => expect(api.optimizeRoute).toHaveBeenCalled());
      });

      // Should still render polyline with local optimization
      const routePolyline = screen.getByTestId('polyline');
      expect(routePolyline).toBeInTheDocument();

      // Should show warning about local optimization
      expect(toast.warning).toHaveBeenCalledWith('route.optimizedLocally');
    });
  });

  describe('Map Interaction and Polyline Updates', () => {
    test('should update polyline when origin is dragged to new location', async () => {
      const mockRoute = PolylineTestFactory.createRouteWithRealData();
      api.optimizeRoute.mockResolvedValue(
        PolylineTestFactory.createSuccessfulOptimizationResponse(mockRoute)
      );

      render(<RouteOptimizer />);

      // Setup complete route
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const selectableMarkers = screen.getAllByTestId('marker').filter(
        m => !m.getAttribute('data-icon')?.includes('draggable-origin-marker')
      );
      fireEvent.click(selectableMarkers[0]);

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
      });

      // Verify initial polyline
      let routePolyline = screen.getByTestId('polyline');
      expect(routePolyline).toBeInTheDocument();

      // Simulate dragging origin marker
      const originMarker = screen.getAllByTestId('marker').find(
        m => m.getAttribute('data-draggable') === 'true'
      );

      expect(originMarker).toBeInTheDocument();

      // Trigger drag end event
      fireEvent.mouseMove(originMarker);

      await waitFor(() => {
        expect(toast.info).toHaveBeenCalledWith('route.originUpdated');
      });

      // Verify map center updates
      const mapContainer = screen.getByTestId('map-container');
      expect(mapContainer).toBeInTheDocument();
    });

    test('should handle customer selection and deselection properly', async () => {
      render(<RouteOptimizer />);

      // Setup
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      // Test customer selection
      const selectableMarkers = screen.getAllByTestId('marker').filter(
        m => !m.getAttribute('data-icon')?.includes('draggable-origin-marker')
      );

      // Select first customer
      fireEvent.click(selectableMarkers[0]);
      await waitFor(() => {
        expect(screen.getByText(/routeOptimizer\.selected.*1/)).toBeInTheDocument();
      });

      // Select second customer
      fireEvent.click(selectableMarkers[1]);
      await waitFor(() => {
        expect(screen.getByText(/routeOptimizer\.selected.*2/)).toBeInTheDocument();
      });

      // Deselect first customer
      fireEvent.click(selectableMarkers[0]);
      await waitFor(() => {
        expect(screen.getByText(/routeOptimizer\.selected.*1/)).toBeInTheDocument();
      });
    });
  });

  describe('Performance and Memory Tests', () => {
    test('should handle complex routes with many waypoints efficiently', async () => {
      const complexRoute = PolylineTestFactory.createComplexRoute(50);
      api.optimizeRoute.mockResolvedValue(
        PolylineTestFactory.createSuccessfulOptimizationResponse(complexRoute)
      );

      const startTime = performance.now();

      render(<RouteOptimizer />);

      // Setup and optimize route
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const selectableMarkers = screen.getAllByTestId('marker').filter(
        m => !m.getAttribute('data-icon')?.includes('draggable-origin-marker')
      );
      fireEvent.click(selectableMarkers[0]);

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Verify polyline is rendered
      const routePolyline = screen.getByTestId('polyline');
      expect(routePolyline).toBeInTheDocument();

      // Verify performance benchmark
      const benchmarks = PolylineTestFactory.createPerformanceBenchmarks();
      expect(renderTime).toBeLessThan(benchmarks.maxRenderTime * 10); // Allow more time for complex routes

      // Verify coordinate count
      const coordinatesCount = parseInt(routePolyline.getAttribute('data-coordinates-count'));
      expect(coordinatesCount).toBeLessThanOrEqual(benchmarks.maxCoordinateCount);
    });

    test('should maintain good performance with rapid customer selections', async () => {
      render(<RouteOptimizer />);

      // Setup
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const selectableMarkers = screen.getAllByTestId('marker').filter(
        m => !m.getAttribute('data-icon')?.includes('draggable-origin-marker')
      );

      const startTime = performance.now();

      // Rapidly select and deselect customers
      for (let i = 0; i < 10; i++) {
        fireEvent.click(selectableMarkers[0]);
        fireEvent.click(selectableMarkers[1]);
        fireEvent.click(selectableMarkers[0]); // deselect
        fireEvent.click(selectableMarkers[1]); // deselect
      }

      const endTime = performance.now();
      const interactionTime = endTime - startTime;

      // Should handle rapid interactions efficiently
      expect(interactionTime).toBeLessThan(1000); // Less than 1 second for 40 interactions
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle empty customer list gracefully', async () => {
      api.getCustomers.mockResolvedValue({ customers: [] });

      render(<RouteOptimizer />);

      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);

      await waitFor(() => {
        expect(api.getCustomers).toHaveBeenCalled();
        expect(screen.getByText(/routeOptimizer\.geocoded.*0/)).toBeInTheDocument();
      });

      // Should not have any customer markers
      const customerMarkers = screen.queryAllByTestId('marker');
      expect(customerMarkers).toHaveLength(0);

      // Should not be able to optimize without customers
      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      expect(optimizeButton).toBeDisabled();
    });

    test('should handle invalid CEP input gracefully', async () => {
      api.geocodeAddress.mockResolvedValue({ success: false });

      render(<RouteOptimizer />);

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: 'invalid-cep' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);

      await waitFor(() => {
        expect(toast.warning).toHaveBeenCalledWith('messages.invalidCEP');
      });

      // Should not set origin
      expect(screen.queryByText('📍 Origem definida:')).not.toBeInTheDocument();
    });

    test('should handle route optimization failure', async () => {
      api.optimizeRoute.mockResolvedValue({ success: false, error: 'Optimization failed' });

      render(<RouteOptimizer />);

      // Setup
      const loadButton = screen.getByText('📥 routeOptimizer.loadCustomers');
      fireEvent.click(loadButton);
      await waitFor(() => expect(api.getCustomers).toHaveBeenCalled());

      const cepInput = screen.getByPlaceholderText('routeOptimizer.originPlaceholder');
      fireEvent.change(cepInput, { target: { value: '01000000' } });

      const setOriginButton = screen.getByText('📍');
      fireEvent.click(setOriginButton);
      await waitFor(() => expect(api.geocodeAddress).toHaveBeenCalled());

      const selectableMarkers = screen.getAllByTestId('marker').filter(
        m => !m.getAttribute('data-icon')?.includes('draggable-origin-marker')
      );
      fireEvent.click(selectableMarkers[0]);

      const optimizeButton = screen.getByText('🚀 routeOptimizer.optimizeRoute');
      await act(async () => {
        fireEvent.click(optimizeButton);
      });

      // Should fallback to local optimization
      const routePolyline = screen.getByTestId('polyline');
      expect(routePolyline).toBeInTheDocument();

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('route.optimizedRoute')
      );
    });
  });
});