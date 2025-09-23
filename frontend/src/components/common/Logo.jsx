import React from 'react';
import { Box, Typography } from '@mui/material';
import { Business } from '@mui/icons-material';

const Logo = ({
    size = 'medium',
    showText = true,
    variant = 'h6',
    color = 'text.primary',
    sx = {},
    ...props
}) => {
    const sizeMap = {
        small: { width: '32px', height: '32px', fontSize: '1.5rem' },
        medium: { width: '40px', height: '40px', fontSize: '2rem' },
        large: { width: '56px', height: '56px', fontSize: '2.5rem' }
    };

    const logoSize = sizeMap[size] || sizeMap.medium;

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                ...sx
            }}
            {...props}
        >
            {/* Logo Image - visible for tests */}
            <img
                src="/logo.png"
                alt="CIA Máquinas Logo"
                style={{
                    width: logoSize.width,
                    height: logoSize.height,
                    objectFit: 'contain'
                }}
                onError={(e) => {
                    // Fallback to icon if image fails to load
                    e.target.style.display = 'none';
                    const fallbackIcon = e.target.nextElementSibling;
                    if (fallbackIcon) {
                        fallbackIcon.style.display = 'inline-block';
                    }
                }}
            />

            {/* Business Icon Fallback - hidden by default */}
            <Business
                sx={{
                    display: 'none',
                    width: logoSize.width,
                    height: logoSize.height,
                    fontSize: logoSize.fontSize,
                    color: color === 'text.primary' ? 'primary.main' : color
                }}
            />

            {/* Company Name */}
            {showText && (
                <Typography
                    variant={variant}
                    component="span"
                    sx={{
                        fontWeight: 'bold',
                        color: color,
                        whiteSpace: 'nowrap'
                    }}
                >
                    CIA Máquinas
                </Typography>
            )}
        </Box>
    );
};

export default Logo;