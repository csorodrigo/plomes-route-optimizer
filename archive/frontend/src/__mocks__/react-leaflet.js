import React from 'react';

// Mock components for react-leaflet
export const MapContainer = ({ children, center, zoom, style, ...props }) => (
  <div
    data-testid="map-container"
    data-center={JSON.stringify(center)}
    data-zoom={zoom}
    style={style}
    {...props}
  >
    {children}
  </div>
);

export const TileLayer = (props) => (
  <div data-testid="tile-layer" {...props} />
);

export const Marker = ({ children, position, eventHandlers, icon, draggable, ...props }) => (
  <div
    data-testid="marker"
    data-position={JSON.stringify(position)}
    data-draggable={draggable}
    data-icon={icon?.options?.className || 'default-marker'}
    onClick={() => eventHandlers?.click && eventHandlers.click()}
    onMouseMove={() => eventHandlers?.dragend && eventHandlers.dragend({
      target: { getLatLng: () => ({ lat: position[0], lng: position[1] }) }
    })}
    {...props}
  >
    {children}
  </div>
);

export const Popup = ({ children, ...props }) => (
  <div data-testid="popup" {...props}>
    {children}
  </div>
);

export const Polyline = ({ positions, color, weight, opacity, pane, dashArray, ...props }) => (
  <div
    data-testid="polyline"
    data-positions={JSON.stringify(positions)}
    data-color={color}
    data-weight={weight}
    data-opacity={opacity}
    data-pane={pane}
    data-dash-array={dashArray}
    data-coordinates-count={positions?.length || 0}
    {...props}
  />
);

export const Circle = ({ center, radius, fillColor, fillOpacity, color, weight, ...props }) => (
  <div
    data-testid="circle"
    data-center={JSON.stringify(center)}
    data-radius={radius}
    data-fill-color={fillColor}
    data-fill-opacity={fillOpacity}
    data-color={color}
    data-weight={weight}
    {...props}
  />
);

export const useMap = () => ({
  flyTo: jest.fn(),
  getZoom: () => 11,
  setView: jest.fn(),
  panTo: jest.fn(),
  fitBounds: jest.fn(),
  getContainer: () => document.createElement('div')
});

export const useMapEvents = (handlers) => {
  // Mock map events
  React.useEffect(() => {
    // Simulate click event if handler provided
    if (handlers.click) {
      const mockEvent = {
        latlng: { lat: -23.5505, lng: -46.6333 }
      };
      setTimeout(() => handlers.click(mockEvent), 100);
    }
  }, [handlers]);

  return null;
};