import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  CardActions,
  Grid,
  Divider,
  LinearProgress,
  Chip
} from '@mui/material';
import {
  Sync,
  CheckCircle,
  Error,
  Info,
  CloudSync,
  People,
  LocationOn
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import { useTranslation } from '../utils/translations';
import apiService from '../services/api';

/**
 * CustomerSync Component
 *
 * Handles synchronization of customers from Ploome CRM
 * Displays sync status, progress, and allows manual sync initiation
 *
 * @component
 * @param {Function} onSyncComplete - Callback when sync is completed
 */
const CustomerSync = ({ onSyncComplete }) => {
  const { t } = useTranslation();
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkConnectionStatus();
    loadSyncHistory();
  }, []);

  /**
   * Check Ploome connection status
   */
  const checkConnectionStatus = async () => {
    try {
      setLoading(true);
      const response = await apiService.testPloomeConnection();
      setConnectionStatus({
        connected: response.success || response.connected,
        message: response.message || 'Conexão estabelecida'
      });
    } catch (error) {
      setConnectionStatus({
        connected: false,
        message: error.message || 'Erro ao conectar com Ploome'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load sync history
   */
  const loadSyncHistory = async () => {
    try {
      const response = await apiService.getPloomeStatus();
      if (response.statistics && response.statistics.lastSync) {
        setLastSync(response.statistics.lastSync);
      }
    } catch (error) {
      console.warn('Could not load sync history:', error);
    }
  };

  /**
   * Start customer synchronization
   */
  const handleSync = async () => {
    try {
      setSyncing(true);
      setSyncStatus({ type: 'info', message: 'Iniciando sincronização...' });

      const response = await apiService.syncCustomers();

      if (response.success) {
        setSyncStatus({
          type: 'success',
          message: `Sincronização concluída! ${response.customersProcessed || 0} clientes processados.`
        });
        toast.success('Sincronização concluída com sucesso!');

        // Reload sync history
        await loadSyncHistory();

        // Notify parent component
        if (onSyncComplete) {
          onSyncComplete();
        }
      } else {
        throw new Error(response.message || 'Erro na sincronização');
      }
    } catch (error) {
      const errorMessage = error.message || 'Erro ao sincronizar clientes';
      setSyncStatus({
        type: 'error',
        message: errorMessage
      });
      toast.error(errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'info':
      default:
        return <Info color="info" />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CloudSync color="primary" />
        Sincronização de Clientes
      </Typography>

      <Grid container spacing={3}>
        {/* Connection Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Sync color="primary" />
                Status da Conexão
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <CircularProgress size={24} />
                  <Typography>Verificando conexão...</Typography>
                </Box>
              ) : connectionStatus ? (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Chip
                      label={connectionStatus.connected ? 'Conectado' : 'Desconectado'}
                      color={connectionStatus.connected ? 'success' : 'error'}
                      icon={connectionStatus.connected ? <CheckCircle /> : <Error />}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {connectionStatus.message}
                  </Typography>
                </Box>
              ) : (
                <Alert severity="warning">
                  Status de conexão não disponível
                </Alert>
              )}
            </CardContent>
            <CardActions>
              <Button
                onClick={checkConnectionStatus}
                disabled={loading}
                startIcon={<Sync />}
                size="small"
              >
                Verificar Conexão
              </Button>
            </CardActions>
          </Card>
        </Grid>

        {/* Last Sync Info */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <People color="primary" />
                Última Sincronização
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {lastSync ? (
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Data:</strong> {new Date(lastSync.completed_at).toLocaleString('pt-BR')}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Status:</strong>{' '}
                    <Chip
                      size="small"
                      label={lastSync.status === 'completed' ? 'Concluída' : lastSync.status}
                      color={lastSync.status === 'completed' ? 'success' : 'warning'}
                    />
                  </Typography>
                  {lastSync.customers_synced && (
                    <Typography variant="body2">
                      <strong>Clientes:</strong> {lastSync.customers_synced} sincronizados
                    </Typography>
                  )}
                </Box>
              ) : (
                <Alert severity="info">
                  Nenhuma sincronização realizada ainda
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Sync Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Sincronizar Dados
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              A sincronização irá buscar todos os clientes cadastrados no Ploome CRM e atualizar
              a base de dados local. Este processo pode demorar alguns minutos dependendo da
              quantidade de clientes.
            </Typography>

            {/* Sync Progress */}
            {syncing && (
              <Box sx={{ mb: 3 }}>
                <LinearProgress sx={{ mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Sincronizando clientes... Por favor, aguarde.
                </Typography>
              </Box>
            )}

            {/* Sync Status Message */}
            {syncStatus && (
              <Alert
                severity={syncStatus.type}
                icon={getStatusIcon(syncStatus.type)}
                sx={{ mb: 2 }}
                onClose={() => setSyncStatus(null)}
              >
                {syncStatus.message}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <CloudSync />}
                onClick={handleSync}
                disabled={syncing || !connectionStatus?.connected}
                size="large"
              >
                {syncing ? 'Sincronizando...' : 'Iniciar Sincronização'}
              </Button>

              <Button
                variant="outlined"
                startIcon={<LocationOn />}
                onClick={() => {
                  toast.info('Geocodificação será iniciada após a sincronização');
                }}
                disabled={syncing}
              >
                Geocodificar Após Sync
              </Button>
            </Box>

            {!connectionStatus?.connected && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Conexão com Ploome necessária:</strong> Verifique as configurações de API
                  no arquivo .env e certifique-se de que as credenciais estão corretas.
                </Typography>
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default CustomerSync;