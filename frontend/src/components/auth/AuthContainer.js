import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Login from './Login';
import Register from './Register';

const AuthContainer = () => {
    const [isLogin, setIsLogin] = useState(true);
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    // Redirect to map if already authenticated
    useEffect(() => {
        if (isAuthenticated()) {
            navigate('/map', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const switchToRegister = () => {
        setIsLogin(false);
    };

    const switchToLogin = () => {
        setIsLogin(true);
    };

    return (
        <>
            {isLogin ? (
                <Login onSwitchToRegister={switchToRegister} />
            ) : (
                <Register onSwitchToLogin={switchToLogin} />
            )}
        </>
    );
};

export default AuthContainer;