// Test file to verify all imports are working
console.log('Testing imports...');

try {
  // Test React Query
  const { QueryClient } = require('@tanstack/react-query');
  console.log('✓ QueryClient from @tanstack/react-query:', !!QueryClient);

  // Test React Router
  const { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } = require('react-router-dom');
  console.log('✓ BrowserRouter from react-router-dom:', !!BrowserRouter);
  console.log('✓ Routes from react-router-dom:', !!Routes);
  console.log('✓ Route from react-router-dom:', !!Route);
  console.log('✓ Navigate from react-router-dom:', !!Navigate);
  console.log('✓ useNavigate from react-router-dom:', !!useNavigate);
  console.log('✓ useLocation from react-router-dom:', !!useLocation);

  // Test MUI System
  const { keyframes } = require('@mui/system');
  console.log('✓ keyframes from @mui/system:', !!keyframes);

  console.log('\n✅ All imports are working correctly!');
} catch (error) {
  console.error('❌ Import error:', error.message);
}