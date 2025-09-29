import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation();

    // Show loading spinner while checking authentication
    if (loading) {
        return (
            <Box
                sx={{
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                }}
            >
                <CircularProgress size={60} sx={{ color: 'white', mb: 2 }} />
                <Typography variant="h6" color="white" sx={{ opacity: 0.9 }}>
                    Loading...
                </Typography>
            </Box>
        );
    }

    // Redirect to login if not authenticated
    if (!isAuthenticated()) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Render protected content
    return children;
};

export default ProtectedRoute;