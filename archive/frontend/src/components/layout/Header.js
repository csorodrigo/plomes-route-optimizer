import React, { useState } from 'react';
import {
    AppBar,
    Toolbar,
    Typography,
    Box,
    IconButton,
    Menu,
    MenuItem,
    Avatar,
    Chip,
    Divider,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import {
    AccountCircle,
    Logout,
    Person,
    Security,
    Route
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const Header = () => {
    const { user, logout } = useAuth();
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        handleMenuClose();
        await logout();
    };

    const getUserInitials = (name) => {
        if (!name) return 'U';
        const names = name.split(' ');
        if (names.length === 1) return names[0].charAt(0).toUpperCase();
        return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
    };

    return (
        <AppBar 
            position="sticky" 
            sx={{ 
                background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}
        >
            <Toolbar>
                {/* Logo and Title */}
                <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
                    <Box
                        component="img"
                        src="/logo.png"
                        alt="Logo"
                        sx={{
                            height: 40,
                            width: 'auto',
                            mr: 2
                        }}
                    />
                    <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                        Otimizador de Rotas
                    </Typography>
                </Box>

                {/* User Info */}
                {user && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                            <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                Bem-vindo de volta
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                {user.name}
                            </Typography>
                        </Box>

                        <Chip
                            icon={<Person />}
                            label="Autenticado"
                            size="small"
                            sx={{
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                color: 'white',
                                display: { xs: 'none', md: 'flex' }
                            }}
                        />

                        <IconButton
                            size="large"
                            edge="end"
                            aria-label="account menu"
                            aria-controls={open ? 'account-menu' : undefined}
                            aria-haspopup="true"
                            aria-expanded={open ? 'true' : undefined}
                            onClick={handleMenuOpen}
                            sx={{ color: 'white' }}
                        >
                            <Avatar
                                sx={{
                                    width: 40,
                                    height: 40,
                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                    color: 'white',
                                    fontWeight: 'bold'
                                }}
                            >
                                {getUserInitials(user.name)}
                            </Avatar>
                        </IconButton>

                        <Menu
                            anchorEl={anchorEl}
                            id="account-menu"
                            open={open}
                            onClose={handleMenuClose}
                            onClick={handleMenuClose}
                            PaperProps={{
                                elevation: 3,
                                sx: {
                                    overflow: 'visible',
                                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                                    mt: 1.5,
                                    minWidth: 200,
                                    '&:before': {
                                        content: '""',
                                        display: 'block',
                                        position: 'absolute',
                                        top: 0,
                                        right: 14,
                                        width: 10,
                                        height: 10,
                                        bgcolor: 'background.paper',
                                        transform: 'translateY(-50%) rotate(45deg)',
                                        zIndex: 0,
                                    },
                                },
                            }}
                            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        >
                            {/* User Info Section */}
                            <Box sx={{ px: 2, py: 1 }}>
                                <Typography variant="subtitle2" color="text.secondary">
                                    Logado como
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                    {user.email}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {user.name}
                                </Typography>
                            </Box>
                            
                            <Divider />

                            <MenuItem onClick={handleMenuClose}>
                                <ListItemIcon>
                                    <AccountCircle fontSize="small" />
                                </ListItemIcon>
                                <ListItemText>Meu Perfil</ListItemText>
                            </MenuItem>

                            <MenuItem onClick={handleMenuClose}>
                                <ListItemIcon>
                                    <Security fontSize="small" />
                                </ListItemIcon>
                                <ListItemText>Alterar Senha</ListItemText>
                            </MenuItem>

                            <Divider />

                            <MenuItem 
                                onClick={handleLogout}
                                sx={{ 
                                    color: 'error.main',
                                    '&:hover': {
                                        backgroundColor: 'error.light',
                                        color: 'error.contrastText'
                                    }
                                }}
                            >
                                <ListItemIcon>
                                    <Logout fontSize="small" sx={{ color: 'inherit' }} />
                                </ListItemIcon>
                                <ListItemText>Sair</ListItemText>
                            </MenuItem>
                        </Menu>
                    </Box>
                )}
            </Toolbar>
        </AppBar>
    );
};

export default Header;