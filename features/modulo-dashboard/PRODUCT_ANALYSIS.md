# Análise de Produtos - Sistema Ploomes

## Resumo Executivo
Análise detalhada da estrutura de produtos encontrada nos deals do Ploomes, identificando categorias, padrões e relacionamentos.

## Estrutura de Dados dos Produtos

### Campos Principais (JSON)
```json
{
  "product_id": "string",       // ID único do produto
  "product_name": "string",      // Nome do produto/serviço
  "quantity": number,            // Quantidade
  "unit_price": number,          // Preço unitário
  "total": number,               // Total (quantity * unit_price)
  "discount": number,            // Desconto aplicado
  "source": "quote|order",       // Origem do produto
  "quote_id/order_id": number    // ID da cotação ou pedido
}
```

## Categorias de Produtos

### 1. Serviços (Prefixo CIA_)
Total de 8 tipos principais de serviços identificados:

| Código | Descrição | Ocorrências | % do Total |
|--------|-----------|-------------|------------|
| CIA_SERV_COMP | Serviços de Compressor | 1013 | 15.8% |
| CIA_LOC_COMP | Locação de Compressor | 584 | 9.1% |
| CIA_SERV_SEC | Serviços de Secador | 161 | 2.5% |
| CIA_SERV_INSP | Serviços de Inspeção | 145 | 2.3% |
| CIA_CSC | Contrato de Serviço Continuado | 121 | 1.9% |
| CIA_MONT | Montagem | 113 | 1.8% |
| CIA_LOC_SEC | Locação de Secador | 105 | 1.6% |
| CIA_REPR | Representação | 103 | 1.6% |

### 2. Consumíveis e Fluidos
Top 5 produtos consumíveis mais vendidos:

| Produto | Código | Ocorrências |
|---------|--------|-------------|
| Fluido Refrigerante Ultra Coolant 5GAL | 0021 | 423 |
| Óleo Refrigerante Food Grade Ultra FG 20L | 0156 | 100 |
| Óleo BV100 | 008055 | Variado |
| Lubrificantes diversos | Vários | Variado |

### 3. Filtros e Elementos Filtrantes
Principais categorias de filtros:

| Tipo | Exemplos de Código | Frequência |
|------|-------------------|------------|
| Filtro de Óleo | 0084, 0018, 0090 | Alta |
| Filtro de Ar | 0025, 0150, 0492 | Alta |
| Separador Ar/Óleo | 9091, 0186, 0539 | Média |
| Pré-Filtros | 0091, 6584 | Média |
| Filtro de Admissão | 0024 | Alta |

### 4. Componentes e Peças

#### 4.1 Válvulas
- Válvula Schrader 1/4" (90295) - 111 ocorrências
- Válvulas de Esfera (diversos tamanhos)
- Válvulas de Pressão Mínima

#### 4.2 Tubulações e Conexões
- Tubos de Alumínio (25mm, 40mm, 63mm, 80mm)
- Cotovelos 90° (diversos materiais)
- Conexões em T
- Adaptadores rosqueados

#### 4.3 Componentes de Vedação
- O-rings diversos
- Juntas
- Elementos de vedação Viton

## Marcas e Fabricantes

### Distribuição por Marca
1. **Ingersoll Rand** - Principal fornecedor
   - Comissões mensais
   - Peças de garantia
   - Componentes específicos

2. **Atlas Copco** - Segundo fornecedor
   - Filtros especializados
   - Componentes de reposição

3. **Outras Marcas**
   - Gardner Denver
   - Chicago Pneumatic
   - CompAir

## Padrões de Nomenclatura

### Formato Padrão
`[DESCRIÇÃO] - [CÓDIGO]`

Exemplos:
- `ELEMENTO DE FILTRO DE AR - 0025`
- `VALVULA SCHRADER 1/4 - 90295`

### Códigos Especiais
- **Numéricos puros**: 0001-9999 (peças comuns)
- **Alfanuméricos**: 90XXX, 92XXX (válvulas)
- **Códigos longos**: 00080XX (componentes específicos)

## Relacionamentos e Integrações

### Hierarquia de Dados
```
Deal (Negócio)
├── Quote (Cotação)
│   └── Products[] (Produtos da cotação)
└── Order (Pedido)
    └── Products[] (Produtos do pedido)
```

### Duplicação de Produtos
- Mesmo produto pode aparecer em quote e order
- Produtos com quantidade/preço zero indicam serviços ou itens pendentes

## Insights e Recomendações

### Oportunidades Identificadas
1. **Padronização**: Necessidade de categorização formal dos produtos
2. **Precificação**: Muitos produtos com preço zero precisam revisão
3. **Agrupamento**: Serviços CIA_* poderiam ser subcategorizados
4. **Códigos**: Sistema de códigos precisa documentação formal

### Próximos Passos
1. Criar tabela de categorias de produtos no banco
2. Implementar sincronização automática com Ploomes
3. Desenvolver dashboard de análise de produtos
4. Criar relatórios de produtos mais vendidos por categoria

## Estatísticas Gerais

- **Total de produtos únicos**: ~500+
- **Deals com produtos**: ~40% do total
- **Média de produtos por deal**: 8-10 itens
- **Categoria mais comum**: Serviços (36.6% do total)

## Queries SQL Úteis

### Produtos mais vendidos
```sql
SELECT
    product_name,
    COUNT(*) as frequency,
    SUM(quantity) as total_quantity,
    AVG(unit_price) as avg_price
FROM sales,
    jsonb_array_elements(products) as p
GROUP BY product_name
ORDER BY frequency DESC
LIMIT 20;
```

### Análise por categoria de serviço
```sql
SELECT
    CASE
        WHEN product_name LIKE 'CIA_SERV_%' THEN 'Serviço'
        WHEN product_name LIKE 'CIA_LOC_%' THEN 'Locação'
        WHEN product_name LIKE 'CIA_%' THEN 'Outros CIA'
        WHEN product_name LIKE '%FILTRO%' THEN 'Filtros'
        ELSE 'Componentes'
    END as category,
    COUNT(*) as count
FROM sales,
    jsonb_array_elements(products) as p
GROUP BY category;
```

---
*Documento gerado em: 06/10/2025*
*Fonte: Análise dos dados Ploomes exportados*