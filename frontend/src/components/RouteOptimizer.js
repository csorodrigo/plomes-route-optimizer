import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'react-toastify';

import {
  Box,
  Paper,
  Grid,
  Typography,
  TextField,
  Button,
  Slider,
  FormControlLabel,
  Switch,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Tooltip,
  Chip,
  Alert,
  CircularProgress,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Badge,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';

import {
  LocationOn as LocationIcon,
  DirectionsRun as RouteIcon,
  PictureAsPdf as PdfIcon,
  Clear as ClearIcon,
  People as PeopleIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';

import api from '../services/api';
import pdfExportService from '../services/pdfExportService';
import { useTranslation } from '../utils/translations';

// Fix Leaflet default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom marker icons
const originIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDOC4xMyAyIDUgNS4xMyA1IDlDNSAxNC4yNSAxMiAyMiAxMiAyMkMxMiAyMiAxOSAxNC4yNSAxOSA5QzE5IDUuMTMgMTUuODcgMiAxMiAyWk0xMiAxMS41QzEwLjYyIDExLjUgOS41IDEwLjM4IDkuNSA5QzkuNSA3LjYyIDEwLjYyIDYuNSAxMiA2LjVDMTMuMzggNi41IDE0LjUgNy42MiAxNC41IDlDMTQuNSAxMC4zOCAxMy4zOCAxMS41IDEyIDExLjVaIiBmaWxsPSIjZjQ0MzM2Ii8+Cjwvc3ZnPgo=',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const customerIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDOC4xMyAyIDUgNS4xMyA1IDlDNSAxNC4yNSAxMiAyMiAxMiAyMkMxMiAyMiAxOSAxNC4yNSAxOSA5QzE5IDUuMTMgMTUuODcgMiAxMiAyWk0xMiAxMS41QzEwLjYyIDExLjUgOS41IDEwLjM4IDkuNSA5QzkuNSA3LjYyIDEwLjYyIDYuNSAxMiA2LjVDMTMuMzggNi41IDE0LjUgNy42MiAxNC41IDlDMTQuNSAxMC4zOCAxMy4zOCAxMS41IDEyIDExLjVaIiBmaWxsPSIjMjE5NmYzIi8+Cjwvc3ZnPgo=',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24]
});

const selectedCustomerIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJDOC4xMyAyIDUgNS4xMyA1IDlDNSAxNC4yNSAxMiAyMiAxMiAyMkMxMiAyMiAxOSAxNC4yNSAxOSA5QzE5IDUuMTMgMTUuODcgMiAxMiAyWk0xMiAxMS41QzEwLjYyIDExLjUgOS41IDEwLjM4IDkuNSA5QzkuNSA3LjYyIDEwLjYyIDYuNSAxMiA2LjVDMTMuMzggNi41IDE0LjUgNy42MiAxNC41IDlDMTQuNSAxMC4zOCAxMy4zOCAxMS41IDEyIDExLjVaIiBmaWxsPSIjNGNhZjUwIi8+Cjwvc3ZnPgo=',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28]
});

// Draggable marker component
const DraggableMarker = ({ position, onPositionChange, icon, children }) => {
  const markerRef = useRef(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker != null) {
        const newPos = marker.getLatLng();
        onPositionChange(newPos);
      }
    },
  };

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
      icon={icon}
    >
      {children}
    </Marker>
  );
};

// Map click handler
const MapClickHandler = ({ onMapClick }) => {
  useMapEvents({
    click: onMapClick,
  });
  return null;
};

const RouteOptimizer = ({ onRouteOptimized }) => {
  const { t } = useTranslation();

  // State management
  const [origin, setOrigin] = useState(null);
  const [originCep, setOriginCep] = useState('');
  const [originAddress, setOriginAddress] = useState('');
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState([]);
  const [radiusKm, setRadiusKm] = useState(10);
  const [autoOptimize, setAutoOptimize] = useState(false);
  const [loading, setLoading] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState(null);
  const [routeStats, setRouteStats] = useState(null);
  const [mapCenter, setMapCenter] = useState([-3.7319, -38.5267]); // Fortaleza-CE default
  const [zoom, setZoom] = useState(11);
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Load customers on component mount
  useEffect(() => {
    loadCustomers();
  }, []);

  // Filter customers by radius when origin or radius changes
  useEffect(() => {
    if (origin) {
      filterCustomersByRadius();
    }
  }, [origin, radiusKm, customers]);

  // Auto-optimize when customers selection changes
  useEffect(() => {
    if (autoOptimize && selectedCustomers.length > 0 && origin) {
      optimizeRoute();
    }
  }, [selectedCustomers, autoOptimize, origin]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const response = await api.getCustomers();
      const customerData = response.customers || response || [];

      // Filter customers with valid coordinates
      const validCustomers = customerData.filter(customer =>
        customer.latitude && customer.longitude &&
        !isNaN(parseFloat(customer.latitude)) &&
        !isNaN(parseFloat(customer.longitude))
      );

      setCustomers(validCustomers);

      // CRITICAL FIX: Alert user if no customers have coordinates
      if (validCustomers.length === 0 && customerData.length > 0) {
        toast.warning(`${customerData.length} clientes carregados mas nenhum tem coordenadas. Execute a geocodificação primeiro.`);
      } else if (validCustomers.length > 0) {
        toast.success(t('messages.customersLoaded', { count: validCustomers.length }));
      } else {
        toast.error('Nenhum cliente encontrado. Execute a sincronização primeiro.');
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error(t('messages.errorLoadingCustomers'));
    } finally {
      setLoading(false);
    }
  };

  const filterCustomersByRadius = () => {
    if (!origin) {
      setFilteredCustomers([]);
      return;
    }

    const filtered = customers.filter(customer => {
      const distance = calculateDistance(
        origin.lat,
        origin.lng,
        parseFloat(customer.latitude),
        parseFloat(customer.longitude)
      );
      return distance <= radiusKm;
    });

    setFilteredCustomers(filtered);
  };

  const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = deg2rad(lat2 - lat1);
    const dLng = deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI/180);
  };

  const handleCepSearch = async () => {
    if (!originCep || originCep.length !== 8) {
      toast.error(t('messages.invalidCEP'));
      return;
    }

    setLoading(true);
    try {
      const response = await api.getCepInfo(originCep);
      const { lat, lng, address } = response;

      if (lat && lng) {
        // Validate coordinates to prevent NaN errors
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);

        if (isNaN(parsedLat) || isNaN(parsedLng)) {
          console.error('Invalid coordinates received:', { lat, lng });
          toast.error(t('messages.errorSearchingCEP'));
          return;
        }

        const newOrigin = { lat: parsedLat, lng: parsedLng };
        setOrigin(newOrigin);

        // CRITICAL FIX: Handle address object properly to prevent React Error #31
        const formattedAddress = address?.formatted ||
                               (typeof address === 'string' ? address : '') ||
                               `${parsedLat.toFixed(4)}, ${parsedLng.toFixed(4)}`;

        setOriginAddress(formattedAddress);
        setMapCenter([parsedLat, parsedLng]);
        setZoom(14);
        toast.success(t('messages.originSet'));
      } else {
        toast.error(t('messages.cepNotFound'));
      }
    } catch (error) {
      console.error('Error searching CEP:', error);
      toast.error(t('messages.errorSearchingCEP'));
    } finally {
      setLoading(false);
    }
  };


  const handleOriginDrag = (newPosition) => {
    setOrigin(newPosition);
    setOriginAddress(`${newPosition.lat.toFixed(6)}, ${newPosition.lng.toFixed(6)}`);
    toast.info(t('route.originUpdated'));
  };

  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng;
    const clickedCustomer = filteredCustomers.find(customer => {
      const distance = calculateDistance(
        lat, lng,
        parseFloat(customer.latitude),
        parseFloat(customer.longitude)
      );
      return distance < 0.1; // 100m tolerance
    });

    if (clickedCustomer) {
      toggleCustomerSelection(clickedCustomer);
    }
  };

  const toggleCustomerSelection = (customer) => {
    const isSelected = selectedCustomers.some(c => c.id === customer.id);

    if (isSelected) {
      setSelectedCustomers(prev => prev.filter(c => c.id !== customer.id));
    } else {
      setSelectedCustomers(prev => [...prev, customer]);
    }
  };

  const handleDragEnd = (result) => {
    // Early return if no destination or invalid drag
    if (!result.destination || result.destination.index === result.source.index) {
      return;
    }

    // Ensure we have a valid droppableId
    if (result.destination.droppableId !== 'selected-customers') {
      return;
    }

    const items = Array.from(selectedCustomers);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setSelectedCustomers(items);

    // Show feedback to user
    toast.info(t('route.orderUpdated') || 'Ordem da rota atualizada');
  };

  const optimizeRoute = async () => {
    if (!origin || selectedCustomers.length === 0) {
      toast.error(t('messages.defineOriginAndCustomers'));
      return;
    }

    setLoading(true);
    try {
      const waypoints = selectedCustomers.map(customer => ({
        lat: parseFloat(customer.latitude),
        lng: parseFloat(customer.longitude),
        name: customer.name,
        id: customer.id,
        address: customer.address
      }));

      const response = await api.optimizeRoute(origin, waypoints);

      if (response.success && response.route) {
        setOptimizedRoute(response.route);

        // Calculate basic stats
        const stats = {
          totalDistance: response.route.totalDistance || 0,
          estimatedTime: response.route.estimatedTime || 0,
          totalStops: selectedCustomers.length,
          optimizationMethod: 'Proximidade'
        };
        setRouteStats(stats);

        toast.success(t('route.savedSuccessfully'));
        if (onRouteOptimized) onRouteOptimized();
      } else {
        // Fallback to local optimization
        const localRoute = optimizeRouteLocally();
        setOptimizedRoute(localRoute);
        setRouteStats({
          totalDistance: localRoute.totalDistance,
          estimatedTime: localRoute.estimatedTime,
          totalStops: selectedCustomers.length,
          optimizationMethod: 'Local'
        });
        toast.info(t('route.optimizedLocally'));
      }
    } catch (error) {
      console.error('Error optimizing route:', error);

      // Fallback to local optimization
      const localRoute = optimizeRouteLocally();
      setOptimizedRoute(localRoute);
      setRouteStats({
        totalDistance: localRoute.totalDistance,
        estimatedTime: localRoute.estimatedTime,
        totalStops: selectedCustomers.length,
        optimizationMethod: 'Local'
      });
      toast.info(t('route.optimizedLocally'));
    } finally {
      setLoading(false);
    }
  };

  const optimizeRouteLocally = () => {
    // Simple nearest neighbor optimization
    const unvisited = [...selectedCustomers];
    const optimized = [];
    let currentPos = origin;
    let totalDistance = 0;

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      unvisited.forEach((customer, index) => {
        const distance = calculateDistance(
          currentPos.lat,
          currentPos.lng,
          parseFloat(customer.latitude),
          parseFloat(customer.longitude)
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = index;
        }
      });

      const nearestCustomer = unvisited[nearestIndex];
      optimized.push(nearestCustomer);
      totalDistance += nearestDistance;

      currentPos = {
        lat: parseFloat(nearestCustomer.latitude),
        lng: parseFloat(nearestCustomer.longitude)
      };

      unvisited.splice(nearestIndex, 1);
    }

    setSelectedCustomers(optimized);

    return {
      waypoints: [
        origin,
        ...optimized.map(c => ({
          lat: parseFloat(c.latitude),
          lng: parseFloat(c.longitude),
          name: c.name,
          id: c.id
        }))
      ],
      totalDistance,
      estimatedTime: Math.round(totalDistance * 2) // Rough estimate: 2 min per km
    };
  };

  const exportToPdf = async () => {
    if (!optimizedRoute || selectedCustomers.length === 0) {
      toast.error(t('pdf.routeRequired'));
      return;
    }

    setLoading(true);
    try {
      const result = await pdfExportService.generateRouteReport(
        optimizedRoute,
        selectedCustomers,
        { address: originAddress, ...origin }
      );

      if (result.success) {
        toast.success(t('pdf.exportSuccess'));
      } else {
        toast.error(t('pdf.exportError'));
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error(t('pdf.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  const clearAll = () => {
    setOrigin(null);
    setOriginCep('');
    setOriginAddress('');
    setSelectedCustomers([]);
    setOptimizedRoute(null);
    setRouteStats(null);
    setMapCenter([-3.7319, -38.5267]);
    setZoom(10);
    setShowClearDialog(false);
    toast.success('Dados limpos com sucesso');
  };

  const formatCep = (value) => {
    return value.replace(/\D/g, '').slice(0, 8);
  };

  return (
    <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          {t('routeOptimizer.title')}
        </Typography>

        {/* Origin Section */}
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label={t('routeOptimizer.origin')}
              placeholder={t('routeOptimizer.originPlaceholder')}
              value={originCep}
              onChange={(e) => setOriginCep(formatCep(e.target.value))}
              onKeyPress={(e) => e.key === 'Enter' && handleCepSearch()}
              InputProps={{
                endAdornment: (
                  <IconButton onClick={handleCepSearch} disabled={loading}>
                    <SearchIcon />
                  </IconButton>
                )
              }}
            />
          </Grid>


          {origin && (
            <Grid item xs={12} md={8}>
              <Alert severity="info" sx={{ display: 'flex', alignItems: 'center' }}>
                <LocationIcon sx={{ mr: 1 }} />
                <Box>
                  <Typography variant="body2">
                    {originAddress || `${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('routeOptimizer.dragTip')}
                  </Typography>
                </Box>
              </Alert>
            </Grid>
          )}
        </Grid>
      </Paper>

      <Grid container spacing={2} sx={{ flexGrow: 1 }}>
        {/* Left Panel - Controls */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Distance Filter */}
            <Box sx={{ mb: 3 }}>
              <Typography gutterBottom>
                {t('routeOptimizer.distanceFilter')}
              </Typography>
              <Box sx={{ px: 2 }}>
                <Slider
                  value={radiusKm}
                  onChange={(e, value) => setRadiusKm(value)}
                  min={1}
                  max={50}
                  step={1}
                  marks={[
                    { value: 5, label: '5km' },
                    { value: 25, label: '25km' },
                    { value: 50, label: '50km' }
                  ]}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}km`}
                />
              </Box>
            </Box>

            <FormControlLabel
              control={
                <Switch
                  checked={autoOptimize}
                  onChange={(e) => setAutoOptimize(e.target.checked)}
                />
              }
              label={t('routeOptimizer.autoOptimize')}
              sx={{ mb: 2 }}
            />

            {/* Action Buttons */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                {t('routeOptimizer.actions')}
              </Typography>

              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<PeopleIcon />}
                    onClick={loadCustomers}
                    disabled={loading}
                  >
                    {t('routeOptimizer.loadCustomers')}
                  </Button>
                </Grid>

                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<RouteIcon />}
                    onClick={optimizeRoute}
                    disabled={loading || !origin || selectedCustomers.length === 0}
                  >
                    {t('routeOptimizer.optimizeRoute')}
                  </Button>
                </Grid>

                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<PdfIcon />}
                    onClick={exportToPdf}
                    disabled={loading || !optimizedRoute}
                  >
                    {t('routeOptimizer.exportPDF')}
                  </Button>
                </Grid>

                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    startIcon={<ClearIcon />}
                    onClick={() => setShowClearDialog(true)}
                  >
                    {t('routeOptimizer.clearAll')}
                  </Button>
                </Grid>
              </Grid>
            </Box>

            {/* Statistics */}
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="h6" color="primary">
                        {customers.length}
                      </Typography>
                      <Typography variant="caption">
                        {t('routeOptimizer.totalCustomers')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={6}>
                  <Card variant="outlined">
                    <CardContent sx={{ textAlign: 'center', py: 1 }}>
                      <Typography variant="h6" color="secondary">
                        {filteredCustomers.length}
                      </Typography>
                      <Typography variant="caption">
                        {t('routeOptimizer.customersInRadius')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>

            {/* Route Stats */}
            {routeStats && (
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary">
                    {t('route.routeSummary')}
                  </Typography>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      {t('route.totalDistance')}:
                    </Typography>
                    <Chip
                      label={`${routeStats.totalDistance.toFixed(1)} km`}
                      color="primary"
                      size="small"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      {t('route.estimatedTime')}:
                    </Typography>
                    <Chip
                      label={`${routeStats.estimatedTime} min`}
                      color="secondary"
                      size="small"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2">
                      {t('route.stops')}:
                    </Typography>
                    <Chip
                      label={routeStats.totalStops}
                      color="success"
                      size="small"
                    />
                  </Box>
                </CardContent>
              </Card>
            )}

            {/* Selected Customers List */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
              <Typography variant="h6" gutterBottom>
                {t('routeOptimizer.selectedCustomers')}
                <Badge badgeContent={selectedCustomers.length} color="primary" sx={{ ml: 1 }} />
              </Typography>

              <Box sx={{ height: '200px', overflow: 'auto' }}>
                {selectedCustomers.length > 0 ? (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="selected-customers" type="CUSTOMER">
                      {(provided, snapshot) => (
                        <List
                          {...provided.droppableProps}
                          ref={provided.innerRef}
                          dense
                          sx={{
                            backgroundColor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                            minHeight: '50px',
                            borderRadius: 1,
                            transition: 'background-color 0.2s ease'
                          }}
                        >
                          {selectedCustomers.map((customer, index) => (
                            <Draggable
                              key={`customer-${customer.id}`}
                              draggableId={`customer-${customer.id}`}
                              index={index}
                              isDragDisabled={loading}
                            >
                              {(provided, snapshot) => (
                                <ListItem
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  sx={{
                                    border: '1px solid',
                                    borderColor: snapshot.isDragging ? 'primary.main' : 'divider',
                                    borderRadius: 1,
                                    mb: 1,
                                    backgroundColor: snapshot.isDragging ? 'primary.light' : 'background.paper',
                                    transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
                                    transition: 'all 0.2s ease',
                                    boxShadow: snapshot.isDragging ? 3 : 1,
                                    opacity: snapshot.isDragging ? 0.9 : 1
                                  }}
                                >
                                  <ListItemIcon {...provided.dragHandleProps}>
                                    <DragIcon color={loading ? 'disabled' : 'action'} />
                                  </ListItemIcon>

                                  <ListItemText
                                    primary={
                                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Chip
                                          label={index + 1}
                                          size="small"
                                          color="primary"
                                          sx={{ mr: 1, minWidth: 28, height: 20 }}
                                        />
                                        <Typography variant="body2" noWrap>
                                          {customer.name}
                                        </Typography>
                                      </Box>
                                    }
                                    secondary={
                                      <Typography variant="caption" color="text.secondary" noWrap>
                                        {customer.city}
                                      </Typography>
                                    }
                                  />

                                  <ListItemSecondaryAction>
                                    <IconButton
                                      size="small"
                                      onClick={() => toggleCustomerSelection(customer)}
                                      disabled={loading}
                                      color="error"
                                    >
                                      <DeleteIcon />
                                    </IconButton>
                                  </ListItemSecondaryAction>
                                </ListItem>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </List>
                      )}
                    </Droppable>
                  </DragDropContext>
                ) : (
                  <Box
                    sx={{
                      height: '100px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px dashed',
                      borderColor: 'divider',
                      borderRadius: 2,
                      backgroundColor: 'grey.50'
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {t('routeOptimizer.selectCustomersHint') || 'Selecione clientes no mapa ou na lista'}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Right Panel - Map and Customer List */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ height: '100%', overflow: 'hidden' }}>
            <Box sx={{ height: '100%' }}>
              {/* Map View */}
              <MapContainer
                  center={mapCenter}
                  zoom={zoom}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <MapClickHandler onMapClick={handleMapClick} />

                  {/* Origin marker */}
                  {origin && (
                    <DraggableMarker
                      position={origin}
                      onPositionChange={handleOriginDrag}
                      icon={originIcon}
                    >
                      <Popup>
                        <Typography variant="body2">
                          <strong>{t('route.origin')}</strong><br />
                          {originAddress}<br />
                          <em>{t('route.dragToAdjust')}</em>
                        </Typography>
                      </Popup>
                    </DraggableMarker>
                  )}

                  {/* Coverage radius */}
                  {origin && (
                    <Circle
                      center={origin}
                      radius={radiusKm * 1000}
                      pathOptions={{
                        fillColor: '#2196f3',
                        fillOpacity: 0.1,
                        color: '#2196f3',
                        weight: 2
                      }}
                    />
                  )}

                  {/* Customer markers */}
                  {filteredCustomers.map((customer) => {
                    const isSelected = selectedCustomers.some(c => c.id === customer.id);
                    return (
                      <Marker
                        key={customer.id}
                        position={[parseFloat(customer.latitude), parseFloat(customer.longitude)]}
                        icon={isSelected ? selectedCustomerIcon : customerIcon}
                        eventHandlers={{
                          click: () => toggleCustomerSelection(customer)
                        }}
                      >
                        <Popup>
                          <Typography variant="body2">
                            <strong>{customer.name}</strong><br />
                            {customer.address}<br />
                            {customer.city} - {customer.state}<br />
                            <Button
                              size="small"
                              variant={isSelected ? "outlined" : "contained"}
                              onClick={() => toggleCustomerSelection(customer)}
                              sx={{ mt: 1 }}
                            >
                              {isSelected ? t('buttons.selected') : t('buttons.select')}
                            </Button>
                          </Typography>
                        </Popup>
                      </Marker>
                    );
                  })}

                  {/* Route visualization - Linha vermelha sólida e grossa */}
                  {optimizedRoute && optimizedRoute.realRoute && optimizedRoute.realRoute.decodedPath && (
                    <Polyline
                      positions={optimizedRoute.realRoute.decodedPath.map(p => [p.lat, p.lng])}
                      pathOptions={{
                        color: '#FF0000',
                        weight: 6,
                        opacity: 1.0
                      }}
                    />
                  )}
                </MapContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Loading FAB */}
      {loading && (
        <Fab
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1000
          }}
          color="primary"
        >
          <CircularProgress size={24} color="inherit" />
        </Fab>
      )}

      {/* Clear All Dialog */}
      <Dialog open={showClearDialog} onClose={() => setShowClearDialog(false)}>
        <DialogTitle>Confirmar Limpeza</DialogTitle>
        <DialogContent>
          <Typography>
            Tem certeza que deseja limpar todos os dados? Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowClearDialog(false)}>
            {t('buttons.cancel')}
          </Button>
          <Button onClick={clearAll} color="error" variant="contained">
            {t('buttons.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RouteOptimizer;