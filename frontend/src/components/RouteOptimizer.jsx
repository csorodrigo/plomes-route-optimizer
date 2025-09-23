import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '../utils/translations';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Circle,
  useMap
} from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'react-toastify';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  useTheme,
  useMediaQuery,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  Button
} from '@mui/material';
import {
  Route as RouteIcon,
  AccessTime,
  LocationOn,
  Navigation,
  DirectionsCar,
  TrendingUp,
  ExpandMore,
  Schedule,
  Room,
  PictureAsPdf,
  Download,
  DragIndicator
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Logo from './common/Logo';
import api from '../services/api';
import pdfExportService from '../services/pdfExportService.js';
import {
  calculateDistance,
  filterCustomersInRadius,
  isValidBrazilCoordinates,
  kmToMeters
} from '../utils/geoUtils';

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom icons
const originIcon = new L.DivIcon({
  html: `
    <div style="position: relative; cursor: move;">
      <img src="https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png" 
           style="width: 25px; height: 41px;" />
      <div style="
        position: absolute;
        top: -25px;
        left: -15px;
        background: rgba(255, 255, 255, 0.95);
        border: 2px solid #dc3545;
        border-radius: 4px;
        padding: 2px 5px;
        font-size: 10px;
        font-weight: bold;
        white-space: nowrap;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      ">
        ↕ Arraste-me
      </div>
    </div>
  `,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  className: 'draggable-origin-marker'
});

const customerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Map controller component
const MapController = ({ center, zoom }) => {
  const map = useMap();

  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, zoom || map.getZoom(), {
        duration: 1.5
      });
    }
  }, [map, center, zoom]);

  return null;
};

// Route Information Card Component
const RouteInfoCard = ({ route, customers, origin, onExportPDF, loading, onRouteSegmentReorder }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (!route || !route.waypoints || route.waypoints.length === 0) {
    return null;
  }

  // Calculate segment details
  const calculateSegments = () => {
    const segments = [];
    const waypoints = route.waypoints;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];

      // Skip segments where both from and to are the same origin point
      // This prevents "Origem → Origem" segments at the beginning
      if (from.name === 'Origem' && to.name === 'Origem' && i === 0) {
        continue;
      }

      // Skip any duplicate origin segments (shouldn't happen but safety check)
      if (from.name === 'Origem' && to.name === 'Origem' &&
          from.lat === to.lat && from.lng === to.lng) {
        continue;
      }

      const distance = calculateDistance(
        from.lat, from.lng,
        to.lat, to.lng
      );

      // Estimate time based on average speed (40 km/h in city)
      const estimatedTime = Math.round((distance / 40) * 60);

      // Determine if this is a return segment (last customer back to origin)
      const isReturn = i === waypoints.length - 2 &&
                      (to.name === 'Origem' || to.isOrigin);

      segments.push({
        from: from.name || `Ponto ${i + 1}`,
        to: to.name || `Ponto ${i + 2}`,
        distance: distance,
        time: estimatedTime,
        isReturn: isReturn
      });
    }

    return segments;
  };

  const segments = calculateSegments();

  // Calculate total stops more accurately
  // Count unique waypoints that are not 'Origem'
  const uniqueStops = route.waypoints.filter((waypoint, index, arr) => {
    // Exclude origin points (name === 'Origem' or similar)
    if (waypoint.name === 'Origem' || waypoint.name === 'Ponto de Origem') {
      return false;
    }
    // For customer waypoints, count only unique ones
    return waypoint.id && waypoint.name;
  });

  const totalStops = uniqueStops.length;

  // Handle drag and drop for route segments
  const handleSegmentDragEnd = (result) => {
    if (!result.destination || !onRouteSegmentReorder) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    // Filter out return segments for reordering - create draggable segments with proper indices
    const draggableSegments = segments.filter((seg, index) => {
      return !seg.isReturn && seg.to !== 'Origem' && seg.to !== 'Ponto de Origem';
    });

    if (sourceIndex >= draggableSegments.length || destinationIndex >= draggableSegments.length) {
      return; // Invalid indices
    }

    // Create new segments order
    const newSegments = Array.from(draggableSegments);
    const [movedSegment] = newSegments.splice(sourceIndex, 1);
    newSegments.splice(destinationIndex, 0, movedSegment);

    // Convert segments back to customer order
    const customerOrder = [];

    newSegments.forEach((segment) => {
      // Find the corresponding waypoint in the route
      const targetWaypoint = route.waypoints.find(w =>
        w.name === segment.to && w.name !== 'Origem' && !w.isOrigin
      );

      if (targetWaypoint && targetWaypoint.id) {
        // Find the customer object
        const customer = customers.find(c => c.id === targetWaypoint.id);
        if (customer) {
          customerOrder.push(customer);
        }
      }
    });

    if (customerOrder.length > 0) {
      onRouteSegmentReorder(customerOrder);
    }
  };

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${minutes}min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  return (
    <Card
      elevation={8}
      sx={{
        background: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`,
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
        }
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1 }}>
        {/* Header with Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Logo size="medium" showText={!isMobile} color="white" />
          <Box sx={{ ml: 'auto' }}>
            <Chip
              icon={<RouteIcon />}
              label={t('route.optimizedRoute')}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                fontWeight: 'bold'
              }}
            />
          </Box>
        </Box>

        {/* Main Stats */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: 2,
          mb: 3
        }}>
          <Paper elevation={2} sx={{
            p: 2,
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            color: 'white'
          }}>
            <DirectionsCar sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6" fontWeight="bold">
              {route.totalDistance ? route.totalDistance.toFixed(1) : '0.0'}
            </Typography>
            <Typography variant="body2">
              {t('route.totalDistance')} (km)
            </Typography>
          </Paper>

          <Paper elevation={2} sx={{
            p: 2,
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            color: 'white'
          }}>
            <Schedule sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6" fontWeight="bold">
              {formatTime(route.estimatedTime || 0)}
            </Typography>
            <Typography variant="body2">
              {t('route.estimatedTime')}
            </Typography>
          </Paper>

          <Paper elevation={2} sx={{
            p: 2,
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            color: 'white'
          }}>
            <Room sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6" fontWeight="bold">
              {totalStops}
            </Typography>
            <Typography variant="body2">
              {t('route.stops')}
            </Typography>
          </Paper>

          <Paper elevation={2} sx={{
            p: 2,
            textAlign: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            color: 'white'
          }}>
            <TrendingUp sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6" fontWeight="bold">
              {segments.length}
            </Typography>
            <Typography variant="body2">
              {t('route.segments')}
            </Typography>
          </Paper>
        </Box>

        {/* Route Segments Accordion */}
        <Accordion
          elevation={0}
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            color: 'white',
            '&::before': {
              display: 'none',
            }
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore sx={{ color: 'white' }} />}
            sx={{ '& .MuiAccordionSummary-content': { alignItems: 'center' } }}
          >
            <Navigation sx={{ mr: 1 }} />
            <Typography variant="h6">
              {t('route.routeDetails')} ({segments.length} {t('route.segments').toLowerCase()})
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontStyle: 'italic', mb: 2, display: 'block' }}>
              📋 Segmentos da rota otimizada
            </Typography>

            <List
              dense
              sx={{
                backgroundColor: 'transparent',
                borderRadius: 1,
                padding: 0
              }}
            >
              {segments.map((segment, index) => {
                // Don't make return segment draggable - just render it
                if (segment.isReturn) {
                  return (
                    <React.Fragment key={`return-${index}`}>
                      {index > 0 && <Divider sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />}
                      <ListItem sx={{ px: 0 }}>
                        <ListItemIcon sx={{ minWidth: 40, color: 'white' }}>
                          <Box sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            backgroundColor: '#f44336',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            🏠
                          </Box>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight="medium" component="div">
                              {segment.from} → {segment.to}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{
                              display: 'flex',
                              gap: 2,
                              mt: 0.5,
                              flexWrap: 'wrap'
                            }}>
                              <Chip
                                size="small"
                                icon={<DirectionsCar sx={{ fontSize: 14 }} />}
                                label={`${segment.distance.toFixed(1)} km`}
                                sx={{
                                  height: 20,
                                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                  color: 'white',
                                  '& .MuiChip-icon': { color: 'white' }
                                }}
                              />
                              <Chip
                                size="small"
                                icon={<AccessTime sx={{ fontSize: 14 }} />}
                                label={formatTime(segment.time)}
                                sx={{
                                  height: 20,
                                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                  color: 'white',
                                  '& .MuiChip-icon': { color: 'white' }
                                }}
                              />
                            </Box>
                          }
                          primaryTypographyProps={{ component: 'div' }}
                          secondaryTypographyProps={{ component: 'div' }}
                        />
                      </ListItem>
                    </React.Fragment>
                  );
                }

                // Render regular segments as static list items (not draggable)
                return (
                  <React.Fragment key={`segment-${index}`}>
                    {index > 0 && <Divider sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }} />}
                    <ListItem sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 40, color: 'white' }}>
                        <Box sx={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          backgroundColor: '#4caf50',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {index + 1}
                        </Box>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight="medium" component="div">
                            {segment.from} → {segment.to}
                          </Typography>
                        }
                        secondary={
                          <Box sx={{
                            display: 'flex',
                            gap: 2,
                            mt: 0.5,
                            flexWrap: 'wrap'
                          }}>
                            <Chip
                              size="small"
                              icon={<DirectionsCar sx={{ fontSize: 14 }} />}
                              label={`${segment.distance.toFixed(1)} km`}
                              sx={{
                                height: 20,
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                color: 'white',
                                '& .MuiChip-icon': { color: 'white' }
                              }}
                            />
                            <Chip
                              size="small"
                              icon={<AccessTime sx={{ fontSize: 14 }} />}
                              label={formatTime(segment.time)}
                              sx={{
                                height: 20,
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                color: 'white',
                                '& .MuiChip-icon': { color: 'white' }
                              }}
                            />
                          </Box>
                        }
                        primaryTypographyProps={{ component: 'div' }}
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          </AccordionDetails>
        </Accordion>

        {/* Route Summary Footer */}
        <Box sx={{
          mt: 2,
          p: 2,
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRadius: 1,
          textAlign: 'center'
        }}>
          <Typography variant="body2" sx={{ opacity: 0.9, mb: 2 }}>
            <LocationOn sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
            Rota calculada com base na otimização por proximidade
          </Typography>

          {/* PDF Export Button */}
          <Button
            variant="contained"
            startIcon={<PictureAsPdf />}
            onClick={onExportPDF || (() => console.warn('PDF export function not available'))}
            disabled={loading || !onExportPDF}
            size="medium"
            sx={{
              backgroundColor: '#d32f2f',
              color: 'white',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              border: '2px solid white',
              '&:hover': {
                backgroundColor: '#b71c1c',
                boxShadow: '0 6px 12px rgba(0,0,0,0.4)',
                transform: 'translateY(-1px)'
              },
              '&:disabled': {
                backgroundColor: 'rgba(150, 150, 150, 0.8)',
                color: 'rgba(255, 255, 255, 0.7)',
                border: '2px solid rgba(255, 255, 255, 0.5)'
              }
            }}
            title={onExportPDF ? "Exportar rota como PDF" : "Função PDF não está disponível - primeiro otimize uma rota"}
          >
            📄 {t('pdf.exportPDF')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

const RouteOptimizer = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // State
  const [origin, setOrigin] = useState(null);
  const [originCep, setOriginCep] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState(new Set());
  const [selectedCustomersOrder, setSelectedCustomersOrder] = useState([]); // New state for ordered selected customers
  const [radius, setRadius] = useState(15);
  const [route, setRoute] = useState(null);
  const [routeOrder, setRouteOrder] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    geocoded: 0,
    filtered: 0
  });
  const [mapCenter, setMapCenter] = useState([-3.7319, -38.5267]); // Fortaleza-CE
  const [mapZoom, setMapZoom] = useState(11);
  const [autoOptimize, setAutoOptimize] = useState(false);

  // Load customers on mount
  useEffect(() => {
    loadCustomers();
  }, []);

  // Auto optimize when customers are selected
  useEffect(() => {
    if (autoOptimize && origin && selectedCustomers.size > 0) {
      optimizeRoute();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomers, autoOptimize]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await api.getCustomers();
      
      const customerList = response.customers || response;
      
      // Filtrar clientes - mostrar todos que tenham coordenadas válidas no Brasil
      const geocoded = customerList.filter(c => 
        isValidBrazilCoordinates(c.latitude, c.longitude)
      );
      
      // Mostrar apenas clientes com coordenadas válidas
      const customersToShow = geocoded;
      setCustomers(customersToShow);
      setStats(prev => ({
        ...prev,
        total: customerList.length,
        geocoded: geocoded.length
      }));
      
      toast.success(`${geocoded.length} ${t('messages.customersLoaded')}`);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error(`${t('messages.errorLoadingCustomers')}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const setCepOrigin = async () => {
    const cep = originCep.replace(/\D/g, '');
    if (cep.length !== 8) {
      toast.warning(t('messages.invalidCEP'));
      return;
    }

    setLoading(true);
    try {
      const response = await api.geocodeAddress(cep);
      
      if (response.success && response.coordinates) {
        const { lat, lng } = response.coordinates;
        
        // Define a origem
        setOrigin({ lat, lng, address: response.address || `CEP ${originCep}` });
        
        // Força atualização do centro do mapa com pequeno delay
        setTimeout(() => {
          setMapCenter([lat, lng]);
          setMapZoom(15); // Zoom mais próximo para ver melhor o pin
        }, 100);
        
        toast.success(`${t('messages.originSet')}: ${response.address}`);
      } else {
        toast.error(t('messages.cepNotFound'));
      }
    } catch (error) {
      toast.error(t('messages.errorSearchingCEP'));
    } finally {
      setLoading(false);
    }
  };

  const toggleCustomerSelection = (customerId) => {
    const newSelected = new Set(selectedCustomers);
    let newOrderedList = [...selectedCustomersOrder];

    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
      // Remove from ordered list
      newOrderedList = newOrderedList.filter(c => c.id !== customerId);
    } else {
      newSelected.add(customerId);
      // Add to ordered list
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        newOrderedList.push(customer);
      }
    }

    setSelectedCustomers(newSelected);
    setSelectedCustomersOrder(newOrderedList);
  };

  const selectAllAtCoordinates = (lat, lng) => {
    // Find all customers at the same coordinates (with tolerance for floating point comparison)
    const tolerance = 0.000001;
    const customersAtLocation = filteredCustomers.filter(customer =>
      Math.abs(customer.latitude - lat) < tolerance &&
      Math.abs(customer.longitude - lng) < tolerance
    );

    const newSelected = new Set(selectedCustomers);
    let newOrderedList = [...selectedCustomersOrder];

    // If any customer at this location is not selected, select all of them
    // If all are selected, deselect all of them
    const allSelected = customersAtLocation.every(c => newSelected.has(c.id));

    customersAtLocation.forEach(customer => {
      if (allSelected) {
        newSelected.delete(customer.id);
        // Remove from ordered list
        newOrderedList = newOrderedList.filter(c => c.id !== customer.id);
      } else {
        newSelected.add(customer.id);
        // Add to ordered list if not already present
        if (!newOrderedList.find(c => c.id === customer.id)) {
          newOrderedList.push(customer);
        }
      }
    });

    setSelectedCustomers(newSelected);
    setSelectedCustomersOrder(newOrderedList);
  };

  const removeCustomerSelection = (customerId) => {
    const newSelected = new Set(selectedCustomers);
    newSelected.delete(customerId);

    // Remove from ordered list
    const newOrderedList = selectedCustomersOrder.filter(c => c.id !== customerId);

    setSelectedCustomers(newSelected);
    setSelectedCustomersOrder(newOrderedList);
  };


  // Remove local calculateDistance function - using centralized utility

  const optimizeRoute = async () => {
    if (!origin || selectedCustomers.size === 0) {
      toast.warning(t('messages.defineOriginAndCustomers'));
      return;
    }

    setLoading(true);
    try {
      const selected = customers.filter(c => selectedCustomers.has(c.id));
      const waypoints = selected.map(c => ({
        lat: c.latitude,
        lng: c.longitude,
        name: c.name,
        id: c.id
      }));

      // Chamar API para otimizar e salvar a rota
      const response = await api.optimizeRoute(origin, waypoints, {
        save: true,
        useRealRoutes: true,
        returnToOrigin: true
      });


      if (response.success) {
        const { route } = response;
        console.log('🗺️ Route optimization response:', route);
        console.log('🗺️ Real route data:', route.realRoute);

        setRoute(route);

        // Extract customer order from route waypoints
        const customerOrder = route.waypoints
          .filter(w => w.id && w.name !== 'Origem')
          .map(w => selected.find(c => c.id === w.id))
          .filter(Boolean);

        setRouteOrder(customerOrder);
        // Synchronize selectedCustomersOrder with the optimized route order
        setSelectedCustomersOrder(customerOrder);

        toast.success(`${t('route.savedSuccessfully')} ${route.totalDistance.toFixed(1)}km, ~${route.estimatedTime}min`);
      } else {
        // Fallback para otimização local
        const optimized = nearestNeighbor(origin, waypoints);
        const totalDistance = calculateTotalDistance(optimized);
        const estimatedTime = Math.round((totalDistance / 40) * 60);

        const routeData = {
          waypoints: optimized,
          totalDistance,
          estimatedTime
        };

        setRoute(routeData);

        // Extract customer order from optimized route
        const customerOrder = optimized
          .filter(w => w.id && w.name !== 'Origem')
          .map(w => selected.find(c => c.id === w.id))
          .filter(Boolean);

        setRouteOrder(customerOrder);
        // Synchronize selectedCustomersOrder with the optimized route order
        setSelectedCustomersOrder(customerOrder);

        toast.success(`${t('route.optimizedRoute')}! ${totalDistance.toFixed(1)}km, ~${estimatedTime}min`);
      }
    } catch (error) {
      console.error('Erro ao otimizar rota:', error);
      // Fallback para otimização local em caso de erro
      try {
        const selected = customers.filter(c => selectedCustomers.has(c.id));
        const waypoints = selected.map(c => ({
          lat: c.latitude,
          lng: c.longitude,
          name: c.name
        }));

        const optimized = nearestNeighbor(origin, waypoints);
        const totalDistance = calculateTotalDistance(optimized);
        const estimatedTime = Math.round((totalDistance / 40) * 60);

        const routeData = {
          waypoints: optimized,
          totalDistance,
          estimatedTime
        };

        setRoute(routeData);

        // Extract customer order from optimized route
        const customerOrder = optimized
          .filter(w => w.id && w.name !== 'Origem')
          .map(w => selected.find(c => c.id === w.id))
          .filter(Boolean);

        setRouteOrder(customerOrder);
        // Synchronize selectedCustomersOrder with the optimized route order
        setSelectedCustomersOrder(customerOrder);

        toast.warning(t('route.optimizedLocally'));
      } catch (localError) {
        toast.error(t('messages.errorOptimizingRoute'));
      }
    } finally {
      setLoading(false);
    }
  };

  const nearestNeighbor = (start, points) => {
    const route = [{...start, name: 'Origem'}];
    const remaining = [...points];
    let current = start;

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minDist = Infinity;

      for (let idx = 0; idx < remaining.length; idx++) {
        const point = remaining[idx];
        const dist = calculateDistance(
          current.lat, current.lng,
          point.lat, point.lng
        );
        if (dist < minDist) {
          minDist = dist;
          nearestIdx = idx;
        }
      }

      const next = remaining.splice(nearestIdx, 1)[0];
      route.push(next);
      current = next;
    }

    // Não retorna ao ponto inicial - rota otimizada sequencial
    return route;
  };

  const calculateTotalDistance = (route) => {
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
      total += calculateDistance(
        route[i].lat, route[i].lng,
        route[i + 1].lat, route[i + 1].lng
      );
    }
    return total;
  };

  const updateRouteWithNewOrder = useCallback(async (newOrder) => {
    if (!origin || !newOrder || newOrder.length === 0) return;

    setLoading(true);
    try {
      const waypoints = newOrder.map(customer => ({
        lat: customer.latitude,
        lng: customer.longitude,
        name: customer.name,
        id: customer.id
      }));

      // Create new route with manual order (no optimization)
      const manualRoute = [
        { ...origin, name: 'Origem' },
        ...waypoints,
        { ...origin, name: 'Origem' }
      ];

      const totalDistance = calculateTotalDistance(manualRoute);
      const estimatedTime = Math.round((totalDistance / 40) * 60);

      const newRoute = {
        waypoints: manualRoute,
        totalDistance,
        estimatedTime,
        manuallyOrdered: true
      };

      setRoute(newRoute);

      // Try to save the new route order to the server
      try {
        await api.optimizeRoute(origin, waypoints, {
          save: true,
          useRealRoutes: false,
          manualOrder: true,
          returnToOrigin: true
        });
      } catch (error) {
        console.warn('Could not save route to server:', error);
      }

    } catch (error) {
      console.error('Error updating route:', error);
      toast.error(t('messages.errorUpdatingRoute'));
    } finally {
      setLoading(false);
    }
  }, [origin]);

  // Handle drag and drop for selected customers
  const handleSelectedCustomersDragEnd = useCallback((result) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    // Use the ordered list instead of filtering customers
    const newOrder = Array.from(selectedCustomersOrder);
    const [movedCustomer] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(destinationIndex, 0, movedCustomer);

    // Update both route order and selected customers order
    setRouteOrder(newOrder);
    setSelectedCustomersOrder(newOrder);

    // If we have a route and origin, recalculate the route with new order
    if (route && origin) {
      updateRouteWithNewOrder(newOrder);
    }

    toast.success('Ordem dos clientes selecionados atualizada!');
  }, [selectedCustomersOrder, route, origin, updateRouteWithNewOrder]);

  // Handle route reordering from CustomerList drag-and-drop
  const handleRouteReorder = useCallback((newOrder) => {
    setRouteOrder(newOrder);
    // Synchronize selectedCustomersOrder with the new route order
    setSelectedCustomersOrder(newOrder);

    if (route && origin) {
      // Recalculate route with new order
      updateRouteWithNewOrder(newOrder);
    }
  }, [route, origin, updateRouteWithNewOrder]);

  // Handle drag and drop for route customers (from CustomerList)
  const handleRouteCustomersDragEnd = useCallback((result) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    // Reorder the route customers
    const newOrder = Array.from(routeOrder);
    const [movedCustomer] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(destinationIndex, 0, movedCustomer);

    handleRouteReorder(newOrder);
    toast.success('Ordem da rota atualizada!');
  }, [routeOrder, handleRouteReorder]);

  // Handle drag and drop for route segments (placeholder - will be handled in RouteInfoCard)
  const handleSegmentDragEnd = useCallback((result) => {
    // This is handled within RouteInfoCard component
    // but we need this placeholder for the master handler
    console.warn('Segment drag should be handled within RouteInfoCard');
  }, []);

  // Master drag and drop handler for all drag operations
  const handleMasterDragEnd = useCallback((result) => {
    if (!result.destination) return;

    const { droppableId } = result.destination;

    // Route to appropriate handler based on droppableId
    switch (droppableId) {
      case 'selected-customers':
        handleSelectedCustomersDragEnd(result);
        break;
      case 'route-customers':
        handleRouteCustomersDragEnd(result);
        break;
      default:
        console.warn('Unknown droppableId:', droppableId);
        // Don't handle route-segments here as they are now static display items
    }
  }, [handleSelectedCustomersDragEnd, handleRouteCustomersDragEnd]);

  const clearAll = () => {
    setOrigin(null);
    setOriginCep('');
    setSelectedCustomers(new Set());
    setSelectedCustomersOrder([]);
    setRoute(null);
    setRouteOrder([]);
    setRadius(15);
  };

  const clearSelectionsAndRoute = () => {
    setOrigin(null);
    setSelectedCustomers(new Set());
    setSelectedCustomersOrder([]);
    setRoute(null);
    setRouteOrder([]);
  };

  const exportToPDF = async () => {
    if (!route || !origin) {
      toast.warning(t('pdf.routeRequired'));
      return;
    }

    setLoading(true);
    try {
      const result = await pdfExportService.generateRouteReport(route, customers, origin);

      if (result.success) {
        toast.success(`${t('pdf.exportSuccess')}: ${result.filename}`);
      } else {
        toast.error(`${t('pdf.exportError')}: ${result.message}`);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error(t('pdf.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  // Memoize filteredCustomers to ensure consistent calculation across renders
  const filteredCustomers = useMemo(() => {
    // Directly calculate here instead of calling getFilteredCustomers to avoid dependency issues
    if (!origin || customers.length === 0) {
      return customers;
    }
    
    // Use the centralized filter function
    const filtered = filterCustomersInRadius(customers, origin, radius);
    
    return filtered;
  }, [customers, origin, radius]); // Dependencies: recalculate when any of these change
  
  const selectedCount = selectedCustomers.size;
  
  // Update filtered count in stats
  useEffect(() => {
    setStats(prev => ({ ...prev, filtered: filteredCustomers.length }));
  }, [filteredCustomers.length]);

  // Responsive layout configuration
  const layoutConfig = {
    container: {
      display: 'flex',
      height: 'calc(100vh - 64px)',
      background: theme.palette.grey[50],
      flexDirection: isMobile ? 'column' : 'row'
    },
    controls: {
      width: isMobile ? '100%' : '350px',
      height: isMobile ? 'auto' : '100%',
      maxHeight: isMobile ? '300px' : '100%',
      background: 'white',
      boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
      padding: '20px',
      // Remove overflow properties to prevent nested scroll container conflicts
      overflow: 'visible',
      zIndex: 1000,
      position: 'relative'
    },
    mainContent: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    },
    mapContainer: {
      width: '100%',
      height: '100%',
      position: 'relative',
      minHeight: isMobile ? '400px' : 'auto'
    },
    routeInfoContainer: {
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      right: '20px',
      zIndex: 1000,
      maxWidth: isMobile ? 'none' : '600px',
      margin: isMobile ? '0' : '0 auto'
    },
    controlGroup: {
      marginBottom: '20px',
      paddingBottom: '20px',
      borderBottom: `1px solid ${theme.palette.divider}`
    }
  };

  return (
    <DragDropContext onDragEnd={handleMasterDragEnd}>
      <Box sx={layoutConfig.container}>
      <Paper sx={layoutConfig.controls} elevation={2}>
        <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', color: theme.palette.primary.main }}>
          🗺️ {t('routeOptimizer.title')}
        </Typography>

        <Box sx={layoutConfig.controlGroup}>
          <Typography variant="subtitle2" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.palette.text.secondary }}>
            {t('routeOptimizer.origin')}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <input
              type="text"
              style={{
                flex: 1,
                padding: '10px',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              placeholder={t('routeOptimizer.originPlaceholder')}
              maxLength="9"
              value={originCep}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                let newCep;
                if (value.length <= 5) {
                  newCep = value;
                } else {
                  newCep = `${value.slice(0, 5)}-${value.slice(5, 8)}`;
                }

                if (newCep !== originCep) {
                  clearSelectionsAndRoute();
                }

                setOriginCep(newCep);
              }}
              onKeyPress={(e) => e.key === 'Enter' && setCepOrigin()}
            />
            <button
              style={{
                background: theme.palette.primary.main,
                color: 'white',
                border: 'none',
                padding: '10px',
                borderRadius: '4px',
                cursor: 'pointer',
                width: '60px'
              }}
              onClick={setCepOrigin}
              disabled={loading}
            >
              📍
            </button>
          </Box>
          {origin && (
            <Paper sx={{ mt: 1, p: 2, backgroundColor: theme.palette.info.light, color: theme.palette.info.contrastText }}>
              <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                📍 Origem definida:
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', mb: 1 }}>
                Lat: {origin.lat.toFixed(6)}, Lng: {origin.lng.toFixed(6)}
              </Typography>
              <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                💡 {t('routeOptimizer.dragTip')}
              </Typography>
            </Paper>
          )}
        </Box>

        <Box sx={layoutConfig.controlGroup}>
          <Typography variant="subtitle2" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.palette.text.secondary }}>
            {t('routeOptimizer.distanceFilter')}
          </Typography>
          <input
            type="range"
            style={{ width: '100%', margin: '10px 0' }}
            min="1"
            max="30"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" fontWeight="bold">{t('routeOptimizer.radius')}:</Typography>
            <Typography variant="body2">{radius} km</Typography>
          </Box>
        </Box>

        <Box sx={layoutConfig.controlGroup}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoOptimize}
              onChange={(e) => setAutoOptimize(e.target.checked)}
            />
            <Typography variant="body2">{t('routeOptimizer.autoOptimize')}</Typography>
          </label>
        </Box>

        <Box sx={layoutConfig.controlGroup}>
          <Typography variant="subtitle2" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.palette.text.secondary }}>
            {t('routeOptimizer.actions')}
          </Typography>
          <button
            style={{
              background: theme.palette.primary.main,
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              width: '100%',
              marginBottom: '10px'
            }}
            onClick={loadCustomers}
          >
            📥 {t('routeOptimizer.loadCustomers')}
          </button>
          <button
            style={{
              background: theme.palette.success.main,
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              width: '100%',
              marginBottom: '10px'
            }}
            onClick={optimizeRoute}
            disabled={!origin || selectedCount === 0}
          >
            🚀 {t('routeOptimizer.optimizeRoute')}
          </button>

          <Button
            variant="contained"
            startIcon={<PictureAsPdf />}
            onClick={exportToPDF}
            disabled={!route || !origin || loading}
            sx={{
              width: '100%',
              mb: 1.25,
              backgroundColor: '#d32f2f',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '14px',
              boxShadow: '0 3px 6px rgba(0,0,0,0.2)',
              '&:hover': {
                backgroundColor: '#b71c1c',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                transform: 'translateY(-1px)'
              },
              '&:disabled': {
                backgroundColor: theme.palette.grey[400],
                color: theme.palette.grey[600],
                boxShadow: 'none'
              }
            }}
            title={
              !origin ? "Primeiro defina uma origem (CEP)" :
              !route ? "Primeiro otimize uma rota" :
              loading ? "Gerando relatório..." :
              "Exportar rota como PDF"
            }
          >
            📄 {t('routeOptimizer.exportPDF')}
          </Button>

          {/* Help text for disabled PDF button */}
          {(!route || !origin) && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'block',
                mb: 1,
                fontSize: '11px',
                fontStyle: 'italic',
                textAlign: 'center'
              }}
            >
              💡 Para exportar PDF: {!origin ? "1) Defina origem" : "✓ Origem OK"} → {!route ? "2) Otimize rota" : "✓ Rota OK"}
            </Typography>
          )}
          <button
            style={{
              background: theme.palette.error.main,
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              width: '100%',
              marginBottom: '10px'
            }}
            onClick={clearAll}
          >
            🗑️ {t('routeOptimizer.clearAll')}
          </button>
        </Box>

        <Paper sx={{ p: 2, backgroundColor: theme.palette.grey[50] }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" fontWeight="bold">{t('routeOptimizer.totalCustomers')}:</Typography>
            <Typography variant="body2">{stats.total}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" fontWeight="bold">{t('routeOptimizer.geocoded')}:</Typography>
            <Typography variant="body2">{stats.geocoded}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" fontWeight="bold">{t('routeOptimizer.customersInRadius')}:</Typography>
            <Typography variant="body2">{filteredCustomers.length}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="body2" fontWeight="bold">{t('routeOptimizer.selected')}:</Typography>
            <Typography variant="body2">{selectedCount}</Typography>
          </Box>
        </Paper>

        {selectedCount > 0 && (
          <Box sx={layoutConfig.controlGroup}>
            <Typography variant="subtitle2" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: '0.5px', color: theme.palette.text.secondary }}>
              {t('routeOptimizer.selectedCustomers')} ({selectedCount})
            </Typography>
            <Typography variant="caption" sx={{ mb: 2, display: 'block', fontStyle: 'italic', color: theme.palette.text.secondary }}>
              💡 Arraste para reordenar a rota
            </Typography>

              <Droppable droppableId="selected-customers">
                {(provided, snapshot) => (
                  <Box
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    sx={{
                      maxHeight: '300px',
                      // Remove overflow properties to prevent conflicts with @hello-pangea/dnd
                      overflow: 'visible',
                      border: `2px ${snapshot.isDraggingOver ? 'dashed' : 'solid'} ${snapshot.isDraggingOver ? theme.palette.primary.main : theme.palette.divider}`,
                      borderRadius: '4px',
                      backgroundColor: snapshot.isDraggingOver ? theme.palette.action.hover : 'transparent',
                      transition: 'all 0.2s ease',
                      padding: '4px'
                    }}
                  >
                    {selectedCustomersOrder.map((customer, index) => (
                      <Draggable
                        key={customer.id}
                        draggableId={`selected-customer-${customer.id}`}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <Box
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            sx={{
                              p: 1,
                              mb: 0.5,
                              borderBottom: `1px solid ${theme.palette.divider}`,
                              backgroundColor: snapshot.isDragging ? theme.palette.primary.light : theme.palette.info.light,
                              display: 'flex',
                              alignItems: 'center',
                              borderRadius: '4px',
                              boxShadow: snapshot.isDragging ? 3 : 1,
                              transform: snapshot.isDragging ? 'rotate(2deg)' : 'none',
                              transition: 'all 0.2s ease',
                              cursor: 'grab',
                              '&:hover': {
                                backgroundColor: snapshot.isDragging ? theme.palette.primary.light : theme.palette.action.hover
                              },
                              '&:last-child': { borderBottom: 'none' }
                            }}
                          >
                            <Box
                              {...provided.dragHandleProps}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                color: theme.palette.primary.main,
                                cursor: 'grab',
                                mr: 1,
                                '&:active': {
                                  cursor: 'grabbing'
                                }
                              }}
                            >
                              <DragIndicator sx={{ fontSize: 16 }} />
                            </Box>

                            <Box sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: theme.palette.primary.main,
                              color: 'white',
                              borderRadius: '50%',
                              width: 24,
                              height: 24,
                              fontSize: '10px',
                              fontWeight: 'bold',
                              mr: 1,
                              minWidth: 24
                            }}>
                              {index + 1}
                            </Box>

                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" fontWeight="bold" sx={{ fontSize: '12px' }}>
                                {customer.name}
                              </Typography>
                              <Typography variant="caption" color="textSecondary" sx={{ fontSize: '10px' }}>
                                {customer.street_address}, {customer.city}
                              </Typography>
                            </Box>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeCustomerSelection(customer.id);
                              }}
                              style={{
                                background: theme.palette.error.main,
                                color: 'white',
                                border: 'none',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: '8px',
                                flexShrink: 0
                              }}
                              title={t('routeOptimizer.removeFromSelection')}
                            >
                              ×
                            </button>
                          </Box>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
          </Box>
        )}
      </Paper>

      <Box sx={layoutConfig.mainContent}>

        {/* Map View */}
        <Box sx={layoutConfig.mapContainer}>
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution='© OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapController center={mapCenter} zoom={mapZoom} />
          
          {origin && (
            <>
              <Marker 
                position={[origin.lat, origin.lng]} 
                icon={originIcon}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    console.log('New origin position:', position);
                    setOrigin({
                      ...origin,
                      lat: position.lat,
                      lng: position.lng,
                      address: `Posição ajustada manualmente (${position.lat.toFixed(6)}, ${position.lng.toFixed(6)})`
                    });
                    setMapCenter([position.lat, position.lng]);
                    toast.info(t('route.originUpdated'));
                  }
                }}
              >
                <Popup>
                  <strong>{t('route.origin')}</strong><br />
                  {origin.address}<br />
                  <em style={{ fontSize: '11px', color: '#666' }}>
                    {t('route.dragToAdjust')}
                  </em>
                </Popup>
              </Marker>
              <Circle
                center={[origin.lat, origin.lng]}
                radius={kmToMeters(radius)}
                fillColor="#007bff"
                fillOpacity={0.1}
                color="#007bff"
                weight={2}
              />
            </>
          )}
          
          {(() => {
            // Group customers by coordinates to detect overlapping markers
            const coordinateGroups = {};
            
            filteredCustomers.forEach((customer) => {
              const coordKey = `${customer.latitude.toFixed(6)}_${customer.longitude.toFixed(6)}`;
              if (!coordinateGroups[coordKey]) {
                coordinateGroups[coordKey] = [];
              }
              coordinateGroups[coordKey].push(customer);
            });
            
            // Create markers with slight offset for overlapping ones
            const markers = [];
            
            Object.entries(coordinateGroups).forEach(([coordKey, customers]) => {
              customers.forEach((customer, index) => {
                const isSelected = selectedCustomers.has(customer.id);
                
                // Add small offset for overlapping markers (0.0001 degrees ≈ 11 meters)
                const offsetLat = customers.length > 1 ? (index * 0.0001) : 0;
                const offsetLng = customers.length > 1 ? (index * 0.0001) : 0;
                
                const position = [
                  customer.latitude + offsetLat,
                  customer.longitude + offsetLng
                ];
                
                // Create custom icon for overlapping markers
                let markerIcon = isSelected ? selectedIcon : customerIcon;
                
                if (customers.length > 1) {
                  // Create a custom icon with count badge for overlapping markers
                  markerIcon = new L.DivIcon({
                    html: `
                      <div style="position: relative;">
                        <img src="${isSelected ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png' : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png'}" 
                             style="width: 25px; height: 41px;" />
                        ${index === 0 ? `<div style="
                          position: absolute;
                          top: -8px;
                          right: -8px;
                          background: #dc3545;
                          color: white;
                          border-radius: 50%;
                          width: 20px;
                          height: 20px;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          font-size: 11px;
                          font-weight: bold;
                          border: 2px solid white;
                          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        ">${customers.length}</div>` : ''}
                      </div>
                    `,
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    className: customers.length > 1 ? 'overlapping-marker' : ''
                  });
                }
                
                markers.push(
                  <Marker
                    key={`${customer.id}_${index}`}
                    position={position}
                    icon={markerIcon}
                    eventHandlers={{
                      click: () => selectAllAtCoordinates(customer.latitude, customer.longitude)
                    }}
                  >
                    <Popup>
                      <strong>{customer.name}</strong><br />
                      {customer.street_address || 'Sem endereço'}<br />
                      {customer.city || ''} - {customer.cep || ''}<br />
                      {customers.length > 1 && (
                        <div style={{
                          background: '#fff3cd',
                          padding: '5px',
                          borderRadius: '3px',
                          margin: '5px 0',
                          fontSize: '11px'
                        }}>
                          ⚠️ {customers.length} {t('messages.multipleCustomersLocation')}<br/>
                          {t('messages.customerNumber')} #{index + 1} {t('messages.of')} {customers.length}
                        </div>
                      )}
                      <button
                        onClick={() => toggleCustomerSelection(customer.id)}
                        style={{
                          background: isSelected ? '#dc3545' : '#28a745',
                          color: 'white',
                          border: 'none',
                          padding: '5px 10px',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          marginTop: '5px'
                        }}
                      >
                        {isSelected ? `✓ ${t('buttons.selected')} (${t('buttons.remove')})` : t('buttons.select')}
                      </button>
                    </Popup>
                  </Marker>
                );
              });
            });
            
            return markers;
          })()}
          
          {/* Test Polyline (for debugging) */}

          {/* Route Polyline Rendering - Simplified and Robust */}
          {route && route.waypoints && route.waypoints.length > 1 && (() => {
            console.log('🗺️ POLYLINE RENDER - Simplified Logic:', {
              hasRoute: !!route,
              waypointsCount: route.waypoints?.length,
              hasRealRoute: !!route.realRoute,
              hasDecodedPath: !!route.realRoute?.decodedPath,
              decodedPathLength: route.realRoute?.decodedPath?.length
            });

            return (
              <>
                {/* DEBUG: Test polyline to verify rendering works */}
                {process.env.NODE_ENV === 'development' && (() => {
                  console.log('🗺️ Rendering DEBUG green test polyline');
                  return null; // Debug polyline removida
                })()}

                {/* Primary Route: Real route polyline (Google/OpenRoute roads) */}
                {route.realRoute && route.realRoute.decodedPath && route.realRoute.decodedPath.length > 1 && (() => {
                  console.log('🗺️ Rendering REAL ROUTE red polyline with', route.realRoute.decodedPath.length, 'points');
                  console.log('🗺️ First 3 coords:', route.realRoute.decodedPath.slice(0, 3));
                  return (
                    <Polyline
                      positions={route.realRoute.decodedPath.map(p => [p.lat, p.lng])}
                      color="#FF0000"
                      weight={12}
                      opacity={1.0}
                    />
                  );
                })()}

              </>
            );
          })()}
        </MapContainer>

        {/* Debug Info for Polyline (only in development) */}
        {process.env.NODE_ENV === 'development' && route && (
          <Paper
            elevation={4}
            sx={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              p: 2,
              zIndex: 1000,
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              maxWidth: '300px',
              fontSize: '11px'
            }}
          >
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'orange', fontSize: '12px' }}>
              🐛 Debug: Polyline Status
            </Typography>

            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: route.realRoute ? 'green' : 'red' }}>
              ✓ Real Route: {route.realRoute ? 'Available' : 'Not Available'}
            </Typography>

            {route.realRoute && (
              <>
                <Typography variant="caption" sx={{ display: 'block', color: 'blue' }}>
                  📍 Decoded Points: {route.realRoute.decodedPath ? route.realRoute.decodedPath.length : 0}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: 'blue' }}>
                  🛣️ Distance: {route.realRoute.distance?.text || 'N/A'}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: 'blue' }}>
                  ⏱️ Duration: {route.realRoute.duration?.text || 'N/A'}
                </Typography>
              </>
            )}

            <Typography variant="caption" sx={{ display: 'block', color: 'purple' }}>
              📌 Waypoints: {route.waypoints ? route.waypoints.length : 0}
            </Typography>

            <Typography variant="caption" sx={{ display: 'block', mt: 1, fontSize: '10px', fontStyle: 'italic' }}>
              Expected: {route.realRoute?.decodedPath?.length > 1 ? 'Red polyline (real route)' : 'Blue dashed polyline (waypoints)'} + Green test line
            </Typography>

            <Typography variant="caption" sx={{ display: 'block', mt: 1, fontSize: '10px', fontWeight: 'bold', color: route.realRoute?.decodedPath?.length > 1 ? 'green' : 'orange' }}>
              Status: {route.realRoute?.decodedPath?.length > 1 ? '✅ Real polyline should render' : '⚠️ Fallback polyline should render'}
            </Typography>
          </Paper>
        )}

        {/* Legend */}
        <Paper
          elevation={4}
          sx={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            p: 2,
            zIndex: 1000,
            minWidth: '150px'
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
            {t('legend.title')}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#dc3545' }} />
              <Typography variant="caption">{t('legend.origin')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#007bff' }} />
              <Typography variant="caption">{t('legend.customer')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: '#28a745' }} />
              <Typography variant="caption">{t('legend.selectedCustomer')}</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: 'rgba(0,123,255,0.2)' }} />
              <Typography variant="caption">{t('legend.coverageArea')}</Typography>
            </Box>
          </Box>
        </Paper>

              {/* Route Information Card */}
              {route && (
                <Box sx={layoutConfig.routeInfoContainer}>
                  <RouteInfoCard
                    route={route}
                    customers={customers}
                    origin={origin}
                    onExportPDF={exportToPDF}
                    loading={loading}
                    onRouteSegmentReorder={handleRouteReorder}
                  />
                </Box>
              )}
        </Box>
      </Box>
    </Box>
    </DragDropContext>
  );
};

export default RouteOptimizer;