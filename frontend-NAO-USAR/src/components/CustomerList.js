import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Toolbar,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider
} from '@mui/material';
import {
  Search,
  FileDownload,
  MyLocation,
  Refresh,
  ViewList,
  Route,
  DragIndicator,
  Person,
  LocationOn,
  Home,
  LocationCity
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'react-toastify';
import { useTranslation } from '../utils/translations';
import apiService from '../services/api';

/**
 * CustomerList Component
 *
 * Displays customers in table or route order mode with:
 * - Search and filtering capabilities
 * - Pagination for large datasets
 * - Drag and drop reordering in route mode
 * - Export to CSV functionality
 * - Geocoding initiation
 * - Real-time search and status updates
 *
 * @component
 */
const CustomerList = () => {
  const { t } = useTranslation();

  // State management
  const [customers, setCustomers] = useState([]);
  const [routeCustomers, setRouteCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isRouteMode, setIsRouteMode] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [geocodingProgress, setGeocodingProgress] = useState(null);

  // Load customers on component mount
  useEffect(() => {
    loadCustomers();
    loadRouteOrder();
  }, []);

  // Filter customers based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCustomers(customers);
    } else {
      const filtered = customers.filter(customer =>
        customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.cep?.includes(searchTerm) ||
        customer.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.state?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
    }
    setPage(0); // Reset to first page when filtering
  }, [searchTerm, customers]);

  /**
   * Load customers from API
   */
  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getCustomers();
      console.log('CustomerList.js - API response:', response);

      // CRITICAL FIX: Handle different response formats and ensure array
      let customersData = [];
      const data = response.data || response;

      if (data && data.customers && Array.isArray(data.customers)) {
        customersData = data.customers;
      } else if (data && Array.isArray(data)) {
        customersData = data;
      } else if (data && data.data && Array.isArray(data.data)) {
        customersData = data.data;
      } else {
        console.warn('CustomerList.js - Unexpected response format:', response);
        customersData = [];
      }

      // Ensure we always have an array to prevent "t.filter is not a function" errors
      setCustomers(Array.isArray(customersData) ? customersData : []);
      setFilteredCustomers(Array.isArray(customersData) ? customersData : []);

      toast.success(`${customersData.length} ${t('customerList.customers')} ${t('messages.customersLoadedAll')}`);
    } catch (err) {
      const errorMessage = err.message || t('messages.errorLoadingCustomers');
      setError(errorMessage);
      toast.error(errorMessage);
      // Ensure empty arrays on error
      setCustomers([]);
      setFilteredCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  /**
   * Load route order if exists
   */
  const loadRouteOrder = useCallback(async () => {
    try {
      // Try to get saved route order from localStorage or API
      const savedRoute = localStorage.getItem('optimizedRoute');
      if (savedRoute) {
        const routeData = JSON.parse(savedRoute);
        if (routeData.waypoints && Array.isArray(routeData.waypoints)) {
          setRouteCustomers(routeData.waypoints);
        }
      }
    } catch (err) {
      console.warn('Could not load route order:', err);
    }
  }, []);

  /**
   * Handle search input change with debouncing
   */
  const handleSearchChange = useCallback((event) => {
    setSearchTerm(event.target.value);
  }, []);

  /**
   * Handle mode toggle between normal table and route order
   */
  const handleModeToggle = useCallback((event) => {
    setIsRouteMode(event.target.checked);
    if (event.target.checked && routeCustomers.length === 0) {
      toast.info(t('customerList.noRouteFound'));
    }
  }, [routeCustomers.length, t]);

  /**
   * Handle pagination change
   */
  const handleChangePage = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  /**
   * Export customers to CSV
   */
  const exportToCSV = useCallback(() => {
    try {
      const dataToExport = isRouteMode ? routeCustomers : filteredCustomers;

      if (dataToExport.length === 0) {
        toast.warning(t('customerList.noCustomersFound'));
        return;
      }

      const headers = [
        t('customerList.name'),
        t('customerList.cep'),
        t('customerList.address'),
        t('customerList.city'),
        t('customerList.state'),
        t('customerList.status')
      ];

      const csvContent = [
        headers.join(','),
        ...dataToExport.map(customer => [
          `"${customer.name || t('customerList.noName')}"`,
          `"${customer.cep || ''}"`,
          `"${customer.address || t('customerList.noAddress')}"`,
          `"${customer.city || ''}"`,
          `"${customer.state || ''}"`,
          `"${customer.latitude && customer.longitude ? t('customerList.geocoded') : t('customerList.pending')}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `clientes_${isRouteMode ? 'rota_' : ''}${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(t('customerList.exportCSV') + ' - Sucesso!');
    } catch (err) {
      toast.error('Erro ao exportar CSV: ' + err.message);
    }
  }, [isRouteMode, routeCustomers, filteredCustomers, t]);

  /**
   * Start geocoding process
   */
  const startGeocoding = useCallback(async () => {
    try {
      setLoading(true);
      await apiService.startGeocoding();
      toast.success(t('messages.geocodingStarted'));

      // Reload customers after geocoding starts
      setTimeout(() => {
        loadCustomers();
      }, 2000);

    } catch (err) {
      toast.error(t('messages.errorStartingGeocoding') + ': ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [t, loadCustomers]);

  /**
   * Handle drag end for route reordering
   */
  const handleDragEnd = useCallback((result) => {
    if (!result.destination) return;

    const items = Array.from(routeCustomers);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setRouteCustomers(items);

    // Save to localStorage
    try {
      const savedRoute = localStorage.getItem('optimizedRoute');
      if (savedRoute) {
        const routeData = JSON.parse(savedRoute);
        routeData.waypoints = items;
        localStorage.setItem('optimizedRoute', JSON.stringify(routeData));
      }
      toast.success(t('customerList.routeOrderUpdated'));
    } catch (err) {
      console.error('Error saving route order:', err);
    }
  }, [routeCustomers, t]);

  /**
   * Get status chip component
   */
  const getStatusChip = useCallback((customer) => {
    const isGeocoded = customer.latitude && customer.longitude;
    return (
      <Chip
        label={isGeocoded ? t('customerList.geocoded') : t('customerList.pending')}
        color={isGeocoded ? 'success' : 'warning'}
        size="small"
        icon={isGeocoded ? <LocationOn /> : <LocationCity />}
      />
    );
  }, [t]);

  /**
   * Render normal table view
   */
  const renderTableView = () => {
    const paginatedCustomers = filteredCustomers.slice(
      page * rowsPerPage,
      page * rowsPerPage + rowsPerPage
    );

    return (
      <TableContainer component={Paper} elevation={2}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>{t('customerList.name')}</TableCell>
              <TableCell>{t('customerList.cep')}</TableCell>
              <TableCell>{t('customerList.address')}</TableCell>
              <TableCell>{t('customerList.city')}</TableCell>
              <TableCell>{t('customerList.state')}</TableCell>
              <TableCell align="center">{t('customerList.status')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedCustomers.map((customer, index) => (
              <TableRow key={customer.id || index} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person color="action" fontSize="small" />
                    <Typography variant="body2" fontWeight="medium">
                      {customer.name || t('customerList.noName')}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell>{customer.cep || '-'}</TableCell>
                <TableCell>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                    {customer.address || t('customerList.noAddress')}
                  </Typography>
                </TableCell>
                <TableCell>{customer.city || '-'}</TableCell>
                <TableCell>{customer.state || '-'}</TableCell>
                <TableCell align="center">
                  {getStatusChip(customer)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={filteredCustomers.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage={t('customerList.rowsPerPage')}
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} de ${count !== -1 ? count : `mais de ${to}`}`
          }
        />
      </TableContainer>
    );
  };

  /**
   * Render route order view with drag and drop
   */
  const renderRouteView = () => {
    if (routeCustomers.length === 0) {
      return (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Route sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {t('customerList.noRouteFound')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use o otimizador de rotas para criar uma rota primeiro.
            </Typography>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Route color="primary" />
            {t('customerList.routeOrderTitle')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('customerList.dragToReorder')}
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="route-customers">
              {(provided, snapshot) => (
                <Box
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  sx={{
                    backgroundColor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                    borderRadius: 1,
                    p: snapshot.isDraggingOver ? 1 : 0,
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  {routeCustomers.map((customer, index) => (
                    <Draggable
                      key={customer.id || `route-${index}`}
                      draggableId={customer.id?.toString() || `route-${index}`}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <Card
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          sx={{
                            mb: 1,
                            backgroundColor: snapshot.isDragging ? 'primary.light' : 'background.paper',
                            transform: snapshot.isDragging ? 'rotate(2deg)' : 'none',
                            boxShadow: snapshot.isDragging ? 4 : 1,
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              boxShadow: 2
                            }
                          }}
                        >
                          <CardContent sx={{ py: 2 }}>
                            <Grid container alignItems="center" spacing={2}>
                              <Grid item>
                                <Box
                                  {...provided.dragHandleProps}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'grab',
                                    '&:active': { cursor: 'grabbing' }
                                  }}
                                >
                                  <DragIndicator color="action" />
                                </Box>
                              </Grid>
                              <Grid item>
                                <Chip
                                  label={index + 1}
                                  color="primary"
                                  size="small"
                                  sx={{ fontWeight: 'bold' }}
                                />
                              </Grid>
                              <Grid item xs>
                                <Typography variant="body1" fontWeight="medium">
                                  {customer.name || t('customerList.noName')}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {customer.address || t('customerList.noAddress')}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {customer.city ? `${customer.city} - ${customer.state}` : ''} | {customer.cep}
                                </Typography>
                              </Grid>
                              <Grid item>
                                {getStatusChip(customer)}
                              </Grid>
                            </Grid>
                          </CardContent>
                        </Card>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </Box>
              )}
            </Droppable>
          </DragDropContext>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ViewList color="primary" />
        {t('customerList.title')}
      </Typography>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Toolbar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Toolbar disableGutters sx={{ gap: 2, flexWrap: 'wrap' }}>
          {/* Mode Toggle */}
          <FormControlLabel
            control={
              <Switch
                checked={isRouteMode}
                onChange={handleModeToggle}
                color="primary"
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Route fontSize="small" />
                {t('customerList.routeMode')}
              </Box>
            }
          />

          <Divider orientation="vertical" flexItem />

          {/* Search Field */}
          {!isRouteMode && (
            <TextField
              placeholder={t('customerList.searchPlaceholder')}
              value={searchTerm}
              onChange={handleSearchChange}
              variant="outlined"
              size="small"
              sx={{ minWidth: 300, flex: 1 }}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'action.active' }} />
              }}
            />
          )}

          <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
            {/* Update Button */}
            <Tooltip title={t('customerList.update')}>
              <IconButton
                onClick={loadCustomers}
                disabled={loading}
                color="primary"
              >
                <Refresh />
              </IconButton>
            </Tooltip>

            {/* Export CSV Button */}
            <Tooltip title={t('customerList.exportCSV')}>
              <IconButton
                onClick={exportToCSV}
                disabled={loading || (isRouteMode ? routeCustomers.length === 0 : filteredCustomers.length === 0)}
                color="primary"
              >
                <FileDownload />
              </IconButton>
            </Tooltip>

            {/* Start Geocoding Button */}
            <Tooltip title={t('customerList.startGeocoding')}>
              <IconButton
                onClick={startGeocoding}
                disabled={loading}
                color="primary"
              >
                <MyLocation />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </Paper>

      {/* Stats Summary */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {isRouteMode ? routeCustomers.length : filteredCustomers.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isRouteMode ? 'Clientes na Rota' : 'Total de Clientes'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {customers.filter(c => c.latitude && c.longitude).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('customerList.geocoded')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {customers.filter(c => !c.latitude || !c.longitude).length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('customerList.pending')}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        {searchTerm && !isRouteMode && (
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="info.main">
                  {filteredCustomers.length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Resultado da Busca
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Content */}
      {!loading && (
        isRouteMode ? renderRouteView() : renderTableView()
      )}
    </Box>
  );
};

export default CustomerList;