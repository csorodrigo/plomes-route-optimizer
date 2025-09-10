import React, { useState, useEffect, useMemo } from 'react';
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
import api from '../services/api';
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
      console.log('MapController: Setting view to', center, 'with zoom', zoom);
      map.flyTo(center, zoom || map.getZoom(), {
        duration: 1.5
      });
    }
  }, [map, center, zoom]);
  
  return null;
};

const RouteOptimizer = () => {
  // State
  const [origin, setOrigin] = useState(null);
  const [originCep, setOriginCep] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomers, setSelectedCustomers] = useState(new Set());
  const [radius, setRadius] = useState(15);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    geocoded: 0,
    filtered: 0
  });
  const [mapCenter, setMapCenter] = useState([-3.7172, -38.5434]); // Fortaleza
  const [mapZoom, setMapZoom] = useState(11);
  const [autoOptimize, setAutoOptimize] = useState(false);

  // Load customers on mount
  useEffect(() => {
    console.log('RouteOptimizer mounted, loading customers...');
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
    console.log('loadCustomers called');
    setLoading(true);
    try {
      console.log('Fetching customers from API...');
      const response = await api.getCustomers();
      console.log('API Response:', response);
      
      const customerList = response.customers || response;
      console.log('Customer list length:', customerList?.length);
      
      // Filtrar clientes - mostrar todos que tenham coordenadas válidas no Brasil
      const geocoded = customerList.filter(c => 
        isValidBrazilCoordinates(c.latitude, c.longitude)
      );
      console.log('Geocoded customers with valid coordinates:', geocoded.length);
      
      // Mostrar apenas clientes com coordenadas válidas
      const customersToShow = geocoded;
      setCustomers(customersToShow);
      setStats(prev => ({
        ...prev,
        total: customerList.length,
        geocoded: geocoded.length
      }));
      
      toast.success(`${geocoded.length} clientes com endereço carregados`);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error(`Erro ao carregar clientes: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const setCepOrigin = async () => {
    const cep = originCep.replace(/\D/g, '');
    if (cep.length !== 8) {
      toast.warning('Digite um CEP válido com 8 dígitos');
      return;
    }

    setLoading(true);
    try {
      const response = await api.geocodeAddress(cep);
      
      if (response.success && response.coordinates) {
        const { lat, lng } = response.coordinates;
        console.log('Coordenadas recebidas:', { lat, lng, address: response.address });
        
        // Define a origem
        setOrigin({ lat, lng, address: response.address || `CEP ${originCep}` });
        
        // Força atualização do centro do mapa com pequeno delay
        setTimeout(() => {
          setMapCenter([lat, lng]);
          setMapZoom(15); // Zoom mais próximo para ver melhor o pin
        }, 100);
        
        toast.success(`Origem definida: ${response.address}`);
      } else {
        toast.error('CEP não encontrado');
      }
    } catch (error) {
      toast.error('Erro ao buscar CEP');
    } finally {
      setLoading(false);
    }
  };

  const toggleCustomerSelection = (customerId) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const selectAllAtCoordinates = (lat, lng) => {
    // Find all customers at the same coordinates (with tolerance for floating point comparison)
    const tolerance = 0.000001;
    const customersAtLocation = filteredCustomers.filter(customer => 
      Math.abs(customer.latitude - lat) < tolerance && 
      Math.abs(customer.longitude - lng) < tolerance
    );
    
    const newSelected = new Set(selectedCustomers);
    
    // If any customer at this location is not selected, select all of them
    // If all are selected, deselect all of them
    const allSelected = customersAtLocation.every(c => newSelected.has(c.id));
    
    customersAtLocation.forEach(customer => {
      if (allSelected) {
        newSelected.delete(customer.id);
      } else {
        newSelected.add(customer.id);
      }
    });
    
    setSelectedCustomers(newSelected);
  };

  const removeCustomerSelection = (customerId) => {
    const newSelected = new Set(selectedCustomers);
    newSelected.delete(customerId);
    setSelectedCustomers(newSelected);
  };


  // Remove local calculateDistance function - using centralized utility

  const optimizeRoute = async () => {
    if (!origin || selectedCustomers.size === 0) {
      toast.warning('Defina a origem e selecione clientes');
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
        useRealRoutes: true 
      });
      
      // Debug log to verify route data
      console.log('Route optimization response:', {
        hasRealRoute: !!response.data?.realRoute,
        realRouteLength: response.data?.realRoute?.decodedPath?.length || 0,
        waypointsCount: response.data?.waypoints?.length || 0
      });
      
      if (response.success) {
        const { route } = response;
        setRoute(route);
        toast.success(`Rota otimizada e salva! ${route.totalDistance.toFixed(1)}km, ~${route.estimatedTime}min`);
      } else {
        // Fallback para otimização local
        const optimized = nearestNeighbor(origin, waypoints);
        const totalDistance = calculateTotalDistance(optimized);
        const estimatedTime = Math.round((totalDistance / 40) * 60);
        
        setRoute({
          waypoints: optimized,
          totalDistance,
          estimatedTime
        });
        
        toast.success(`Rota otimizada! ${totalDistance.toFixed(1)}km, ~${estimatedTime}min`);
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
        
        setRoute({
          waypoints: optimized,
          totalDistance,
          estimatedTime
        });
        
        toast.warning('Rota otimizada localmente (não foi salva no servidor)');
      } catch (localError) {
        toast.error('Erro ao otimizar rota');
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

    route.push({...start, name: 'Origem'});
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

  const clearAll = () => {
    setOrigin(null);
    setOriginCep('');
    setSelectedCustomers(new Set());
    setRoute(null);
    setRadius(50);
  };

  // Memoize filteredCustomers to ensure consistent calculation across renders
  const filteredCustomers = useMemo(() => {
    console.log('🧠 MEMOIZED getFilteredCustomers called - calculating filteredCustomers');
    console.log('Dependencies:', { 
      customersLength: customers.length, 
      hasOrigin: !!origin, 
      originCoords: origin ? [origin.lat, origin.lng] : null,
      radius 
    });
    
    // Target customer IDs from the issue report
    const targetIds = [401245772, 401246251, 401595195, 401706728, 401796739, 401806396, 401806494, 405232257, 408232925, 421569703, 1200272113];
    
    // Directly calculate here instead of calling getFilteredCustomers to avoid dependency issues
    if (!origin || customers.length === 0) {
      console.log('No origin or no customers, returning all customers');
      return customers;
    }
    
    // Use the centralized filter function
    const filtered = filterCustomersInRadius(customers, origin, radius);
    
    console.log('🧠 MEMOIZED result:', filtered.length, 'customers filtered from', customers.length, 'total');
    console.log('🧠 MEMOIZED filtered customer IDs:', filtered.map(c => c.id));
    
    // Focus on the specific target IDs
    console.log('🎯 TARGET IDS ANALYSIS:');
    targetIds.forEach(targetId => {
      const customer = customers.find(c => c.id === targetId);
      if (customer) {
        const distance = calculateDistance(
          origin.lat, origin.lng,
          customer.latitude, customer.longitude
        );
        const isFiltered = filtered.some(c => c.id === targetId);
        console.log(`  ID ${targetId}: ${customer.name}`);
        console.log(`    Coordinates: ${customer.latitude}, ${customer.longitude}`);
        console.log(`    Distance: ${distance.toFixed(2)}km`);
        console.log(`    Within radius (${radius}km): ${distance <= radius ? 'YES' : 'NO'}`);
        console.log(`    In filtered array: ${isFiltered ? 'YES' : 'NO'}`);
        console.log(`    Address: ${customer.street_address || 'N/A'}, ${customer.city || 'N/A'}`);
        console.log('    ---');
      } else {
        console.log(`  ID ${targetId}: NOT FOUND in customer list`);
      }
    });
    
    // Extra validation to ensure consistency
    filtered.forEach((customer, index) => {
      const distance = calculateDistance(
        origin.lat, origin.lng,
        customer.latitude, customer.longitude
      );
      if (index < 3 || distance > radius - 0.1) {
        console.log(`Customer ${customer.id}: ${customer.name} - Distance: ${distance.toFixed(2)}km (${distance <= radius ? 'INSIDE' : 'OUTSIDE'})`);
      }
    });
    
    return filtered;
  }, [customers, origin, radius]); // Dependencies: recalculate when any of these change
  
  const selectedCount = selectedCustomers.size;
  
  // Update filtered count in stats
  useEffect(() => {
    setStats(prev => ({ ...prev, filtered: filteredCustomers.length }));
  }, [filteredCustomers.length]);

  // Styles
  const styles = {
    container: {
      display: 'flex',
      height: 'calc(100vh - 64px)', // Account for header
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#f5f5f5',
      flexDirection: window.innerWidth < 768 ? 'column' : 'row'
    },
    controls: {
      width: window.innerWidth < 768 ? '100%' : '350px',
      height: window.innerWidth < 768 ? 'auto' : '100%',
      maxHeight: window.innerWidth < 768 ? '300px' : '100%',
      background: 'white',
      boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
      padding: '20px',
      overflowY: 'auto',
      zIndex: 1000,
      position: 'relative'
    },
    mapContainer: {
      flex: 1,
      position: 'relative',
      minHeight: window.innerWidth < 768 ? '400px' : 'auto'
    },
    controlGroup: {
      marginBottom: '20px',
      paddingBottom: '20px',
      borderBottom: '1px solid #eee'
    },
    h2: {
      color: '#333',
      marginBottom: '20px',
      fontSize: '20px',
      margin: '0 0 20px 0'
    },
    h3: {
      color: '#666',
      fontSize: '14px',
      marginBottom: '10px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      margin: '0 0 10px 0'
    },
    input: {
      width: '100%',
      padding: '10px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '14px',
      boxSizing: 'border-box'
    },
    button: {
      background: '#007bff',
      color: 'white',
      border: 'none',
      padding: '10px 20px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      width: '100%',
      marginBottom: '10px'
    },
    buttonSecondary: {
      background: '#6c757d'
    },
    buttonSuccess: {
      background: '#28a745'
    },
    buttonDanger: {
      background: '#dc3545'
    },
    infoBox: {
      background: '#f8f9fa',
      borderRadius: '4px',
      padding: '15px',
      marginTop: '20px'
    },
    infoItem: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '8px',
      fontSize: '14px'
    },
    customerList: {
      maxHeight: '300px',
      overflowY: 'auto',
      border: '1px solid #ddd',
      borderRadius: '4px',
      marginTop: '10px'
    },
    customerItem: {
      padding: '10px',
      borderBottom: '1px solid #eee',
      fontSize: '13px',
      cursor: 'pointer'
    },
    legend: {
      position: 'absolute',
      bottom: '20px',
      right: '20px',
      background: 'white',
      padding: '15px',
      borderRadius: '4px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      zIndex: 1000
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '5px',
      fontSize: '12px'
    },
    legendColor: {
      width: '20px',
      height: '20px',
      marginRight: '8px',
      borderRadius: '50%'
    },
    slider: {
      width: '100%',
      margin: '10px 0'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.controls}>
        <h2 style={styles.h2}>🗺️ Otimizador de Rotas - Ploome</h2>
        
        <div style={styles.controlGroup}>
          <h3 style={styles.h3}>Origem</h3>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              style={{ ...styles.input, flex: 1 }}
              placeholder="Digite o CEP (ex: 01310-100)"
              maxLength="9"
              value={originCep}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '');
                if (value.length <= 5) {
                  setOriginCep(value);
                } else {
                  setOriginCep(`${value.slice(0, 5)}-${value.slice(5, 8)}`);
                }
              }}
              onKeyPress={(e) => e.key === 'Enter' && setCepOrigin()}
            />
            <button
              style={{ ...styles.button, width: '60px', marginBottom: 0 }}
              onClick={setCepOrigin}
              disabled={loading}
            >
              📍
            </button>
          </div>
          {origin && (
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              background: '#e3f2fd', 
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              <div style={{ marginBottom: '5px' }}>
                <strong>📍 Posição atual:</strong>
              </div>
              <div style={{ fontFamily: 'monospace', color: '#1976d2' }}>
                Lat: {origin.lat.toFixed(6)}, Lng: {origin.lng.toFixed(6)}
              </div>
              <div style={{ marginTop: '5px', color: '#666', fontStyle: 'italic' }}>
                💡 Dica: Arraste o pin vermelho no mapa para ajustar a posição
              </div>
            </div>
          )}
        </div>
        
        <div style={styles.controlGroup}>
          <h3 style={styles.h3}>Filtro de Distância</h3>
          <input
            type="range"
            style={styles.slider}
            min="1"
            max="30"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
          <div style={styles.infoItem}>
            <strong>Raio:</strong>
            <span>{radius} km</span>
          </div>
        </div>

        <div style={styles.controlGroup}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoOptimize}
              onChange={(e) => setAutoOptimize(e.target.checked)}
            />
            Otimizar automaticamente
          </label>
        </div>
        
        <div style={styles.controlGroup}>
          <h3 style={styles.h3}>Ações</h3>
          <button style={styles.button} onClick={loadCustomers}>
            📥 Carregar Clientes
          </button>
          <button 
            style={{ ...styles.button, ...styles.buttonSuccess }}
            onClick={optimizeRoute}
            disabled={!origin || selectedCount === 0}
          >
            🚀 Otimizar Rota
          </button>
          <button 
            style={{ ...styles.button, ...styles.buttonDanger }}
            onClick={clearAll}
          >
            🗑️ Limpar Tudo
          </button>
        </div>
        
        <div style={styles.infoBox}>
          <div style={styles.infoItem}>
            <strong>Total de Clientes:</strong>
            <span>{stats.total}</span>
          </div>
          <div style={styles.infoItem}>
            <strong>Geocodificados:</strong>
            <span>{stats.geocoded}</span>
          </div>
          <div style={styles.infoItem}>
            <strong>Clientes no Raio:</strong>
            <span>
              {(() => {
                console.log('🔢 === COUNTER DISPLAY ===');
                console.log('filteredCustomers.length for counter:', filteredCustomers.length);
                console.log('filteredCustomers array reference ID:', filteredCustomers);
                console.log('filteredCustomers IDs:', filteredCustomers.map(c => c.id));
                console.log('============================');
                return filteredCustomers.length;
              })()}
            </span>
          </div>
          <div style={styles.infoItem}>
            <strong>Selecionados:</strong>
            <span>{selectedCount}</span>
          </div>
        </div>
        
        {selectedCount > 0 && (
          <div style={styles.controlGroup}>
            <h3 style={styles.h3}>Clientes Selecionados</h3>
            <div style={styles.customerList}>
              {customers.filter(c => selectedCustomers.has(c.id)).map(customer => (
                <div 
                  key={customer.id}
                  style={{ 
                    ...styles.customerItem, 
                    background: '#e3f2fd',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', color: '#333' }}>{customer.name}</div>
                    <div style={{ color: '#666', fontSize: '12px', marginTop: '2px' }}>
                      {customer.street_address}, {customer.city}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCustomerSelection(customer.id);
                    }}
                    style={{
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '20px',
                      height: '20px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: '10px',
                      flexShrink: 0
                    }}
                    title="Remover da seleção"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div style={styles.mapContainer}>
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
                    toast.info('Origem atualizada para a nova posição');
                  }
                }}
              >
                <Popup>
                  <strong>Origem</strong><br />
                  {origin.address}<br />
                  <em style={{ fontSize: '11px', color: '#666' }}>
                    Arraste o pin para ajustar a posição
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
            console.log('🗺️ === MAP MARKER RENDERING ===');
            console.log('filteredCustomers for map rendering:', filteredCustomers.length);
            console.log('filteredCustomers array reference ID:', filteredCustomers);
            console.log('filteredCustomers IDs for map:', filteredCustomers.map(c => c.id));
            
            // Group customers by coordinates to detect overlapping markers
            const coordinateGroups = {};
            const overlappingMarkers = [];
            const targetIds = [401245772, 401246251, 401595195, 401706728, 401796739, 401806396, 401806494, 405232257, 408232925, 421569703, 1200272113];
            
            console.log('📍 PROCESSING CUSTOMERS FOR MARKERS:');
            filteredCustomers.forEach((customer, index) => {
              console.log(`  ${index + 1}. ID ${customer.id} - ${customer.name} (${customer.latitude}, ${customer.longitude})`);
              
              if (targetIds.includes(customer.id)) {
                console.log(`    ⭐ This is one of our TARGET IDs!`);
              }
              
              const coordKey = `${customer.latitude.toFixed(6)}_${customer.longitude.toFixed(6)}`;
              if (!coordinateGroups[coordKey]) {
                coordinateGroups[coordKey] = [];
              }
              coordinateGroups[coordKey].push(customer);
            });
            
            // Log coordinate analysis
            Object.entries(coordinateGroups).forEach(([coordKey, customers]) => {
              const [lat, lng] = coordKey.split('_');
              console.log(`📍 Coordinate ${lat}, ${lng}: ${customers.length} customer(s)`);
              customers.forEach((customer, index) => {
                console.log(`  ${index + 1}. ID ${customer.id} - ${customer.name} (${customer.street_address || 'No address'})`);
              });
              
              if (customers.length > 1) {
                overlappingMarkers.push({ coordinate: coordKey, customers });
                console.log(`⚠️  OVERLAPPING MARKERS DETECTED at ${lat}, ${lng} - ${customers.length} customers share the same coordinates`);
              }
            });
            
            console.log(`📊 SUMMARY: ${Object.keys(coordinateGroups).length} unique coordinates, ${overlappingMarkers.length} locations have overlapping markers`);
            console.log('=================================');
            
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
                          ⚠️ {customers.length} clientes compartilham esta localização<br/>
                          Cliente #{index + 1} de {customers.length}
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
                        {isSelected ? '✓ Selecionado (Remover)' : 'Selecionar'}
                      </button>
                    </Popup>
                  </Marker>
                );
              });
            });
            
            console.log(`🗺️ RENDERED ${markers.length} markers on map`);
            return markers;
          })()}
          
          {route && route.waypoints.length > 0 && (
            <Polyline
              positions={
                route.realRoute && route.realRoute.decodedPath && route.realRoute.decodedPath.length > 0
                  ? route.realRoute.decodedPath.map(p => [p.lat, p.lng])
                  : route.waypoints.map(w => [w.lat, w.lng])
              }
              color="#007bff"
              weight={4}
              opacity={0.7}
            />
          )}
        </MapContainer>
        
        <div style={styles.legend}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Legenda</h4>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendColor, background: '#dc3545' }}></div>
            <span>Origem</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendColor, background: '#007bff' }}></div>
            <span>Cliente</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendColor, background: '#28a745' }}></div>
            <span>Cliente Selecionado</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendColor, background: 'rgba(0,123,255,0.2)' }}></div>
            <span>Área de Cobertura</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteOptimizer;