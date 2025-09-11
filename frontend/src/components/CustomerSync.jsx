import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  Card,
  CardContent,
  Grid,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  TextField,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Sync as SyncIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Person as PersonIcon,
  LocationOn as LocationOnIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../services/api';

const CustomerSync = ({ onSyncComplete }) => {
  const [syncStatus, setSyncStatus] = useState(null);
  const [isSync, setIsSync] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncLogs, setSyncLogs] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [connectionTest, setConnectionTest] = useState(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [syncInterval, setSyncInterval] = useState(60); // minutes
  const [customersStats, setCustomersStats] = useState({
    total: 0,
    geocoded: 0,
    withAddress: 0,
    errors: 0
  });

  useEffect(() => {
    loadSyncStatus();
    testPloomeConnection();
  }, []);

  const loadSyncStatus = useCallback(async () => {
    try {
      const status = await api.getPloomeStatus();
      
      if (status.lastSync) {
        setLastSync(status.lastSync);
      }

      if (status.customers) {
        setCustomersStats(status.customers);
      }
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  }, []);

  const testPloomeConnection = useCallback(async () => {
    setTestingConnection(true);
    try {
      const result = await api.testPloomeConnection();
      setConnectionTest(result);
      
      if (result.success) {
        toast.success('Conexão com Ploomes estabelecida com sucesso');
      } else {
        toast.warning('Problema na conexão com Ploomes');
      }
    } catch (error) {
      setConnectionTest({
        success: false,
        error: error.message
      });
      toast.error('Erro ao testar conexão: ' + error.message);
    } finally {
      setTestingConnection(false);
    }
  }, []);

  const simulateSyncProgress = useCallback((response) => {
    const steps = [
      { progress: 10, message: 'Conectando ao Ploomes...', type: 'info' },
      { progress: 25, message: 'Buscando contatos...', type: 'info' },
      { progress: 45, message: 'Processando dados...', type: 'info' },
      { progress: 65, message: 'Geocodificando endereços...', type: 'info' },
      { progress: 85, message: 'Salvando no banco de dados...', type: 'info' },
      { progress: 100, message: 'Sincronização concluída!', type: 'success' }
    ];

    let currentStep = 0;

    const progressInterval = setInterval(() => {
      if (currentStep < steps.length) {
        const step = steps[currentStep];
        setSyncProgress(step.progress);
        setSyncStatus(step.message);
        setSyncLogs(prev => [...prev, {
          timestamp: new Date(),
          message: step.message,
          type: step.type
        }]);
        currentStep++;
      } else {
        clearInterval(progressInterval);
        handleSyncComplete(response);
      }
    }, 1000);
  }, []);

  const handleSyncError = (error) => {
    setIsSync(false);
    setSyncStatus('Erro na sincronização');
    setSyncLogs(prev => [...prev, {
      timestamp: new Date(),
      message: error.message,
      type: 'error'
    }]);
    toast.error('Erro na sincronização: ' + error.message);
  };

  const handleStartSync = useCallback(async () => {
    setIsSync(true);
    setSyncProgress(0);
    setSyncLogs([]);
    setSyncStatus('Iniciando sincronização...');

    try {
      // Start sync process
      const response = await api.syncCustomers();
      
      if (response.success) {
        // Simulate progress updates (in real implementation, use WebSocket or polling)
        simulateSyncProgress(response);
      } else {
        throw new Error(response.message || 'Erro na sincronização');
      }
    } catch (error) {
      handleSyncError(error);
    }
  }, [simulateSyncProgress]);

  const handleSyncComplete = (response) => {
    setIsSync(false);
    setSyncProgress(100);
    setSyncStatus('Concluído');
    
    // Update stats
    if (response.stats) {
      setCustomersStats(response.stats);
    }
    
    setLastSync({
      completed_at: new Date().toISOString(),
      customers_synced: response.customersSynced || 0,
      customers_geocoded: response.customersGeocoded || 0,
      errors: response.errors || 0
    });

    toast.success(`Sincronização concluída! ${response.customersSynced} clientes processados.`);
    
    if (onSyncComplete) {
      onSyncComplete();
    }

    loadSyncStatus();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getStatusIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const connectionStatusCard = (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" gutterBottom>
            Status da Conexão Ploomes
          </Typography>
          <IconButton onClick={testPloomeConnection} disabled={testingConnection}>
            {testingConnection ? <CircularProgress size={20} /> : <RefreshIcon />}
          </IconButton>
        </Box>
        
        {connectionTest ? (
          <Box>
            <Box display="flex" alignItems="center" mb={1}>
              {connectionTest.success ? (
                <CheckCircleIcon color="success" sx={{ mr: 1 }} />
              ) : (
                <ErrorIcon color="error" sx={{ mr: 1 }} />
              )}
              <Typography>
                {connectionTest.success ? 'Conectado' : 'Erro de conexão'}
              </Typography>
            </Box>
            
            {connectionTest.apiInfo && (
              <Box>
                <Typography variant="caption" display="block">
                  API: {connectionTest.apiInfo.version}
                </Typography>
                <Typography variant="caption" display="block">
                  Rate Limit: {connectionTest.apiInfo.rateLimit}
                </Typography>
              </Box>
            )}
            
            {connectionTest.error && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {connectionTest.error}
              </Alert>
            )}
          </Box>
        ) : (
          <Typography color="text.secondary">
            Testando conexão...
          </Typography>
        )}
      </CardContent>
    </Card>
  );

  const statisticsCard = (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Estatísticas dos Clientes
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={6} md={3}>
            <Box textAlign="center">
              <PersonIcon color="primary" sx={{ fontSize: 40 }} />
              <Typography variant="h4">{customersStats.total}</Typography>
              <Typography variant="caption">Total</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} md={3}>
            <Box textAlign="center">
              <LocationOnIcon color="success" sx={{ fontSize: 40 }} />
              <Typography variant="h4">{customersStats.geocoded}</Typography>
              <Typography variant="caption">Geocodificados</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} md={3}>
            <Box textAlign="center">
              <CheckCircleIcon color="info" sx={{ fontSize: 40 }} />
              <Typography variant="h4">{customersStats.withAddress}</Typography>
              <Typography variant="caption">Com Endereço</Typography>
            </Box>
          </Grid>
          <Grid item xs={6} md={3}>
            <Box textAlign="center">
              <ErrorIcon color="error" sx={{ fontSize: 40 }} />
              <Typography variant="h4">{customersStats.errors}</Typography>
              <Typography variant="caption">Erros</Typography>
            </Box>
          </Grid>
        </Grid>
        
        {customersStats.total > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" display="block" gutterBottom>
              Taxa de geocodificação: {((customersStats.geocoded / customersStats.total) * 100).toFixed(1)}%
            </Typography>
            <LinearProgress
              variant="determinate"
              value={(customersStats.geocoded / customersStats.total) * 100}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Sincronização de Clientes
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Sincronize os contatos do Ploomes com o sistema de otimização de rotas.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {connectionStatusCard}
          {statisticsCard}

          {/* Sync Control */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Controle de Sincronização
              </Typography>

              {/* Last Sync Info */}
              {lastSync && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    <strong>Última sincronização:</strong> {formatDate(lastSync.completed_at)}<br />
                    <strong>Clientes processados:</strong> {lastSync.customers_synced}<br />
                    <strong>Geocodificados:</strong> {lastSync.customers_geocoded}<br />
                    {lastSync.errors > 0 && (
                      <>
                        <strong>Erros:</strong> {lastSync.errors}<br />
                      </>
                    )}
                  </Typography>
                </Alert>
              )}

              {/* Sync Progress */}
              {isSync && (
                <Box sx={{ mb: 3 }}>
                  <Box display="flex" alignItems="center" mb={1}>
                    <CircularProgress size={20} sx={{ mr: 2 }} />
                    <Typography>{syncStatus}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={syncProgress}
                    sx={{ mb: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {syncProgress}% concluído
                  </Typography>
                </Box>
              )}

              {/* Sync Options */}
              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                    />
                  }
                  label="Sincronização automática"
                />
                
                {autoSync && (
                  <Box sx={{ mt: 1, ml: 4 }}>
                    <TextField
                      size="small"
                      type="number"
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(Number(e.target.value))}
                      label="Intervalo (minutos)"
                      inputProps={{ min: 5, max: 1440 }}
                      sx={{ width: 150 }}
                    />
                  </Box>
                )}
              </Box>

              {/* Action Buttons */}
              <Box display="flex" gap={2}>
                <Button
                  variant="contained"
                  onClick={handleStartSync}
                  disabled={isSync || !connectionTest?.success}
                  startIcon={isSync ? <CircularProgress size={20} /> : <SyncIcon />}
                  size="large"
                >
                  {isSync ? 'Sincronizando...' : 'Iniciar Sincronização'}
                </Button>

                <Button
                  variant="outlined"
                  onClick={() => setShowLogs(true)}
                  disabled={syncLogs.length === 0}
                  startIcon={<InfoIcon />}
                >
                  Ver Logs ({syncLogs.length})
                </Button>

                <Button
                  variant="text"
                  onClick={testPloomeConnection}
                  disabled={testingConnection}
                  startIcon={<RefreshIcon />}
                >
                  Testar Conexão
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Quick Actions */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Ações Rápidas
              </Typography>
              <List>
                <ListItem button onClick={loadSyncStatus}>
                  <ListItemIcon>
                    <RefreshIcon />
                  </ListItemIcon>
                  <ListItemText primary="Atualizar Status" />
                </ListItem>
                
                <ListItem button onClick={() => setShowLogs(true)}>
                  <ListItemIcon>
                    <InfoIcon />
                  </ListItemIcon>
                  <ListItemText primary="Ver Histórico" />
                </ListItem>
                
                <ListItem button>
                  <ListItemIcon>
                    <DownloadIcon />
                  </ListItemIcon>
                  <ListItemText primary="Exportar Dados" />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Configuration Guide */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Configuração
              </Typography>
              <Typography variant="body2" paragraph>
                Para utilizar a sincronização, certifique-se de que as seguintes variáveis estão configuradas no arquivo .env:
              </Typography>
              <Box component="pre" sx={{ 
                backgroundColor: 'grey.100', 
                p: 2, 
                borderRadius: 1,
                fontSize: '0.75rem',
                overflow: 'auto'
              }}>
{`PLOOME_API_KEY=sua_chave_api
PLOOME_USER_KEY=sua_chave_usuario
GEOCODING_API_KEY=sua_chave_geocoding`}
              </Box>
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="caption">
                  Reinicie o servidor após alterar as configurações.
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Logs Dialog */}
      <Dialog
        open={showLogs}
        onClose={() => setShowLogs(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Logs de Sincronização
        </DialogTitle>
        <DialogContent>
          {syncLogs.length > 0 ? (
            <List>
              {syncLogs.map((log, index) => (
                <ListItem key={index}>
                  <ListItemIcon>
                    {getStatusIcon(log.type)}
                  </ListItemIcon>
                  <ListItemText
                    primary={log.message}
                    secondary={log.timestamp.toLocaleString('pt-BR')}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary">
              Nenhum log disponível. Execute uma sincronização para ver os logs.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowLogs(false)}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CustomerSync;