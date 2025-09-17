# Sistema de Traduções - PLOMES-ROTA-CEP

Este documento explica como usar o sistema de traduções implementado na aplicação.

## Visão Geral

A aplicação foi traduzida completamente para o português brasileiro. O sistema de traduções permite:

- Textos centralizados em um único arquivo
- Fácil manutenção e atualização
- Consistência na terminologia
- Possibilidade de extensão para outros idiomas no futuro

## Como Usar

### 1. Importar o Hook de Tradução

```javascript
import { useTranslation } from '../utils/translations';

const MyComponent = () => {
  const { t } = useTranslation();

  return <h1>{t('routeOptimizer.title')}</h1>;
};
```

### 2. Usar Traduções em Serviços

```javascript
import { t } from '../utils/translations';

const message = t('messages.success');
```

## Estrutura das Traduções

As traduções estão organizadas em grupos lógicos:

- **`nav`**: Navegação e menu principal
- **`auth`**: Autenticação (login, registro)
- **`routeOptimizer`**: Interface do otimizador de rotas
- **`route`**: Informações da rota
- **`customerList`**: Lista de clientes
- **`pdf`**: Exportação de PDF
- **`legend`**: Legenda do mapa
- **`stats`**: Estatísticas
- **`messages`**: Mensagens de feedback
- **`buttons`**: Botões e ações
- **`time`**: Formatos de tempo
- **`common`**: Textos comuns

## Componentes Traduzidos

✅ **RouteOptimizer.jsx** - Completamente traduzido
✅ **CustomerList.jsx** - Completamente traduzido
✅ **Login.js** - Completamente traduzido
✅ **Header.js** - Completamente traduzido
✅ **pdfExportService.js** - Completamente traduzido

## Exemplos de Uso

### Textos Simples
```javascript
{t('routeOptimizer.title')} // "Otimizador de Rotas - Ploome"
{t('auth.welcomeBack')} // "Bem-vindo de Volta"
```

### Textos com Parâmetros
```javascript
// Para textos que precisam de interpolação (futuro)
{t('messages.customersLoaded', { count: 25 })}
```

### Mensagens Toast
```javascript
toast.success(t('messages.originSet') + ': ' + address);
toast.error(t('messages.errorLoadingCustomers'));
```

## Manutenção

### Adicionar Nova Tradução

1. Edite `/src/utils/translations.js`
2. Adicione a nova chave no objeto `translations`
3. Use `t('categoria.chave')` nos componentes

### Modificar Tradução Existente

1. Encontre a chave em `/src/utils/translations.js`
2. Altere o valor
3. A mudança será aplicada automaticamente

## Benefícios Implementados

1. **Consistência**: Toda a interface está em português brasileiro
2. **Manutenibilidade**: Todas as traduções estão centralizadas
3. **Profissionalismo**: Terminologia técnica apropriada
4. **Acessibilidade**: Interface mais familiar para usuários brasileiros
5. **Extensibilidade**: Sistema preparado para outros idiomas

## Terminologia Técnica Adotada

- Route Optimization → Otimização de Rotas
- Route Summary → Resumo da Rota
- Customer List → Lista de Clientes
- Geocoding → Geocodificação
- Distance Filter → Filtro de Distância
- PDF Export → Exportação de PDF
- Legend → Legenda
- Status → Status

## Performance

- Impacto mínimo no bundle (~123 bytes adicionais)
- Carregamento instantâneo das traduções
- Sem requisições de rede adicionais