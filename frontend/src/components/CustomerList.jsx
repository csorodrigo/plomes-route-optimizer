import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Button,
  TextField,
  InputAdornment,
  Alert,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Search as SearchIcon,
  LocationOn as LocationIcon,
  LocationOff as LocationOffIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  MyLocation as MyLocationIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../services/api';

const CustomerList = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState(null);
  const [geocodingProgress, setGeocodingProgress] = useState(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getCustomers();
      const customerList = response.customers || response;
      setCustomers(customerList);
      toast.success(`${customerList.length} clientes carregados`);
    } catch (error) {
      toast.error('Erro ao carregar clientes: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const response = await api.getStatistics();
      const stats = response.statistics || response;
      setStats(stats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  }, []);

  const checkGeocodingProgress = useCallback(async () => {
    try {
      const data = await api.getGeocodingProgress();
      setGeocodingProgress(data);
      
      // Reload if geocoding completed
      if (data.progress && data.progress.current === data.progress.total && data.progress.total > 0) {
        loadCustomers();
        loadStats();
      }
    } catch (error) {
      console.error('Erro ao verificar progresso:', error);
    }
  }, [loadCustomers, loadStats]);

  useEffect(() => {
    loadCustomers();
    loadStats();
    
    // Check geocoding progress every 5 seconds
    const interval = setInterval(() => {
      checkGeocodingProgress();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);


  const startGeocoding = async () => {
    try {
      const data = await api.startGeocoding();
      
      if (data.success) {
        toast.info('Geocodificação iniciada em background');
      }
    } catch (error) {
      toast.error('Erro ao iniciar geocodificação: ' + error.message);
    }
  };

  const exportData = () => {
    const csvContent = [
      ['ID', 'Nome', 'CEP', 'Endereço', 'Cidade', 'Estado', 'Latitude', 'Longitude'].join(','),
      ...customers.map(c => [
        c.id,
        `"${c.name || ''}"`,
        c.cep || '',
        `"${c.street_address || ''}"`,
        `"${c.city || ''}"`,
        c.state || '',
        c.latitude || '',
        c.longitude || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clientes.csv';
    a.click();
  };

  const filteredCustomers = customers.filter(customer => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(search) ||
      customer.cep?.includes(search) ||
      customer.city?.toLowerCase().includes(search) ||
      customer.street_address?.toLowerCase().includes(search)
    );
  });

  const paginatedCustomers = filteredCustomers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h2">
            Lista de Clientes
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadCustomers}
              disabled={loading}
            >
              Atualizar
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={exportData}
            >
              Exportar CSV
            </Button>
            <Button
              variant="contained"
              startIcon={<MyLocationIcon />}
              onClick={startGeocoding}
              disabled={geocodingProgress?.processing}
            >
              Iniciar Geocodificação
            </Button>
          </Box>
        </Box>

        {/* Stats */}
        {stats && (
          <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
            <Chip
              label={`Total: ${stats.totalCustomers}`}
              color="primary"
              icon={<SearchIcon />}
            />
            <Chip
              label={`Geocodificados: ${stats.geocodedCustomers}`}
              color="success"
              icon={<LocationIcon />}
            />
            <Chip
              label={`Pendentes: ${stats.pendingGeocoding}`}
              color="warning"
              icon={<LocationOffIcon />}
            />
            
            {geocodingProgress?.processing && (
              <Chip
                label={`Processando: ${geocodingProgress.progress.current}/${geocodingProgress.progress.total}`}
                color="info"
                icon={<CircularProgress size={16} />}
              />
            )}
          </Box>
        )}

        {/* Search */}
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Buscar por nome, CEP, endereço ou cidade..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
          </Box>
        ) : filteredCustomers.length === 0 ? (
          <Alert severity="info" sx={{ m: 3 }}>
            Nenhum cliente encontrado
          </Alert>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>CEP</TableCell>
                  <TableCell>Endereço</TableCell>
                  <TableCell>Cidade</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="center">Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedCustomers.map((customer) => (
                  <TableRow key={customer.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {customer.name || 'Sem nome'}
                      </Typography>
                    </TableCell>
                    <TableCell>{customer.cep || '-'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {customer.street_address || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{customer.city || '-'}</TableCell>
                    <TableCell>{customer.state || '-'}</TableCell>
                    <TableCell align="center">
                      {customer.latitude && customer.longitude ? (
                        <Tooltip title={`${customer.latitude}, ${customer.longitude}`}>
                          <Chip
                            size="small"
                            label="Geocodificado"
                            color="success"
                            icon={<LocationIcon />}
                          />
                        </Tooltip>
                      ) : (
                        <Chip
                          size="small"
                          label="Pendente"
                          color="default"
                          icon={<LocationOffIcon />}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            <TablePagination
              rowsPerPageOptions={[10, 25, 50, 100]}
              component="div"
              count={filteredCustomers.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(e, newPage) => setPage(newPage)}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              labelRowsPerPage="Linhas por página:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            />
          </>
        )}
      </TableContainer>
    </Box>
  );
};

export default CustomerList;