import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import Logo from './Logo';

// Storybook story for Logo component examples
export default {
    title: 'Components/Logo',
    component: Logo,
    parameters: {
        docs: {
            description: {
                component: 'A reusable logo component for CIA Máquinas branding across the application.'
            }
        }
    }
};

// Example usage stories
export const AllSizes = () => (
    <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', p: 2 }}>
        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexDirection: 'column' }}>
            <Typography variant="caption" color="text.secondary">Small</Typography>
            <Logo size="small" />
        </Paper>

        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexDirection: 'column' }}>
            <Typography variant="caption" color="text.secondary">Medium (Default)</Typography>
            <Logo size="medium" />
        </Paper>

        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexDirection: 'column' }}>
            <Typography variant="caption" color="text.secondary">Large</Typography>
            <Logo size="large" />
        </Paper>
    </Box>
);

export const LogoOnly = () => (
    <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', p: 2 }}>
        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexDirection: 'column' }}>
            <Typography variant="caption" color="text.secondary">Logo Only - Small</Typography>
            <Logo size="small" showText={false} />
        </Paper>

        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexDirection: 'column' }}>
            <Typography variant="caption" color="text.secondary">Logo Only - Medium</Typography>
            <Logo size="medium" showText={false} />
        </Paper>

        <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexDirection: 'column' }}>
            <Typography variant="caption" color="text.secondary">Logo Only - Large</Typography>
            <Logo size="large" showText={false} />
        </Paper>
    </Box>
);

export const HeaderExample = () => (
    <Box sx={{
        background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
        p: 2,
        color: 'white',
        borderRadius: 1
    }}>
        <Typography variant="caption" color="rgba(255,255,255,0.7)" sx={{ mb: 1, display: 'block' }}>
            Header Usage Example
        </Typography>
        <Logo size="medium" showText={false} />
    </Box>
);

export const LoginExample = () => (
    <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 400, mx: 'auto' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            Login Screen Usage Example
        </Typography>
        <Logo size="large" showText={true} variant="h5" color="primary.main" />
        <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 2 }}>
            Welcome Back
        </Typography>
        <Typography variant="body2" color="text.secondary">
            Sign in to access your route optimization dashboard
        </Typography>
    </Paper>
);