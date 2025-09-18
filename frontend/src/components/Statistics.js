import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Divider
} from '@mui/material';
import {
  People,
  LocationOn,
  Schedule,
  Sync
} from '@mui/icons-material';
import { useTranslation } from '../utils/translations';

/**
 * Statistics Component
 *
 * Displays dashboard statistics and metrics about customers and geocoding
 *
 * @component
 * @param {Object} statistics - Statistics data from API
 */
const Statistics = ({ statistics }) => {
  const { t } = useTranslation();

  if (!statistics) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const StatCard = ({ title, value, icon, color = 'primary' }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              backgroundColor: `${color}.light`,
              color: `${color}.contrastText`,
              mr: 2
            }}
          >
            {icon}
          </Box>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {title}
          </Typography>
        </Box>
        <Typography variant="h3" component="div" color={`${color}.main`}>
          {value || 0}
        </Typography>
      </CardContent>
    </Card>
  );

  const geocodedPercentage = statistics.totalCustomers > 0
    ? ((statistics.geocodedCustomers / statistics.totalCustomers) * 100).toFixed(1)
    : 0;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard - Estatísticas
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total de Clientes"
            value={statistics.totalCustomers}
            icon={<People />}
            color="primary"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('customerList.geocoded')}
            value={statistics.geocodedCustomers}
            icon={<LocationOn />}
            color="success"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title={t('customerList.pending')}
            value={statistics.totalCustomers - statistics.geocodedCustomers}
            icon={<Schedule />}
            color="warning"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Geocodificação %"
            value={`${geocodedPercentage}%`}
            icon={<LocationOn />}
            color="info"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Sync color="primary" />
              Última Sincronização
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {statistics.lastSync ? (
              <Box>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Data:</strong> {new Date(statistics.lastSync.completed_at).toLocaleString('pt-BR')}
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Status:</strong> {statistics.lastSync.status === 'completed' ? 'Concluída' : 'Em andamento'}
                </Typography>
                {statistics.lastSync.customers_synced && (
                  <Typography variant="body1">
                    <strong>Clientes sincronizados:</strong> {statistics.lastSync.customers_synced}
                  </Typography>
                )}
              </Box>
            ) : (
              <Alert severity="info">
                Nenhuma sincronização realizada ainda
              </Alert>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Progresso de Geocodificação
            </Typography>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Progresso</Typography>
                <Typography variant="body2">{geocodedPercentage}%</Typography>
              </Box>
              <Box
                sx={{
                  width: '100%',
                  height: 8,
                  backgroundColor: 'grey.300',
                  borderRadius: 4,
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    width: `${geocodedPercentage}%`,
                    height: '100%',
                    backgroundColor: 'success.main',
                    transition: 'width 0.3s ease-in-out'
                  }}
                />
              </Box>
            </Box>

            <Typography variant="body2" color="text.secondary">
              {statistics.geocodedCustomers} de {statistics.totalCustomers} clientes geocodificados
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Statistics;