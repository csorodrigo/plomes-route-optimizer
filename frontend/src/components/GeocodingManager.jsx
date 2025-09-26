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
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../services/api';

const GeocodingManager = ({ onGeocodingComplete }) => {
  const [progress, setProgress] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    loadGeocodingProgress();
  }, []);

  const loadGeocodingProgress = useCallback(async () => {
    try {
      // Use the statistics API to get customer data and calculate geocoding progress
      const response = await api.getStatistics();
      console.log('GeocodingManager - statistics response:', response);

      // Extract the statistics from nested response structure
      const stats = response.data?.statistics || response.statistics || response.data || response;
      console.log('GeocodingManager - extracted stats:', stats);

      // Calculate geocoding progress from statistics
      const progressData = {
        total: stats.totalCustomers || 0,
        geocoded: stats.geocodedCustomers || 0,
        with_cep: stats.customersWithCep || 0,
        without_cep: (stats.totalCustomers || 0) - (stats.customersWithCep || 0),
        needs_geocoding: (stats.customersWithCep || 0) - (stats.geocodedCustomers || 0),
        estimated_geocodable: stats.customersWithCep || 0
      };

      setProgress(progressData);

      // Calculate total batches needed
      const batchSize = 50;
      const totalBatches = Math.ceil(progressData.estimated_geocodable / batchSize);
      setTotalBatches(totalBatches);

      console.log('GeocodingManager - calculated progress:', progressData);
    } catch (error) {
      console.error('Error loading geocoding progress:', error);
      toast.error('Erro ao carregar progresso do geocoding');
    }
  }, []);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date(),
      message,
      type
    }]);
  };

  const startBatchGeocoding = async () => {
    setIsRunning(true);
    setCurrentBatch(0);
    setResults(null);
    setLogs([]);

    addLog('Iniciando processo de geocodificação em lote...', 'info');

    try {
      const batchSize = 50;
      let skip = 0;
      let batchNumber = 1;
      let totalProcessed = 0;
      let totalGeocoded = 0;
      let hasMore = true;

      while (hasMore && isRunning) {
        addLog(`Processando lote ${batchNumber}/${totalBatches}...`, 'info');
        setCurrentBatch(batchNumber);

        try {
          // Use API service for batch geocoding
          const batchResult = await api.startBatchGeocoding(batchSize, skip);

          if (batchResult.success) {
            totalProcessed += batchResult.results.processed;
            totalGeocoded += batchResult.results.geocoded;

            addLog(
              `Lote ${batchNumber} concluído: ${batchResult.results.geocoded}/${batchResult.results.processed} geocodificados`,
              'success'
            );

            // Update progress
            setResults({
              totalProcessed,
              totalGeocoded,
              currentBatch: batchNumber,
              totalBatches
            });

            // Check if there are more batches
            hasMore = batchResult.metadata.has_more;
            skip = batchResult.metadata.next_skip;
            batchNumber++;

            // Short delay between batches
            await new Promise(resolve => setTimeout(resolve, 2000));

          } else {
            addLog(`Erro no lote ${batchNumber}: ${batchResult.error}`, 'error');
            break;
          }

        } catch (error) {
          addLog(`Erro ao processar lote ${batchNumber}: ${error.message}`, 'error');
          break;
        }
      }

      if (isRunning) {
        addLog(`Geocodificação concluída! Total: ${totalGeocoded}/${totalProcessed} clientes geocodificados`, 'success');
        toast.success(`Geocodificação concluída! ${totalGeocoded} clientes processados.`);

        if (onGeocodingComplete) {
          onGeocodingComplete();
        }

        // Reload progress
        await loadGeocodingProgress();
      }

    } catch (error) {
      addLog(`Erro geral: ${error.message}`, 'error');
      toast.error('Erro na geocodificação: ' + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const stopGeocoding = () => {
    setIsRunning(false);
    addLog('Geocodificação interrompida pelo usuário', 'warning');
  };

  const getStatusColor = (type) => {
    switch (type) {
      case 'success': return 'success';
      case 'error': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  };

  const getStatusIcon = (type) => {
    switch (type) {
      case 'success': return <CheckIcon color="success" />;
      case 'error': return <ErrorIcon color="error" />;
      case 'warning': return <WarningIcon color="warning" />;
      default: return <LocationIcon color="info" />;
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Gerenciador de Geocodificação
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        Geocodifique todos os clientes em lotes para otimizar o desempenho do mapa.
      </Typography>

      {/* Sync Status Check */}
      {progress && progress.total === 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Geocodificação será iniciada após a sincronização dos clientes com o Ploomes.
          </Typography>
          <Typography variant="body2">
            Execute primeiro a sincronização na página "Sincronizar" para baixar os clientes.
          </Typography>
        </Alert>
      )}

      {/* Show availability status */}
      {progress && progress.total > 0 && progress.needs_geocoding > 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>{progress.needs_geocoding} clientes</strong> estão prontos para geocodificação.
          </Typography>
          <Typography variant="body2">
            Total de clientes sincronizados: <strong>{progress.total}</strong>
          </Typography>
        </Alert>
      )}

      {progress && progress.total > 0 && progress.needs_geocoding === 0 && (
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Todos os clientes com CEP já foram geocodificados!
          </Typography>
          <Typography variant="body2">
            <strong>{progress.geocoded}/{progress.total}</strong> clientes geocodificados
          </Typography>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Progress Overview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status da Geocodificação
              </Typography>

              {progress && (
                <Box>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Box textAlign="center">
                        <Typography variant="h4" color="primary">
                          {progress.total}
                        </Typography>
                        <Typography variant="caption">
                          Total de Clientes
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box textAlign="center">
                        <Typography variant="h4" color="success.main">
                          {progress.estimated_geocodable}
                        </Typography>
                        <Typography variant="caption">
                          Geocodificáveis
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  <Typography variant="body2" gutterBottom>
                    <strong>Com CEP:</strong> {progress.with_cep} clientes
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Sem CEP:</strong> {progress.without_cep} clientes
                  </Typography>
                  <Typography variant="body2">
                    <strong>Precisam de geocodificação:</strong> {progress.needs_geocoding} clientes
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Controls */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Controles
              </Typography>

              <Box sx={{ mb: 2 }}>
                {!isRunning ? (
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    startIcon={<PlayIcon />}
                    onClick={startBatchGeocoding}
                    fullWidth
                    disabled={!progress || progress.total === 0 || progress.needs_geocoding === 0}
                  >
                    {progress?.total === 0
                      ? 'Aguardando sincronização...'
                      : progress?.needs_geocoding === 0
                        ? 'Todos já geocodificados'
                        : 'Iniciar Geocodificação em Lote'
                    }
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="error"
                    size="large"
                    startIcon={<StopIcon />}
                    onClick={stopGeocoding}
                    fullWidth
                  >
                    Parar Geocodificação
                  </Button>
                )}
              </Box>

              <Button
                variant="outlined"
                onClick={loadGeocodingProgress}
                fullWidth
                disabled={isRunning}
              >
                Atualizar Status
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Progress Bar */}
        {isRunning && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Progresso da Geocodificação
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">
                      Lote {currentBatch} de {totalBatches}
                    </Typography>
                    <Typography variant="body2">
                      {((currentBatch / totalBatches) * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(currentBatch / totalBatches) * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                {results && (
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Chip
                      label={`${results.totalProcessed} processados`}
                      color="primary"
                      variant="outlined"
                    />
                    <Chip
                      label={`${results.totalGeocoded} geocodificados`}
                      color="success"
                      variant="outlined"
                    />
                    <Chip
                      label={`${((results.totalGeocoded / results.totalProcessed) * 100).toFixed(1)}% sucesso`}
                      color="info"
                      variant="outlined"
                    />
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Logs */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Log de Atividades
              </Typography>

              {logs.length > 0 ? (
                <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                  <List dense>
                    {logs.slice(-10).map((log, index) => (
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
                </Box>
              ) : (
                <Alert severity="info">
                  Nenhuma atividade registrada ainda.
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default GeocodingManager;