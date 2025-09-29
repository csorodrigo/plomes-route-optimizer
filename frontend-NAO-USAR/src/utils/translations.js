/**
 * Translation system for PLOMES-ROTA-CEP
 * Provides Brazilian Portuguese translations for all user-facing text
 */

// Main application translations
export const translations = {
  // Navigation and main interface
  nav: {
    routeOptimizer: 'Otimizador de Rotas',
    customerList: 'Lista de Clientes',
    login: 'Entrar',
    logout: 'Sair',
    dashboard: 'Painel'
  },

  // Authentication
  auth: {
    welcomeBack: 'Bem-vindo de Volta',
    signInMessage: 'Entre para acessar seu painel de otimização de rotas',
    emailAddress: 'Endereço de Email',
    password: 'Senha',
    signIn: 'Entrar',
    signUp: 'Cadastrar',
    noAccount: 'Não tem uma conta?',
    signUpHere: 'Cadastre-se aqui',
    haveAccount: 'Já tem uma conta?',
    signInHere: 'Entre aqui',
    createAccount: 'Criar Conta',
    joinMessage: 'Junte-se à nossa plataforma de otimização de rotas',
    name: 'Nome',
    confirmPassword: 'Confirmar Senha',
    emailRequired: 'Email é obrigatório',
    invalidEmail: 'Digite um email válido',
    passwordRequired: 'Senha é obrigatória',
    nameRequired: 'Nome é obrigatório',
    passwordMismatch: 'Senhas não coincidem',
    passwordMinLength: 'Senha deve ter pelo menos 6 caracteres',
    authenticated: 'Autenticado',
    signedInAs: 'Conectado como',
    myProfile: 'Meu Perfil',
    changePassword: 'Alterar Senha'
  },

  // Route Optimizer
  routeOptimizer: {
    title: 'Otimizador de Rotas - Ploome',
    origin: 'Origem',
    originPlaceholder: 'Digite o CEP (ex: 01310-100)',
    dragTip: 'Dica: Arraste o pin vermelho no mapa para ajustar a posição',
    distanceFilter: 'Filtro de Distância',
    radius: 'Raio',
    autoOptimize: 'Otimizar automaticamente',
    actions: 'Ações',
    loadCustomers: 'Carregar Clientes',
    optimizeRoute: 'Otimizar Rota',
    exportPDF: 'Exportar PDF',
    clearAll: 'Limpar Tudo',
    totalCustomers: 'Total de Clientes',
    geocoded: 'Geocodificados',
    customersInRadius: 'Clientes no Raio',
    selected: 'Selecionados',
    selectedCustomers: 'Clientes Selecionados',
    removeFromSelection: 'Remover da seleção',
    map: 'Mapa',
    customerListTab: 'Lista de Clientes',
    selectCustomersHint: 'Selecione clientes no mapa ou na lista'
  },

  // Route Information
  route: {
    optimizedRoute: 'Rota Otimizada',
    totalDistance: 'Distância Total',
    estimatedTime: 'Tempo Estimado',
    stops: 'Paradas',
    segments: 'Segmentos',
    orderUpdated: 'Ordem da rota atualizada!',
    routeDetails: 'Detalhes da Rota',
    routeSummary: 'Resumo da Rota',
    calculatedBy: 'Rota calculada com base na otimização por proximidade',
    savedSuccessfully: 'Rota otimizada e salva!',
    optimizedLocally: 'Rota otimizada localmente (não foi salva no servidor)',
    origin: 'Origem',
    dragToAdjust: 'Arraste o pin para ajustar a posição',
    originUpdated: 'Origem atualizada para a nova posição'
  },

  // Customer List
  customerList: {
    title: 'Lista de Clientes',
    routeOrder: 'Ordem da Rota',
    routeMode: 'Modo Rota',
    update: 'Atualizar',
    exportCSV: 'Exportar CSV',
    startGeocoding: 'Iniciar Geocodificação',
    searchPlaceholder: 'Buscar por nome, CEP, endereço ou cidade...',
    routeOrderTitle: 'Ordem dos Clientes na Rota',
    customers: 'clientes',
    dragToReorder: 'Arraste os clientes para reordenar a rota. As mudanças serão aplicadas em tempo real.',
    noRouteFound: 'Nenhuma rota definida. Use o otimizador de rotas para criar uma rota.',
    noCustomersFound: 'Nenhum cliente encontrado',
    name: 'Nome',
    cep: 'CEP',
    address: 'Endereço',
    city: 'Cidade',
    state: 'Estado',
    status: 'Status',
    geocoded: 'Geocodificado',
    pending: 'Pendente',
    processing: 'Processando',
    noName: 'Sem nome',
    noAddress: 'Sem endereço',
    rowsPerPage: 'Linhas por página',
    routeOrderUpdated: 'Ordem da rota atualizada!'
  },

  // PDF Export
  pdf: {
    exportPDF: 'Exportar PDF',
    title: 'RELATÓRIO DE ROTA OTIMIZADA',
    companyName: 'CIA MÁQUINAS',
    reportTitle: 'Relatório de Rota Otimizada',
    generatedOn: 'Gerado em',
    routeSummary: 'RESUMO DA ROTA',
    origin: 'Origem',
    createdOn: 'Criado em',
    routeStatistics: 'ESTATÍSTICAS DA ROTA',
    totalDistance: 'Distância Total',
    estimatedTime: 'Tempo Estimado',
    totalStops: 'Total de Paradas',
    visitSequence: 'SEQUÊNCIA DE VISITAS',
    customer: 'Cliente',
    address: 'Endereço',
    city: 'Cidade',
    distance: 'Distância (km)',
    sequenceNumber: 'Nº',
    footer: 'Gerado automaticamente pelo Sistema de Otimização de Rotas - CIA Máquinas',
    page: 'Página',
    exportSuccess: 'PDF exportado com sucesso',
    exportError: 'Erro ao exportar PDF',
    unexpectedError: 'Erro inesperado ao exportar PDF',
    routeRequired: 'É necessário ter uma rota otimizada para exportar o PDF'
  },

  // Map Legend
  legend: {
    title: 'Legenda',
    origin: 'Origem',
    customer: 'Cliente',
    selectedCustomer: 'Cliente Selecionado',
    coverageArea: 'Área de Cobertura'
  },

  // Statistics
  stats: {
    total: 'Total',
    geocoded: 'Geocodificados',
    pending: 'Pendentes',
    processing: 'Processando'
  },

  // Messages and Notifications
  messages: {
    // Success messages
    customersLoaded: 'clientes com endereço carregados',
    customersLoadedAll: 'clientes carregados',
    originSet: 'Origem definida',
    geocodingStarted: 'Geocodificação iniciada em background',

    // Warning messages
    invalidCEP: 'Digite um CEP válido com 8 dígitos',
    cepNotFound: 'CEP não encontrado',
    defineOriginAndCustomers: 'Defina a origem e selecione clientes',

    // Error messages
    errorLoadingCustomers: 'Erro ao carregar clientes',
    errorSearchingCEP: 'Erro ao buscar CEP',
    errorOptimizingRoute: 'Erro ao otimizar rota',
    errorStartingGeocoding: 'Erro ao iniciar geocodificação',
    errorUpdatingRoute: 'Erro ao atualizar a rota',
    errorLoadingStats: 'Erro ao carregar estatísticas',
    errorCheckingProgress: 'Erro ao verificar progresso',

    // Info messages
    multipleCustomersLocation: 'clientes compartilham esta localização',
    customerNumber: 'Cliente',
    of: 'de'
  },

  // Buttons and Actions
  buttons: {
    select: 'Selecionar',
    selected: 'Selecionado',
    remove: 'Remover',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    close: 'Fechar',
    save: 'Salvar',
    edit: 'Editar',
    delete: 'Excluir',
    yes: 'Sim',
    no: 'Não'
  },

  // Time formats
  time: {
    minutes: 'min',
    hours: 'h',
    km: 'km'
  },

  // Common labels
  common: {
    loading: 'Carregando...',
    noData: 'Nenhum dado disponível',
    notSpecified: 'Não especificado',
    na: 'N/A',
    none: 'Nenhum',
    all: 'Todos',
    search: 'Buscar',
    filter: 'Filtrar',
    sort: 'Ordenar',
    view: 'Visualizar',
    download: 'Baixar',
    upload: 'Enviar'
  }
};

/**
 * Get translated text by key path
 * @param {string} key - Dot notation path (e.g., 'auth.welcomeBack')
 * @param {object} params - Parameters for interpolation
 * @returns {string} Translated text
 */
export const t = (key, params = {}) => {
  const keys = key.split('.');
  let result = translations;

  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) {
      result = result[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key; // Return key if translation not found
    }
  }

  if (typeof result === 'string') {
    // Simple parameter interpolation
    return result.replace(/\{\{(\w+)\}\}/g, (match, param) => {
      return params[param] || match;
    });
  }

  console.warn(`Translation key "${key}" does not resolve to a string`);
  return key;
};

/**
 * Hook for using translations in React components
 */
export const useTranslation = () => {
  return {
    t: (key, params = {}) => {
      const keys = key.split('.');
      let result = translations;

      for (const k of keys) {
        if (result && typeof result === 'object' && k in result) {
          result = result[k];
        } else {
          console.warn(`Translation key not found: ${key}`);
          return key; // Return key if translation not found
        }
      }

      if (typeof result === 'string') {
        // Simple parameter interpolation
        return result.replace(/\{\{(\w+)\}\}/g, (match, param) => {
          return params[param] || match;
        });
      }

      console.warn(`Translation key "${key}" does not resolve to a string`);
      return key;
    },
    translations
  };
};

export default translations;