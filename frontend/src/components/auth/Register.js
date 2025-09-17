import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    TextField,
    Button,
    Typography,
    Alert,
    CircularProgress,
    Link,
    InputAdornment,
    IconButton,
    LinearProgress
} from '@mui/material';
import {
    Email,
    Lock,
    Person,
    Visibility,
    VisibilityOff,
    PersonAdd
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';

const Register = ({ onSwitchToLogin }) => {
    const { register, loading } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const getPasswordStrength = (password) => {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;
        return strength;
    };

    const getPasswordStrengthLabel = (strength) => {
        switch (strength) {
            case 0:
            case 1:
                return { label: 'Very Weak', color: 'error' };
            case 2:
                return { label: 'Weak', color: 'warning' };
            case 3:
                return { label: 'Medium', color: 'info' };
            case 4:
                return { label: 'Strong', color: 'success' };
            case 5:
                return { label: 'Very Strong', color: 'success' };
            default:
                return { label: '', color: 'primary' };
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Full name is required';
        } else if (formData.name.trim().length < 2) {
            newErrors.name = 'Name must be at least 2 characters long';
        }

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters long';
        } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(formData.password)) {
            newErrors.password = 'Password must contain at least one letter and one number';
        }

        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        const result = await register(formData.email, formData.password, formData.name);
        
        if (!result.success && result.error) {
            // Handle specific errors
            if (result.error.includes('email')) {
                setErrors({ email: result.error });
            } else if (result.error.includes('password')) {
                setErrors({ password: result.error });
            } else if (result.error.includes('name')) {
                setErrors({ name: result.error });
            } else {
                setErrors({ general: result.error });
            }
        }
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    const toggleConfirmPasswordVisibility = () => {
        setShowConfirmPassword(!showConfirmPassword);
    };

    const passwordStrength = getPasswordStrength(formData.password);
    const passwordStrengthInfo = getPasswordStrengthLabel(passwordStrength);

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: 2
            }}
        >
            <Card
                sx={{
                    width: '100%',
                    maxWidth: 450,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    borderRadius: 3
                }}
            >
                <CardContent sx={{ padding: 4 }}>
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                            <Logo
                                size="large"
                                showText={true}
                                variant="h5"
                                color="primary.main"
                            />
                        </Box>
                        <Typography variant="h4" component="h1" gutterBottom>
                            {t('auth.createAccount')}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('auth.joinMessage')}
                        </Typography>
                    </Box>

                    {errors.general && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {errors.general}
                        </Alert>
                    )}

                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
                        <TextField
                            fullWidth
                            name="name"
                            label="Full Name"
                            type="text"
                            value={formData.name}
                            onChange={handleChange}
                            error={!!errors.name}
                            helperText={errors.name}
                            margin="normal"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Person color={errors.name ? 'error' : 'action'} />
                                    </InputAdornment>
                                )
                            }}
                            autoComplete="name"
                            autoFocus
                        />

                        <TextField
                            fullWidth
                            name="email"
                            label="Email Address"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            error={!!errors.email}
                            helperText={errors.email}
                            margin="normal"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Email color={errors.email ? 'error' : 'action'} />
                                    </InputAdornment>
                                )
                            }}
                            autoComplete="email"
                        />

                        <TextField
                            fullWidth
                            name="password"
                            label="Password"
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={handleChange}
                            error={!!errors.password}
                            helperText={errors.password}
                            margin="normal"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Lock color={errors.password ? 'error' : 'action'} />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={togglePasswordVisibility}
                                            edge="end"
                                            aria-label="toggle password visibility"
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                            autoComplete="new-password"
                        />

                        {formData.password && (
                            <Box sx={{ mt: 1, mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Password strength: 
                                    </Typography>
                                    <Typography 
                                        variant="body2" 
                                        color={`${passwordStrengthInfo.color}.main`}
                                        sx={{ ml: 1, fontWeight: 'bold' }}
                                    >
                                        {passwordStrengthInfo.label}
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={(passwordStrength / 5) * 100}
                                    color={passwordStrengthInfo.color}
                                    sx={{ height: 4, borderRadius: 2 }}
                                />
                            </Box>
                        )}

                        <TextField
                            fullWidth
                            name="confirmPassword"
                            label="Confirm Password"
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            error={!!errors.confirmPassword}
                            helperText={errors.confirmPassword}
                            margin="normal"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Lock color={errors.confirmPassword ? 'error' : 'action'} />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={toggleConfirmPasswordVisibility}
                                            edge="end"
                                            aria-label="toggle confirm password visibility"
                                        >
                                            {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                            autoComplete="new-password"
                        />

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={loading}
                            sx={{
                                mt: 3,
                                mb: 2,
                                py: 1.5,
                                background: 'linear-gradient(45deg, #667eea 30%, #764ba2 90%)',
                                '&:hover': {
                                    background: 'linear-gradient(45deg, #5a6fd8 30%, #6a4190 90%)',
                                }
                            }}
                        >
                            {loading ? (
                                <CircularProgress size={24} color="inherit" />
                            ) : (
                                'Create Account'
                            )}
                        </Button>

                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                Already have an account?{' '}
                                <Link
                                    component="button"
                                    type="button"
                                    onClick={onSwitchToLogin}
                                    sx={{
                                        textDecoration: 'none',
                                        '&:hover': { textDecoration: 'underline' }
                                    }}
                                >
                                    Sign in here
                                </Link>
                            </Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>
        </Box>
    );
};

export default Register;