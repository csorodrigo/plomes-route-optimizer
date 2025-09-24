import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  Tooltip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Person as PersonIcon,
  LocationOn as LocationOnIcon,
  Route as RouteIcon,
  Schedule as ScheduleIcon,
  TrendingUp as TrendingUpIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Map as MapIcon,
  Timer as TimerIcon,
  DirectionsCar as DirectionsCarIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../services/api';

const StatCard = ({ title, value, subtitle, icon, color = 'primary' }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h4" color={`${color}.main`}>
            {value}
          </Typography>
          <Typography variant="h6" gutterBottom>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ color: `${color}.main`, fontSize: 40 }}>
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const ProgressCard = ({ title, current, total, color = 'primary' }) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h4" color={`${color}.main`}>
            {current}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            de {total}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={percentage}
          color={color}
          sx={{ height: 8, borderRadius: 4, mb: 1 }}
        />
        <Typography variant="caption" color="text.secondary">
          {percentage.toFixed(1)}% concluído
        </Typography>
      </CardContent>
    </Card>
  );
};

const Statistics = ({ statistics: propStatistics }) => {
  const [statistics, setStatistics] = useState(propStatistics);
  const [loading, setLoading] = useState(!propStatistics);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    if (!propStatistics) {
      fetchStatistics();
    } else {
      setStatistics(propStatistics);
      setLoading(false);
    }
  }, [propStatistics]);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const response = await api.getStatistics();
      console.log('Statistics API response:', response);

      // Extract statistics from the response - handle both response formats
      const stats = response.statistics || response;
      console.log('Extracted statistics:', stats);

      setStatistics(stats);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('Erro ao carregar estatísticas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '0 min';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}min` : `${mins} min`;
  };

  const formatDistance = (km) => {
    if (!km) return '0 km';
    return km.toFixed(1) + ' km';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Carregando estatísticas...</Typography>
      </Box>
    );
  }

  if (!statistics) {
    return (
      <Alert severity="info">
        Nenhuma estatística disponível. Execute uma sincronização primeiro.
      </Alert>
    );
  }

  const geocodingRate = statistics.totalCustomers > 0 
    ? (statistics.geocodedCustomers / statistics.totalCustomers) * 100 
    : 0;

  // const routeEfficiency = statistics.totalRoutes > 0
  //   ? ((statistics.optimizedRoutes || 0) / statistics.totalRoutes) * 100
  //   : 0;

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom>
          Dashboard de Estatísticas
        </Typography>
        <Box>
          <Tooltip title="Última atualização">
            <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
              {lastUpdate.toLocaleTimeString('pt-BR')}
            </Typography>
          </Tooltip>
          <Button
            variant="outlined"
            onClick={fetchStatistics}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <RefreshIcon />}
          >
            Atualizar
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Customer Statistics */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total de Clientes"
            value={statistics.totalCustomers || 0}
            subtitle="Sincronizados do Ploomes"
            icon={<PersonIcon />}
            color="primary"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Geocodificados"
            value={statistics.geocodedCustomers || 0}
            subtitle={`${geocodingRate.toFixed(1)}% do total`}
            icon={<LocationOnIcon />}
            color="success"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Rotas Criadas"
            value={statistics.totalRoutes || 0}
            subtitle="Total de otimizações"
            icon={<RouteIcon />}
            color="info"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Última Sincronização"
            value={statistics.lastSync ? '✓' : '✗'}
            subtitle={formatDate(statistics.lastSync?.completed_at)}
            icon={<ScheduleIcon />}
            color={statistics.lastSync ? 'success' : 'error'}
          />
        </Grid>

        {/* Progress Cards */}
        <Grid item xs={12} md={6}>
          <ProgressCard
            title="Taxa de Geocodificação"
            current={statistics.geocodedCustomers || 0}
            total={statistics.totalCustomers || 0}
            color="success"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <ProgressCard
            title="Eficiência de Rotas"
            current={statistics.optimizedRoutes || 0}
            total={statistics.totalRoutes || 0}
            color="info"
          />
        </Grid>

        {/* Route Statistics */}
        {statistics.routeStats && (
          <>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Distância Total"
                value={formatDistance(statistics.routeStats.totalDistance)}
                subtitle="Todas as rotas"
                icon={<DirectionsCarIcon />}
                color="warning"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Tempo Total"
                value={formatDuration(statistics.routeStats.totalTime)}
                subtitle="Tempo estimado"
                icon={<TimerIcon />}
                color="warning"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Economia Estimada"
                value={formatDistance(statistics.routeStats.distanceSaved)}
                subtitle="vs rotas diretas"
                icon={<TrendingUpIcon />}
                color="success"
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                title="Média por Rota"
                value={`${Math.round((statistics.routeStats.totalDistance || 0) / (statistics.totalRoutes || 1))} km`}
                subtitle={`${Math.round((statistics.routeStats.customerCount || 0) / (statistics.totalRoutes || 1))} clientes/rota`}
                icon={<MapIcon />}
                color="info"
              />
            </Grid>
          </>
        )}

        {/* System Health */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Status do Sistema
              </Typography>
              
              <List>
                <ListItem>
                  <ListItemIcon>
                    {statistics.geocodedCustomers === statistics.totalCustomers ? (
                      <CheckCircleIcon color="success" />
                    ) : statistics.geocodedCustomers > 0 ? (
                      <WarningIcon color="warning" />
                    ) : (
                      <ErrorIcon color="error" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="Geocodificação"
                    secondary={`${statistics.geocodedCustomers}/${statistics.totalCustomers} clientes geocodificados`}
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    {statistics.lastSync ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <ErrorIcon color="error" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="Sincronização Ploomes"
                    secondary={statistics.lastSync ? 'Conectado e sincronizado' : 'Nunca sincronizado'}
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    {statistics.totalRoutes > 0 ? (
                      <CheckCircleIcon color="success" />
                    ) : (
                      <WarningIcon color="warning" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="Otimização de Rotas"
                    secondary={`${statistics.totalRoutes || 0} rotas criadas`}
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Atividade Recente
              </Typography>

              <List>
                {statistics.lastSync && (
                  <ListItem>
                    <ListItemIcon>
                      <ScheduleIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Sincronização realizada"
                      secondary={formatDate(statistics.lastSync.completed_at)}
                    />
                  </ListItem>
                )}

                {statistics.lastRoute && (
                  <ListItem>
                    <ListItemIcon>
                      <RouteIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Última rota otimizada"
                      secondary={formatDate(statistics.lastRoute.created_at)}
                    />
                  </ListItem>
                )}

                {statistics.recentGeocodings > 0 && (
                  <ListItem>
                    <ListItemIcon>
                      <LocationOnIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${statistics.recentGeocodings} endereços geocodificados`}
                      secondary="Nas últimas 24 horas"
                    />
                  </ListItem>
                )}

                {(!statistics.lastSync && !statistics.lastRoute && !statistics.recentGeocodings) && (
                  <ListItem>
                    <ListItemText
                      primary="Nenhuma atividade recente"
                      secondary="Execute uma sincronização para começar"
                    />
                  </ListItem>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Insights and Recommendations */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Insights e Recomendações
              </Typography>
              
              <Grid container spacing={2}>
                {geocodingRate < 80 && (
                  <Grid item xs={12} md={4}>
                    <Alert severity="warning">
                      <Typography variant="subtitle2" gutterBottom>
                        Taxa de Geocodificação Baixa
                      </Typography>
                      <Typography variant="body2">
                        {geocodingRate.toFixed(1)}% dos clientes foram geocodificados. 
                        Verifique se os endereços estão completos no Ploomes.
                      </Typography>
                    </Alert>
                  </Grid>
                )}

                {!statistics.lastSync && (
                  <Grid item xs={12} md={4}>
                    <Alert severity="info">
                      <Typography variant="subtitle2" gutterBottom>
                        Primeira Sincronização
                      </Typography>
                      <Typography variant="body2">
                        Execute sua primeira sincronização para importar 
                        clientes do Ploomes.
                      </Typography>
                    </Alert>
                  </Grid>
                )}

                {statistics.totalRoutes === 0 && statistics.geocodedCustomers > 0 && (
                  <Grid item xs={12} md={4}>
                    <Alert severity="success">
                      <Typography variant="subtitle2" gutterBottom>
                        Pronto para Otimizar
                      </Typography>
                      <Typography variant="body2">
                        Você tem {statistics.geocodedCustomers} clientes geocodificados. 
                        Comece criando suas primeiras rotas!
                      </Typography>
                    </Alert>
                  </Grid>
                )}

                {statistics.routeStats?.distanceSaved > 50 && (
                  <Grid item xs={12} md={4}>
                    <Alert severity="success">
                      <Typography variant="subtitle2" gutterBottom>
                        Excelente Economia!
                      </Typography>
                      <Typography variant="body2">
                        Suas otimizações economizaram {formatDistance(statistics.routeStats.distanceSaved)} 
                        em comparação com rotas diretas.
                      </Typography>
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Ações Rápidas
            </Typography>
            <Box display="flex" gap={2} flexWrap="wrap">
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={fetchStatistics}
                disabled={loading}
              >
                Atualizar Dados
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
              >
                Exportar Relatório
              </Button>

              <Button
                variant="outlined"
                startIcon={<PersonIcon />}
                onClick={() => window.open('/sync', '_self')}
              >
                Sincronizar Clientes
              </Button>

              <Button
                variant="outlined"
                startIcon={<RouteIcon />}
                onClick={() => window.open('/map', '_self')}
              >
                Criar Nova Rota
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Statistics;