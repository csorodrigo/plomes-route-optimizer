import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

import {
  Container,
  Box,
  Grid,
  Paper,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  CircularProgress,
  Alert,
  Typography
} from '@mui/material';

import {
  Menu as MenuIcon,
  Map as MapIcon,
  Sync as SyncIcon,
  AccountCircle as PersonIcon,
  Settings as SettingsIcon,
  Dashboard as DashboardIcon
} from '@mui/icons-material';

import RouteOptimizer from './RouteOptimizer';
import Statistics from './Statistics';
import CustomerSync from './CustomerSync';
import CustomerList from './CustomerList';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const MainApp = ({ initialView = 'dashboard' }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentView, setCurrentView] = useState(initialView);
  const [statistics, setStatistics] = useState(null);
  const [loading] = useState(false);

  useEffect(() => {
    fetchStatistics();
  }, []);

  useEffect(() => {
    setCurrentView(initialView);
  }, [initialView]);

  const fetchStatistics = async () => {
    try {
      const response = await api.getStatistics();
      // O backend retorna {success: true, statistics: {...}}
      const stats = response.statistics || response;
      setStatistics(stats);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('Failed to load statistics');
    }
  };

  const handleSyncComplete = () => {
    fetchStatistics();
    toast.success('Sincronização concluída com sucesso!');
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, view: 'dashboard', path: '/dashboard' },
    { text: 'Lista de Clientes', icon: <PersonIcon />, view: 'customers', path: '/customers' },
    { text: 'Mapa e Rotas', icon: <MapIcon />, view: 'map', path: '/map' },
    { text: 'Sincronizar', icon: <SyncIcon />, view: 'sync', path: '/sync' },
    { text: 'Configurações', icon: <SettingsIcon />, view: 'settings', path: '/settings' }
  ];

  const handleMenuItemClick = (item) => {
    setCurrentView(item.view);
    navigate(item.path);
    setDrawerOpen(false);
  };

  const renderView = () => {
    switch (currentView) {
      case 'customers':
        return <CustomerList />;
      case 'map':
        return <RouteOptimizer onRouteOptimized={fetchStatistics} />;
      case 'sync':
        return <CustomerSync onSyncComplete={handleSyncComplete} />;
      case 'dashboard':
        return <Statistics statistics={statistics} />;
      case 'settings':
        return (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Configurações
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              As configurações estão no arquivo .env na raiz do projeto.
            </Alert>
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Informações da Conta
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Nome
                    </Typography>
                    <Typography variant="body1">
                      {user?.name}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Email
                    </Typography>
                    <Typography variant="body1">
                      {user?.email}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        );
      default:
        return <Statistics statistics={statistics} />;
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
      {/* Menu button - always visible */}
      <Box
        sx={{
          position: 'fixed',
          top: 80,
          left: 16,
          zIndex: 1200,
          display: 'block'  // Always show menu button
        }}
      >
        <IconButton
          color="primary"
          onClick={() => setDrawerOpen(true)}
          sx={{
            backgroundColor: 'white',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            '&:hover': { backgroundColor: 'grey.50' }
          }}
        >
          <MenuIcon />
        </IconButton>
      </Box>

      {/* Drawer for mobile and desktop */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          width: 280,
          flexShrink: 0,
          display: 'block',  // Always show drawer when open
          '& .MuiDrawer-paper': {
            width: 280,
            boxSizing: 'border-box',
            top: 64,
            height: 'calc(100vh - 64px)',
            borderRight: '1px solid rgba(0,0,0,0.12)',
            backgroundColor: 'white'
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" color="text.secondary">
            Navigation
          </Typography>
        </Box>
        
        <List>
          {menuItems.map((item) => (
            <ListItem
              button
              key={item.text}
              onClick={() => handleMenuItemClick(item)}
              selected={currentView === item.view}
              sx={{
                mx: 1,
                borderRadius: 2,
                '&.Mui-selected': {
                  backgroundColor: 'primary.light',
                  color: 'primary.contrastText',
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  }
                }
              }}
            >
              <ListItemIcon 
                sx={{ 
                  color: currentView === item.view ? 'inherit' : 'text.secondary' 
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>
        
        <Divider sx={{ my: 2 }} />
        
        {/* Statistics in sidebar */}
        {statistics && (
          <Box sx={{ px: 2, pb: 2 }}>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              Estatísticas Rápidas
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Badge badgeContent={statistics.totalCustomers} color="primary" sx={{ mr: 2 }}>
                <PersonIcon color="action" />
              </Badge>
              <Typography variant="body2">
                Total de clientes
              </Typography>
            </Box>
            
            <Typography variant="caption" display="block" sx={{ mb: 1 }}>
              {statistics.geocodedCustomers}/{statistics.totalCustomers} geocodificados
            </Typography>
            
            <Typography variant="caption" display="block" color="text.secondary">
              Última sincronização:
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {statistics.lastSync 
                ? new Date(statistics.lastSync.completed_at).toLocaleString('pt-BR')
                : 'Nunca sincronizado'}
            </Typography>
          </Box>
        )}
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          backgroundColor: 'background.default',
          minHeight: 'calc(100vh - 64px)',
          ml: drawerOpen ? '280px' : 0,  // Margin when drawer is open
          transition: 'margin-left 0.3s ease'
        }}
      >
        <Container maxWidth={false}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
              <CircularProgress />
            </Box>
          ) : (
            renderView()
          )}
        </Container>
      </Box>
    </Box>
  );
};

export default MainApp;