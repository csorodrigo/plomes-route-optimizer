import React from 'react';
import { Alert, AlertTitle, Box, Button, Paper } from '@mui/material';
import { RefreshRounded, BugReport } from '@mui/icons-material';

/**
 * Error Boundary component to catch React errors and prevent crashes
 * Specifically designed to handle minified production errors like Error #31
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      errorId: Date.now()
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('🚨 React Error Boundary caught an error:', {
      error: error,
      errorInfo: errorInfo,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Send error to monitoring service if available
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false
      });
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isMinifiedError = this.state.error?.message?.includes('Minified React error');
      const errorNumber = this.state.error?.message?.match(/#(\d+)/)?.[1];

      return (
        <Paper
          elevation={3}
          sx={{
            m: 2,
            p: 3,
            maxWidth: 600,
            margin: '20px auto',
            border: '2px solid #f44336'
          }}
        >
          <Alert severity="error" sx={{ mb: 2 }}>
            <AlertTitle>
              <BugReport sx={{ mr: 1, verticalAlign: 'middle' }} />
              Erro na Aplicação Detectado
            </AlertTitle>

            {isMinifiedError && (
              <Box sx={{ mt: 2 }}>
                <strong>React Error #{errorNumber}</strong>
                <p>
                  Este é um erro de produção minificado do React.
                  O erro específico foi capturado para evitar o crash da aplicação.
                </p>
              </Box>
            )}

            {!isMinifiedError && this.state.error && (
              <Box sx={{ mt: 2 }}>
                <strong>Mensagem do Erro:</strong>
                <pre style={{
                  fontSize: '12px',
                  background: '#f5f5f5',
                  padding: '8px',
                  borderRadius: '4px',
                  overflow: 'auto',
                  maxHeight: '150px',
                  marginTop: '8px'
                }}>
                  {this.state.error.toString()}
                </pre>
              </Box>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<RefreshRounded />}
                onClick={this.handleRetry}
                size="small"
              >
                Tentar Novamente
              </Button>

              <Button
                variant="outlined"
                color="secondary"
                onClick={this.handleReload}
                size="small"
              >
                Recarregar Página
              </Button>
            </Box>

            {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
              <Box sx={{ mt: 2 }}>
                <details style={{ marginTop: '16px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                    Detalhes do Erro (Desenvolvimento)
                  </summary>
                  <pre style={{
                    fontSize: '11px',
                    background: '#f5f5f5',
                    padding: '8px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    maxHeight: '200px',
                    marginTop: '8px',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              </Box>
            )}

            <Box sx={{ mt: 2, fontSize: '12px', color: 'text.secondary' }}>
              <strong>Dica:</strong> Se o erro persistir, tente:
              <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                <li>Limpar o cache do navegador</li>
                <li>Verificar a conexão com a internet</li>
                <li>Recarregar a página completamente</li>
              </ul>
            </Box>
          </Alert>
        </Paper>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;