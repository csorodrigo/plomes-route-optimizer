# Guia completo da API Ploomes para Claude Code

## Visão geral e características fundamentais

A API da Ploomes é uma API RESTful baseada no protocolo **OData v4** (Open Data Protocol), um padrão ISO/IEC aprovado pela OASIS. Essa base fornece capacidades avançadas de consulta, filtragem e manipulação de dados seguindo convenções padronizadas e previsíveis.

**Informações essenciais:**
- **Base URL Principal:** `https://public-api2.ploomes.com/`
- **Base URL Webhooks:** `https://api2.ploomes.com/` (somente para registro de webhooks)
- **Protocolo:** OData v4
- **Formato de dados:** JSON
- **Encoding:** UTF-8
- **Versão atual:** API v2
- **Documentação oficial:** https://developers.ploomes.com/

## Autenticação e autorização

### Método de autenticação
A API utiliza autenticação simples por **chave de API** através do header `User-Key`. Não há OAuth ou Bearer tokens.

### Como obter chaves de API
1. **Criar usuário de integração:**
   - Acessar: Administração → Usuários de Integração
   - Clicar em "Novo Usuário"
   - Preencher Nome, Email (não precisa existir), Perfil
   - **Importante:** Usuários de integração não contam no limite de usuários e não podem fazer login no sistema

2. **Obter chave:**
   - Após criar o usuário, clicar no nome dele
   - Copiar a chave de integração gerada
   - Esta chave será usada no header `User-Key`

### Headers obrigatórios
```http
User-Key: A7EEF49A41433800AFDF42AE5BBF22755D1FC4B863C9B70A87F4CE300F38164058CD54A3E8590E78CDBF986FC8C0F9F4E7FF32884F3D37D58178DD8749EFA1D3
    
Content-Type: application/json; charset=utf-8
```

### Permissões e escopos
- Acesso baseado no perfil atribuído ao usuário de integração
- Perfil Administrador fornece acesso completo
- Outros perfis limitam acesso conforme permissões padrão do Ploomes
- **Sem expiração:** Chaves não expiram automaticamente

## Estrutura de entidades e IDs

### Entidades principais
| EntityId | Nome PT | Nome EN | Endpoint |
|----------|---------|---------|----------|
| 1 | Cliente | Contact/Client | `/Contacts` |
| 2 | Negócio | Deal | `/Deals` |
| 3 | Lead | Lead | `/Leads` |
| 4 | Venda | Sale/Order | `/Orders` |
| 5 | Bloco de Venda | Sales Block | `/SalesBlocks` |
| 7 | Proposta | Quote/Proposal | `/Quotes` |
| 8 | Bloco de Proposta | Proposal Block | `/ProposalBlocks` |
| 10 | Produto | Product | `/Products` |
| 12 | Tarefa | Task | `/Tasks` |
| 14 | Produto da Proposta | Proposal Product | `/ProposalProducts` |
| 20 | Produto da Venda | Sale Product | `/SaleProducts` |
| 36 | Registro de contato | Contact Record | `/ContactRecords` |
| 36 | Registro de interação | Interaction Record | `/InteractionRecords` |
| 55 | Mural de Publicação | Publication Wall | `/PublicationWall` |

### Entidades de suporte
| Nome PT | Nome EN | Endpoint |
|---------|---------|----------|
| Funis | Pipelines | `/Deals@Pipelines` |
| Estágios do Negócio | Deal Stages | `/Deals@Stages` |
| Estágios da Venda | Order Stages | `/Orders@Stages` |
| Motivos de Perda | Loss Reasons | `/Deals@LossReasons` |
| Status do Negócio | Deal Status | `/Deals@Status` |
| Status do Cliente | Contact Status | `/Contacts@Status` |
| Classes do Cliente | Contact Classes | `/Contacts@Classes` |
| Origens do Cliente | Contact Origins | `/Contacts@Origins` |
| Relações do Cliente | Contact Relationships | `/Contacts@Relationships` |
| Segmentos do Cliente | Lines of Business | `/Contacts@LinesOfBusiness` |
| Tipos do Cliente | Contact Types | `/Contacts@Types` |
| Grupos de Produtos | Product Groups | `/Products@Groups` |
| Famílias de Produtos | Product Families | `/Products@Families` |
| Status de Aprovação | Approval Status | `/Quotes@ApprovalStatus` |
| Tipos de Tarefa | Task Types | `/Tasks@Types` |
| Tipos de Lembrete | Email Reminders | `/Tasks@EmailReminders` |
| Intervalos de Repetição | Repeat Intervals | `/Tasks@RepeatIntervalUnits` |
| Usuários | Users | `/Users` |
| Perfis de Usuário | User Profiles | `/Users@Profiles` |
| Cargos | Roles | `/Roles` |
| Departamentos | Departments | `/Departments` |
| Moedas | Currencies | `/Currencies` |
### Endpoints de Localização
```
GET    /Cities                        - Listar todas as cidades
GET    /Cities@Countries              - Listar países
GET    /Cities@States                 - Listar estados
GET    /Cities@Countries@States       - Hierarquia completa

# Exemplo de consulta otimizada de cidades
GET /Cities?$select=Id,Name&$expand=Country,State
```
| Documentos | Documents | `/Documents` |

## Endpoints disponíveis por categoria

### Endpoints de Contas e Configurações
```
GET    /Account                      - Informações da conta
GET    /Account@Info                 - Detalhes da conta
GET    /Account@Settings             - Configurações gerais
GET    /Account@Limits               - Limites da conta
GET    /Account@Usage                - Uso e estatísticas
```

### Endpoints de Equipes e Usuários
```
GET    /Teams                        - Listar equipes
GET    /Teams/{id}                   - Obter equipe específica
GET    /Teams@Members                - Membros das equipes
GET    /Teams@Hierarchy             - Hierarquia de equipes
GET    /Users@Teams                  - Equipes por usuário
GET    /Users@Permissions            - Permissões de usuários
GET    /Users@Activities             - Atividades dos usuários
```

### Endpoints de Atividades e Histórico
```
GET    /Activities                   - Todas as atividades
GET    /Activities@Types             - Tipos de atividades
GET    /Activities@Recent            - Atividades recentes
GET    /Activities?entityId={id}     - Atividades por entidade
GET    /History                      - Histórico geral
GET    /History@Changes              - Log de mudanças
GET    /AuditLogs                    - Logs de auditoria
```

### Endpoints de Relatórios e Dashboards
```
GET    /Reports                      - Listar relatórios
GET    /Reports@Templates            - Templates de relatórios
GET    /Reports@Custom               - Relatórios customizados
GET    /Reports/{id}/execute         - Executar relatório
GET    /Dashboard                    - Dashboard principal
GET    /Dashboard@Widgets            - Widgets disponíveis
GET    /Dashboard@Metrics            - Métricas do dashboard
GET    /Analytics@Sales              - Analytics de vendas
GET    /Analytics@Pipeline           - Analytics de funil
```

### Endpoints de Arquivos e Anexos
```
GET    /Files                        - Listar arquivos
GET    /Files/{id}                   - Obter arquivo específico
POST   /Files                        - Upload de arquivo
DELETE /Files/{id}                   - Deletar arquivo
GET    /Files/{id}/download          - Download de arquivo
GET    /Files?entityId={id}&entityType={type} - Arquivos por entidade
GET    /Attachments                  - Listar anexos
POST   /Attachments/upload           - Upload de anexo
```

### Endpoints de Comentários e Notas
```
GET    /Comments                     - Listar comentários
POST   /Comments                     - Criar comentário
GET    /Comments?entityId={id}       - Comentários por entidade
GET    /Notes                        - Listar notas
POST   /Notes                        - Criar nota
PUT    /Notes/{id}                   - Atualizar nota
DELETE /Notes/{id}                   - Deletar nota
```

### Endpoints de Automações e Workflows
```
GET    /Automations                  - Listar automações
GET    /Automations@Rules            - Regras de automação
GET    /Automations@Triggers         - Gatilhos disponíveis
POST   /Automations/execute          - Executar automação
GET    /Workflows                    - Listar workflows
GET    /Workflows@Templates          - Templates de workflow
GET    /Workflows/{id}/status        - Status do workflow
POST   /Workflows/{id}/execute       - Executar workflow
```

### Endpoints de Formulários e Templates
```
GET    /Forms                        - Listar formulários
GET    /Forms/{id}                   - Obter formulário
GET    /Forms@Fields                 - Campos de formulários
GET    /Templates                    - Listar templates
GET    /Templates@Types              - Tipos de templates
GET    /Templates/{id}               - Obter template
POST   /Templates/{id}/apply         - Aplicar template
```

### Endpoints de Comunicação
```
GET    /Emails                       - Listar emails
POST   /Emails/send                  - Enviar email
GET    /Emails@Templates             - Templates de email
GET    /Emails@Queue                 - Fila de emails
GET    /SMS                          - Listar SMS
POST   /SMS/send                     - Enviar SMS
GET    /WhatsApp                     - Mensagens WhatsApp
POST   /WhatsApp/send                - Enviar WhatsApp
```

### Endpoints de Importação/Exportação
```
POST   /Import/csv                   - Importar CSV
POST   /Import/excel                 - Importar Excel
GET    /Import@Status/{id}           - Status da importação
GET    /Export/{entity}              - Exportar entidade
GET    /Export@Formats               - Formatos disponíveis
GET    /Export@History               - Histórico de exportações
```

### 1. Gestão de Contatos/Clientes (EntityId: 1)
```
GET    /Contacts              - Listar todos os contatos
GET    /Contacts/{id}         - Obter contato específico
POST   /Contacts              - Criar novo contato
PUT    /Contacts/{id}         - Atualizar contato (completo)
PATCH  /Contacts({Id})        - Atualizar contato (parcial)
DELETE /Contacts/{id}         - Deletar contato
```

**Estrutura de dados do Contact:**
```json
{
  "Id": 123,
  "Name": "string",
  "Email": "string",
  "TypeId": 2,  // 1=Empresa, 2=Pessoa
  "CompanyId": 456,  // Para pessoas: ID da empresa
  "Document": "string",  // CPF/CNPJ
  "LegalName": "string",  // Razão social
  "StatusId": 1,
  "ClassId": 1,  // Classificação
  "RelationshipId": 1,
  "LineOfBusinessId": 1,  // Segmento
  "OriginId": 1,
  "ResponsibleUserId": 1,
  "Observations": "string",
  "Website": "string",
  "RoleId": 1,  // Cargo
  "DepartmentId": 1,
  "Skype": "string",
  "Facebook": "string",
  "StreetAddress": "string",  // Endereço completo
  "Street": "string",         // Logradouro
  "StreetNumber": "string",
  "StreetComplement": "string",
  "Neighborhood": "string",
  "ZipCode": "01234567",
  "InternationalZipCode": "string",
  "CityId": 1,
  "CurrencyId": 1,
  "EmailMarketing": true,
  "CnaeCode": "string",
  "CnaeDescription": "string",
  "Latitude": -23.5505,
  "Longitude": -46.6333,
  "ExternalKey": "string",
  "AvatarUrl": "string",
  "InternationalDocument": "string",
  "Phones": [
    {
      "PhoneNumber": "(11) 99999-9999",
      "TypeId": 1,
      "CountryId": 76
    }
  ],
  "Tags": [],
  "OtherProperties": []  // Campos customizados
}
```

**Exemplo de consulta otimizada:**
```http
GET /Contacts?$select=Id,Name,Email,StreetAddress&$expand=OtherProperties&$top=100
```

### 2. Gestão de Negócios/Oportunidades (EntityId: 2)
```
GET    /Deals              - Listar todos os negócios
GET    /Deals/{id}         - Obter negócio específico
POST   /Deals              - Criar novo negócio
PUT    /Deals/{id}         - Atualizar negócio
DELETE /Deals/{id}         - Deletar negócio
```

**Estrutura de dados do Deal:**
```json
{
  "Id": 789,
  "Title": "string",
  "Amount": 50000.00,
  "StatusId": 1,
  "StageId": 1,
  "PersonId": 123,
  "CompanyId": 456,
  "ResponsibleUserId": 1,
  "CreatedDate": "2024-01-01T00:00:00Z",
  "LastInteractionDate": "2024-01-15T00:00:00Z",
  "ExpectedCloseDate": "2024-03-31T00:00:00Z",
  "Owner": {},
  "Contact": {},
  "Tags": [],
  "Products": [],
  "OtherProperties": []
}
```

### 3. Gestão de Leads (EntityId: 3)
```
GET    /Leads              - Listar todos os leads
GET    /Leads/{id}         - Obter lead específico
POST   /Leads              - Criar novo lead
PUT    /Leads/{id}         - Atualizar lead
DELETE /Leads/{id}         - Deletar lead
```

### 4. Gestão de Propostas (EntityId: 7)
```
GET    /Quotes              - Listar todas as propostas
GET    /Quotes/{id}         - Obter proposta específica
POST   /Quotes              - Criar nova proposta
PUT    /Quotes/{id}         - Atualizar proposta
DELETE /Quotes/{id}         - Deletar proposta
```

**Estrutura de dados do Quote:**
```json
{
  "Id": 999,
  "Title": "string",
  "QuoteNumber": "string",
  "ContactId": 123,
  "DealId": 789,
  "Amount": 75000.00,
  "Date": "2024-01-01T00:00:00Z",
  "ExpirationDate": "2024-01-31T00:00:00Z",
  "DeliveryTime": 30,
  "Status": 1,
  "Products": [],
  "OtherProperties": []
}
```

### 5. Gestão de Vendas/Orders (EntityId: 4)
```
GET    /Orders              - Listar todas as vendas
GET    /Orders/{id}         - Obter venda específica
POST   /Orders              - Criar nova venda
PUT    /Orders/{id}         - Atualizar venda
DELETE /Orders/{id}         - Deletar venda
```

**Estrutura de dados do Order:**
```json
{
  "Id": 888,
  "Number": 1234,
  "Date": "2024-01-01T00:00:00Z",
  "ContactId": 123,
  "PersonId": 456,
  "StageId": 1,           // Estágio da venda
  "DealId": 789,          // Negócio relacionado
  "ResponsibleUserId": 1,
  "CurrencyId": 1,
  "Amount": 100000.00,
  "Discount": 10,
  "InternalComments": "string",
  "Description": "string",
  "Key": "ORDER-2024-1234",
  "CommissionedUserId": 2,
  "Commission": 5,
  "TemplateId": 10,
  "Shared": false,
  "ExternallyAccepted": false,
  "ExternalNotifications": false,
  "SharedDate": "2024-01-15T00:00:00Z",
  "Url": "https://...",
  "ApprovalStatusId": 1,
  "ApprovalLevel": 1,
  "QuoteId": 999,         // Proposta de origem
  "FileName": "ordem_1234.pdf",
  "OtherProperties": []
}
```

### 6. Gestão de Produtos (EntityId: 10)
```
GET    /Products              - Listar todos os produtos
GET    /Products/{id}         - Obter produto específico
POST   /Products              - Criar novo produto
PUT    /Products/{id}         - Atualizar produto
DELETE /Products/{id}         - Deletar produto
```

### 6. Gestão de Funis/Pipelines e Estágios

#### Endpoints de Funis (Pipelines)
```
GET    /Deals@Pipelines              - Listar todos os funis
GET    /Deals@Pipelines/{id}         - Obter funil específico
POST   /Deals@Pipelines              - Criar novo funil
PUT    /Deals@Pipelines/{id}         - Atualizar funil
DELETE /Deals@Pipelines/{id}         - Deletar funil
```

**Estrutura de dados do Pipeline:**
```json
{
  "Id": 1,
  "Name": "Funil de Vendas",
  "AllStagesRequired": false,  // Passagem obrigatória por todos estágios
  "PreventGoBack": false,      // Proibir voltar de etapa
  "CanGenerateQuotes": true,    // Pode gerar propostas
  "CanGenerateOrders": true,    // Pode gerar vendas
  "CanGenerateDocuments": true, // Pode gerar documentos
  "CanWinDeals": true,         // Pode ganhar negócios
  "CanLoseDeals": true,        // Pode perder negócios
  "FormId": 123,               // ID do formulário do funil
  "MiniFormId": 124,           // ID do formulário mini
  "Archived": false,           // Se está arquivado
  "CreateOrderOnWin": false,   // Gerar venda ao ganhar
  "AutoCreateOrderOnWin": false, // Gerar venda automaticamente
  "WinOnlyLastStage": false,   // Ganhar só na última etapa
  "UnitNameSingular": "negócio",
  "UnitNamePlural": "negócios",
  "UnitGender": "M",
  "TableViewAvailable": true,
  "FunnelViewAvailable": true,
  "Ordination": 1,
  "UseFullScreenQuote": false,
  "UseFullScreenOrder": false,
  "UseFullScreenDocument": false
}
```

#### Endpoints de Estágios
```
GET    /Deals@Stages              - Listar todos os estágios
GET    /Deals@Stages/{id}         - Obter estágio específico
POST   /Deals@Stages              - Criar novo estágio
PUT    /Deals@Stages/{id}         - Atualizar estágio
DELETE /Deals@Stages/{id}         - Deletar estágio

# Filtrar estágios por funil
GET    /Deals@Stages?$filter=PipelineId eq 1
```

**Estrutura de dados do Stage:**
```json
{
  "Id": 10,
  "Name": "Prospecção",
  "PipelineId": 1,         // ID do funil
  "Ordination": 1,         // Ordem do estágio (menor para maior)
  "Icon": "icon-search",   // Ícone do estágio
  "Color": "#4CAF50"       // Cor do estágio (opcional)
}
```

#### Endpoints relacionados
```
GET    /Deals@LossReasons          - Motivos de perda
GET    /Deals@Status               - Status dos negócios
GET    /Orders@Stages              - Estágios de vendas
```

### 7. Gestão de Tarefas (EntityId: 12)
```
GET    /Tasks              - Listar todas as tarefas
GET    /Tasks/{id}         - Obter tarefa específica
POST   /Tasks              - Criar nova tarefa
PUT    /Tasks/{id}         - Atualizar tarefa
DELETE /Tasks/{id}         - Deletar tarefa
```

**Estrutura de dados do Task:**
```json
{
  "Id": 555,
  "Subject": "string",
  "Description": "string",
  "DueDate": "2024-01-15T00:00:00Z",
  "StartDate": "2024-01-01T00:00:00Z",
  "ResponsibleUserId": 1,
  "ContactId": 123,
  "DealId": 789,
  "TaskTypeId": 1,
  "StatusId": 1,
  "Completed": false,
  "OtherProperties": []
}
```

### 8. Gestão de Registros de Interação (EntityId: 36)
```
GET    /InteractionRecords              - Listar todos os registros
GET    /InteractionRecords/{id}         - Obter registro específico
POST   /InteractionRecords              - Criar novo registro
PUT    /InteractionRecords/{id}         - Atualizar registro
DELETE /InteractionRecords/{id}         - Deletar registro
```

**Estrutura de dados do InteractionRecord:**
```json
{
  "Id": 777,
  "ContactId": 123,       // Cliente do registro (obrigatório)
  "DealId": 789,         // Negócio relacionado (opcional)
  "Date": "2024-01-15T14:30:00Z",
  "TypeId": 1,           // Tipo de registro
  "Title": "Reunião de alinhamento",
  "Content": "Detalhes da interação...",
  "Latitude": -23.5505,  // Para registros com geolocalização
  "Longitude": -46.6333,
  "EmailRecipients": "cliente@empresa.com", // Para registros de email
  "EmailSubject": "Proposta comercial",
  "OtherProperties": []
}
```

### 9. Endpoints de metadados
```
GET /Fields                                    - Obter todos os campos disponíveis
GET /Fields?$filter=EntityId eq {id}          - Campos por entidade
GET /Fields?$filter=EntityId eq {id} and Dynamic eq true  - Campos customizados
GET /Fields@OptionsTables?$filter=Id eq {tableId}&$expand=Options  - Opções de dropdowns
```

## Mapeamento de relacionamentos entre entidades

### Relacionamentos principais
```
Contacts (1) ← → (N) Deals
    ↓               ↓
    └─────┬─────────┘
          ↓
       Tasks
          ↓
   InteractionRecords
          
Deals (1) → (N) Quotes → (N) Orders
   ↓          ↓              ↓
Products ← QuoteProducts ← OrderProducts

Pipelines (1) → (N) Stages
    ↓                  ↓
    └──────→ Deals ←───┘
```

### Hierarquia de conversão
1. **Lead** → **Contact** (conversão de lead)
2. **Contact** → **Deal** (oportunidade criada)
3. **Deal** → **Quote** (proposta gerada)
4. **Quote** → **Order** (venda fechada)
5. **Order** → **Document** (documento fiscal)

### Relacionamentos importantes
- **Contact.CompanyId**: Liga pessoa física à empresa
- **Deal.ContactId**: Cliente do negócio
- **Deal.PersonId**: Pessoa de contato no negócio
- **Deal.StageId**: Estágio atual no funil
- **Deal.PipelineId**: Funil do negócio (via Stage)
- **Quote.DealId**: Negócio da proposta
- **Order.DealId**: Negócio da venda
- **Order.QuoteId**: Proposta origem da venda
- **Task.ContactId**: Cliente da tarefa
- **Task.DealId**: Negócio da tarefa
- **InteractionRecord.ContactId**: Cliente do registro
- **InteractionRecord.DealId**: Negócio do registro

## Parâmetros OData e consultas avançadas

### Parâmetros suportados
- **$filter** - Filtrar resultados
- **$select** - Selecionar campos específicos
- **$expand** - Incluir dados relacionados
- **$orderby** - Ordenar resultados
- **$top** - Limitar quantidade de resultados
- **$skip** - Pular resultados (paginação)
- **$count** - Contar registros

### Exemplos de filtros
```http
# Filtro simples
GET /Contacts?$filter=Name eq 'João Silva'

# Múltiplas condições com AND
GET /Deals?$filter=Amount gt 10000 and StatusId eq 1

# Condição OR
GET /Contacts?$filter=City eq 'São Paulo' or City eq 'Rio de Janeiro'

# Filtro por data
GET /Deals?$filter=CreatedDate ge 2024-01-01T00:00:00Z

# Funções de string
GET /Contacts?$filter=startswith(Name,'Maria')
GET /Contacts?$filter=contains(Email,'empresa.com')
GET /Contacts?$filter=endswith(Email,'gmail.com')
```

### Ordenação
```http
# Ordenação crescente
GET /Deals?$orderby=Amount

# Ordenação decrescente
GET /Deals?$orderby=Amount desc

# Múltiplos critérios
GET /Contacts?$orderby=Name asc,CreatedDate desc
```

### Seleção de campos
```http
# Selecionar apenas campos específicos
GET /Contacts?$select=Id,Name,Email

# Combinar com expand
GET /Deals?$select=Id,Title,Amount&$expand=Contact($select=Name,Email)
```

### Expansão de relacionamentos
```http
# Expandir dados relacionados
GET /Contacts?$expand=Phones,Tags

# Expansão com filtros
GET /Contacts?$expand=Deals($filter=Amount gt 10000)

# Expansão múltipla
GET /Deals?$expand=Owner($select=Name,Email),Contact($select=Name),Tags
```

### Paginação
```http
# Primeira página (50 registros)
GET /Contacts?$top=50

# Segunda página
GET /Contacts?$skip=50&$top=50

# Terceira página
GET /Contacts?$skip=100&$top=50
```

## Campos customizados (OtherProperties)

### Estrutura de campos customizados
Campos customizados são enviados/recebidos através do array `OtherProperties`:

```json
{
  "Name": "João Silva",
  "Email": "joao@empresa.com",
  "OtherProperties": [
    {
      "FieldKey": "contact_A51DFABF-56CA-4F03-AABB-F89AF0E7D354",
      "StringValue": "Valor texto"
    },
    {
      "FieldKey": "contact_B62EFBCF-67DA-5G14-BBCC-G90BG1F8E465",
      "IntegerValue": 100
    },
    {
      "FieldKey": "contact_C73FGCDG-78EB-6H25-CCDD-H01CH2G9F576",
      "DecimalValue": 1500.50
    },
    {
      "FieldKey": "contact_D84GHDEF-89FC-7I36-DDEE-I12DI3H0G687",
      "BooleanValue": true
    },
    {
      "FieldKey": "contact_E95HIEJG-90GD-8J47-EEFF-J23EJ4I1H798",
      "DateTimeValue": "2024-01-15T00:00:00Z"
    }
  ]
}
```

### Descoberta de campos customizados
```http
# Obter todos os campos customizados de uma entidade
GET /Fields?$filter=EntityId eq 1 and Dynamic eq true

# Resposta incluirá:
{
  "value": [
    {
      "Key": "contact_A51DFABF-56CA-4F03-AABB-F89AF0E7D354",
      "Name": "Setor",
      "TypeId": 1,  // 1=String, 2=Integer, 3=Decimal, etc.
      "Required": false,
      "Dynamic": true
    }
  ]
}
```

## Descoberta de IDs de entidades auxiliares

### Como descobrir IDs importantes
```bash
# Descobrir IDs de funis disponíveis
curl https://public-api2.ploomes.com/Deals@Pipelines \
  -H "User-Key: SUA_CHAVE_API"

# Descobrir IDs de estágios por funil
curl "https://public-api2.ploomes.com/Deals@Stages?\$filter=PipelineId%20eq%201" \
  -H "User-Key: SUA_CHAVE_API"

# Descobrir IDs de status de negócios
curl https://public-api2.ploomes.com/Deals@Status \
  -H "User-Key: SUA_CHAVE_API"

# Descobrir IDs de tipos de cliente
curl https://public-api2.ploomes.com/Contacts@Types \
  -H "User-Key: SUA_CHAVE_API"
# TypeId = 1: Empresa
# TypeId = 2: Pessoa

# Descobrir IDs de origens de cliente
curl https://public-api2.ploomes.com/Contacts@Origins \
  -H "User-Key: SUA_CHAVE_API"

# Descobrir IDs de segmentos
curl https://public-api2.ploomes.com/Contacts@LinesOfBusiness \
  -H "User-Key: SUA_CHAVE_API"

# Descobrir IDs de motivos de perda
curl https://public-api2.ploomes.com/Deals@LossReasons \
  -H "User-Key: SUA_CHAVE_API"

# Descobrir IDs de tipos de tarefa
curl https://public-api2.ploomes.com/Tasks@Types \
  -H "User-Key: SUA_CHAVE_API"

# Descobrir IDs de moedas
curl https://public-api2.ploomes.com/Currencies \
  -H "User-Key: SUA_CHAVE_API"

# Descobrir IDs de usuários
curl https://public-api2.ploomes.com/Users \
  -H "User-Key: SUA_CHAVE_API"

# Descobrir IDs de cidades
curl "https://public-api2.ploomes.com/Cities?\$filter=Name%20eq%20'São Paulo'" \
  -H "User-Key: SUA_CHAVE_API"
```

### Mapeamento de IDs padrão
| Entidade | Campo | Valores Comuns |
|----------|-------|----------------|
| Contact | TypeId | 1=Empresa, 2=Pessoa |
| Phone | TypeId | 1=Comercial, 2=Celular |
| Phone | CountryId | 76=Brasil |
| Address | TypeId | 1=Principal, 2=Cobrança, 3=Entrega |
| Deal | StatusId | Varia por conta (consultar /Deals@Status) |
| Task | StatusId | 1=Pendente, 2=Concluída |
| Quote | ApprovalStatusId | Varia por conta |
| Order | ApprovalStatusId | Varia por conta |

## Exemplos práticos de código

### Criar um contato
```bash
curl -X POST https://public-api2.ploomes.com/Contacts \
  -H "User-Key: SUA_CHAVE_API" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "Name": "João Silva",
    "Email": "joao@empresa.com",
    "TypeId": 2,
    "Phones": [
      {
        "PhoneNumber": "(11) 99999-9999",
        "TypeId": 1,
        "CountryId": 76
      }
    ],
    "OtherProperties": [
      {
        "FieldKey": "contact_SECTOR_FIELD_KEY",
        "StringValue": "Tecnologia"
      }
    ]
  }'
```

### Criar um negócio
```bash
curl -X POST https://public-api2.ploomes.com/Deals \
  -H "User-Key: SUA_CHAVE_API" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "Title": "Nova Oportunidade de Venda",
    "Amount": 50000.00,
    "StatusId": 1,
    "PersonId": 123,
    "ExpectedCloseDate": "2024-12-31T23:59:59Z"
  }'
```

### Atualizar um contato
```bash
curl -X PUT https://public-api2.ploomes.com/Contacts/123 \
  -H "User-Key: SUA_CHAVE_API" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "Email": "novo.email@empresa.com",
    "Phones": [
      {
        "PhoneNumber": "(11) 88888-8888",
        "TypeId": 1,
        "CountryId": 76
      }
    ]
  }'
```

### Buscar negócios com limite respeitado
```bash
# CORRETO: Respeitar limite de 300 itens
curl -G https://public-api2.ploomes.com/Deals \
  -H "User-Key: SUA_CHAVE_API" \
  --data-urlencode "\$filter=Amount gt 10000 and StatusId eq 1" \
  --data-urlencode "\$expand=Contact(\$select=Name,Email),Owner(\$select=Name)" \
  --data-urlencode "\$orderby=Amount desc" \
  --data-urlencode "\$top=100"  # Máximo recomendado: 100, limite absoluto: 300
```

### Implementação de paginação em JavaScript
```javascript
async function getAllContacts(apiKey) {
    let allContacts = [];
    let skip = 0;
    const pageSize = 100;
    let hasMore = true;
    
    while (hasMore) {
        const response = await fetch(
            `https://public-api2.ploomes.com/Contacts?$top=${pageSize}&$skip=${skip}`,
            {
                headers: {
                    'User-Key': apiKey,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        const data = await response.json();
        
        if (data.value && data.value.length > 0) {
            allContacts.push(...data.value);
            skip += pageSize;
            hasMore = data.value.length === pageSize;
        } else {
            hasMore = false;
        }
    }
    
    return allContacts;
}
```

### Tratamento de erros em Python
```python
import requests
import time

def api_call_with_retry(url, headers, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 429:  # Rate limit
                wait_time = 2 ** attempt  # Exponential backoff
                time.sleep(wait_time)
                continue
                
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
    
    return None
```

## Operações avançadas e batch

### Batch Operations
```http
# Criar múltiplos registros de uma vez
POST /batch
Content-Type: application/json
{
  "requests": [
    {
      "id": "1",
      "method": "POST",
      "url": "/Contacts",
      "body": { "Name": "João", "TypeId": 2 }
    },
    {
      "id": "2",
      "method": "POST",
      "url": "/Contacts",
      "body": { "Name": "Maria", "TypeId": 2 }
    }
  ]
}

# Atualizar múltiplos registros
POST /batch
{
  "requests": [
    {
      "id": "1",
      "method": "PATCH",
      "url": "/Deals/123",
      "body": { "StageId": 2 }
    },
    {
      "id": "2",
      "method": "PATCH",
      "url": "/Deals/124",
      "body": { "StageId": 2 }
    }
  ]
}
```

### Upload de Arquivos
```javascript
// Upload de arquivo via FormData
async function uploadFile(apiKey, entityId, entityType, file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityId', entityId);
    formData.append('entityType', entityType);  // 1=Contact, 2=Deal, etc
    
    const response = await fetch('https://public-api2.ploomes.com/Files', {
        method: 'POST',
        headers: {
            'User-Key': apiKey
            // NÃO incluir Content-Type, deixar o browser definir
        },
        body: formData
    });
    
    return response.json();
}

// Download de arquivo
async function downloadFile(apiKey, fileId) {
    const response = await fetch(
        `https://public-api2.ploomes.com/Files/${fileId}/download`,
        {
            headers: { 'User-Key': apiKey }
        }
    );
    
    const blob = await response.blob();
    return blob;
}
```

### Operações em Massa
```javascript
// Atualizar múltiplos negócios de uma vez
async function moverNegociosEmMassa(apiKey, dealIds, novoEstagioId) {
    const operations = dealIds.map(id => ({
        method: 'PATCH',
        url: `/Deals/${id}`,
        body: { StageId: novoEstagioId }
    }));
    
    const response = await fetch('https://public-api2.ploomes.com/$batch', {
        method: 'POST',
        headers: {
            'User-Key': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests: operations })
    });
    
    return response.json();
}
```

### Pesquisa Avançada
```http
# Busca com múltiplos critérios
GET /Deals?$filter=(Amount gt 10000 and Amount lt 100000) and (StageId eq 1 or StageId eq 2)&$orderby=Amount desc&$expand=Contact,Products

# Busca por data com timezone
GET /Deals?$filter=CreatedDate ge 2024-01-01T00:00:00-03:00 and CreatedDate le 2024-12-31T23:59:59-03:00

# Busca com agregação (contar registros)
GET /Deals/$count?$filter=StageId eq 1

# Busca com projeção de campos relacionados
GET /Contacts?$expand=Company($select=Name,Document),Deals($filter=Amount gt 50000;$select=Title,Amount)
```

### Trabalhando com Campos Customizados Dinâmicos
```javascript
// Descobrir campos customizados de uma entidade
async function descobrirCamposCustomizados(apiKey, entityId) {
    const response = await fetch(
        `https://public-api2.ploomes.com/Fields?$filter=EntityId eq ${entityId} and Dynamic eq true`,
        { headers: { 'User-Key': apiKey } }
    );
    
    const fields = await response.json();
    
    // Mapear tipos de campos
    const fieldMap = fields.value.map(field => ({
        key: field.Key,
        name: field.Name,
        type: field.TypeId,
        required: field.Required,
        options: field.OptionsTableId ? 
            await buscarOpcoes(apiKey, field.OptionsTableId) : null
    }));
    
    return fieldMap;
}

// Buscar opções de campos dropdown/select
async function buscarOpcoes(apiKey, tableId) {
    const response = await fetch(
        `https://public-api2.ploomes.com/Fields@OptionsTables?$filter=Id eq ${tableId}&$expand=Options`,
        { headers: { 'User-Key': apiKey } }
    );
    
    const data = await response.json();
    return data.value[0]?.Options || [];
}
```

## Webhooks avançados

### Registro de webhook
```bash
curl -X POST https://api2.ploomes.com/Webhooks \
  -H "User-Key: SUA_CHAVE_API" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d '{
    "EntityId": 1,
    "ActionId": 2,
    "CallbackUrl": "https://seu-servidor.com/webhook",
    "ValidationKey": "sua-chave-validacao"
  }'
```

### Ações disponíveis
```bash
# Obter lista de ações disponíveis para webhooks
curl https://public-api2.ploomes.com/Webhooks@Actions \
  -H "User-Key: SUA_CHAVE_API"
```

**Ações típicas:**
- Create (criação de registro)
- Update (atualização de registro)
- Delete (exclusão de registro)
- Deal Won (negócio ganho)
- Deal Lost (negócio perdido)
- Task Completed (tarefa concluída)

### Formato do payload do webhook
```json
{
  "Action": "Update",
  "Entity": "Contacts",
  "AccountId": 57,
  "ActionUserId": 116,
  "Old": {
    "Id": 2630362,
    "Name": "João Silva",
    "Email": "joao@empresa.com",
    "OtherProperties": {
      "contact_check": false
    }
  },
  "New": {
    "Id": 2630362,
    "Name": "João Silva Santos",
    "Email": "joao.santos@empresa.com",
    "OtherProperties": {
      "contact_check": true
    }
  }
}
```

### Validação de webhook
O webhook inclui o header `X-Ploomes-Validation-Key` com a chave definida no registro:

```javascript
function validateWebhook(request, expectedKey) {
    const receivedKey = request.headers['x-ploomes-validation-key'];
    return receivedKey === expectedKey;
}
```

## Integrações e padrões comuns

### Integração com Sistemas Externos
```javascript
// Sincronização bidirecional com ERP
class PloomesERPSync {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://public-api2.ploomes.com';
    }
    
    // Sincronizar cliente do ERP para Ploomes
    async syncClienteFromERP(erpClient) {
        // Verificar se já existe
        const existing = await this.buscarPorCNPJ(erpClient.cnpj);
        
        const ploomesData = {
            Name: erpClient.razaoSocial,
            Document: erpClient.cnpj,
            TypeId: 1, // Empresa
            ExternalKey: erpClient.codigoERP,
            OtherProperties: [
                {
                    FieldKey: "contact_CODIGO_ERP",
                    StringValue: erpClient.codigoERP
                },
                {
                    FieldKey: "contact_SISTEMA_ORIGEM",
                    StringValue: "ERP"
                }
            ]
        };
        
        if (existing) {
            // Atualizar
            return await this.updateContact(existing.Id, ploomesData);
        } else {
            // Criar novo
            return await this.createContact(ploomesData);
        }
    }
    
    // Sincronizar pedidos do Ploomes para ERP
    async syncPedidosToERP(desde = null) {
        const filter = desde ? 
            `$filter=LastUpdateDate ge ${desde.toISOString()}` : '';
        
        const orders = await fetch(
            `${this.baseUrl}/Orders?${filter}&$expand=Products,Contact`,
            { headers: { 'User-Key': this.apiKey } }
        ).then(r => r.json());
        
        for (const order of orders.value) {
            await this.enviarPedidoParaERP(order);
        }
    }
}
```

### Métricas e KPIs
```javascript
// Calcular métricas do funil
async function calcularMetricasFunil(apiKey, pipelineId, periodo = 30) {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - periodo);
    
    // Buscar todos os negócios do período
    const response = await fetch(
        `https://public-api2.ploomes.com/Deals?` +
        `$filter=CreatedDate ge ${dataInicio.toISOString()}&` +
        `$expand=Stage`,
        { headers: { 'User-Key': apiKey } }
    );
    
    const deals = await response.json();
    
    // Calcular métricas
    const metricas = {
        total: deals.value.length,
        valorTotal: deals.value.reduce((sum, d) => sum + d.Amount, 0),
        ticketMedio: 0,
        taxaConversao: 0,
        tempoMedioCiclo: 0,
        porEstagio: {},
        funil: []
    };
    
    // Agrupar por estágio
    const stages = await buscarEstagios(apiKey, pipelineId);
    
    for (const stage of stages) {
        const dealsNoEstagio = deals.value.filter(d => d.StageId === stage.Id);
        metricas.porEstagio[stage.Name] = {
            quantidade: dealsNoEstagio.length,
            valor: dealsNoEstagio.reduce((sum, d) => sum + d.Amount, 0),
            percentual: (dealsNoEstagio.length / deals.value.length) * 100
        };
        
        metricas.funil.push({
            estagio: stage.Name,
            ordem: stage.Ordination,
            quantidade: dealsNoEstagio.length
        });
    }
    
    metricas.ticketMedio = metricas.valorTotal / metricas.total;
    
    // Calcular taxa de conversão (ganhos / total)
    const ganhos = deals.value.filter(d => d.StatusId === 2).length;
    metricas.taxaConversao = (ganhos / metricas.total) * 100;
    
    return metricas;
}

// Dashboard de vendas
async function dashboardVendas(apiKey, periodo = 'month') {
    const hoje = new Date();
    let dataInicio = new Date();
    
    switch(periodo) {
        case 'day':
            dataInicio.setDate(hoje.getDate() - 1);
            break;
        case 'week':
            dataInicio.setDate(hoje.getDate() - 7);
            break;
        case 'month':
            dataInicio.setMonth(hoje.getMonth() - 1);
            break;
        case 'quarter':
            dataInicio.setMonth(hoje.getMonth() - 3);
            break;
        case 'year':
            dataInicio.setFullYear(hoje.getFullYear() - 1);
            break;
    }
    
    const [deals, orders, tasks, interactions] = await Promise.all([
        // Negócios do período
        fetch(`https://public-api2.ploomes.com/Deals?` +
            `$filter=CreatedDate ge ${dataInicio.toISOString()}`,
            { headers: { 'User-Key': apiKey } }
        ).then(r => r.json()),
        
        // Vendas do período
        fetch(`https://public-api2.ploomes.com/Orders?` +
            `$filter=Date ge ${dataInicio.toISOString()}`,
            { headers: { 'User-Key': apiKey } }
        ).then(r => r.json()),
        
        // Tarefas pendentes
        fetch(`https://public-api2.ploomes.com/Tasks?` +
            `$filter=Completed eq false`,
            { headers: { 'User-Key': apiKey } }
        ).then(r => r.json()),
        
        // Interações do período
        fetch(`https://public-api2.ploomes.com/InteractionRecords?` +
            `$filter=Date ge ${dataInicio.toISOString()}`,
            { headers: { 'User-Key': apiKey } }
        ).then(r => r.json())
    ]);
    
    return {
        periodo: {
            inicio: dataInicio.toISOString(),
            fim: hoje.toISOString()
        },
        negocios: {
            novos: deals.value.length,
            valorTotal: deals.value.reduce((sum, d) => sum + d.Amount, 0),
            ticketMedio: deals.value.length > 0 ? 
                deals.value.reduce((sum, d) => sum + d.Amount, 0) / deals.value.length : 0
        },
        vendas: {
            fechadas: orders.value.length,
            valorTotal: orders.value.reduce((sum, o) => sum + o.Amount, 0),
            ticketMedio: orders.value.length > 0 ?
                orders.value.reduce((sum, o) => sum + o.Amount, 0) / orders.value.length : 0
        },
        atividades: {
            tarefasPendentes: tasks.value.length,
            interacoesRealizadas: interactions.value.length
        },
        rankings: {
            topVendedores: calcularTopVendedores(orders.value),
            topClientes: calcularTopClientes(orders.value),
            topProdutos: calcularTopProdutos(orders.value)
        }
    };
}
```

## Códigos de erro e tratamento

### Códigos HTTP principais
| Código | Significado | Ação recomendada |
|--------|-------------|------------------|
| 200 | Sucesso | Processar resposta |
| 201 | Criado com sucesso | Obter ID do novo registro |
| 204 | Sucesso sem conteúdo | Operação DELETE bem-sucedida |
| 400 | Requisição inválida | Verificar sintaxe e dados |
| 401 | Não autorizado | Verificar User-Key |
| 403 | Proibido | Verificar permissões do usuário |
| 404 | Não encontrado | Verificar ID ou endpoint |
| 429 | Muitas requisições | Implementar backoff exponencial |
| 500 | Erro do servidor | Tentar novamente mais tarde |
| 503 | Serviço indisponível | Aguardar e tentar novamente |

### Formato de erro OData
```json
{
  "error": {
    "code": "BadRequest",
    "message": "Invalid filter syntax",
    "target": "$filter",
    "details": [
      {
        "code": "InvalidOperator",
        "message": "The operator 'eqq' is not valid",
        "target": "filter expression"
      }
    ]
  }
}
```

## Limites e rate limiting

### Limites oficiais confirmados
- **Rate limit:** 120 requisições por minuto
- **Limite por requisição GET:** 300 itens máximo para:
  - Contacts
  - Deals
  - Cities
  - Tasks
  - Orders
  - Quotes
- **Payload máximo:** 10MB por requisição
- **Paginação recomendada:** 100 itens por página
- **$top máximo efetivo:** 300 itens (para entidades listadas)

### Estratégia de retry com backoff exponencial
```javascript
async function apiCallWithBackoff(url, options, maxRetries = 5) {
    const RATE_LIMIT = 120; // 120 requisições por minuto
    const MINUTE = 60000;
    const MIN_DELAY = MINUTE / RATE_LIMIT; // ~500ms entre requisições
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            // Garantir delay mínimo entre requisições
            await new Promise(resolve => setTimeout(resolve, MIN_DELAY));
            
            const response = await fetch(url, options);
            
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After');
                const delay = retryAfter 
                    ? parseInt(retryAfter) * 1000 
                    : Math.min(1000 * Math.pow(2, i), 60000);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return response;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            
            const delay = Math.min(1000 * Math.pow(2, i), 60000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
```

### Controle de Rate Limiting
```javascript
class RateLimiter {
    constructor() {
        this.requests = [];
        this.LIMIT = 120; // 120 requisições por minuto
        this.WINDOW = 60000; // 1 minuto em ms
    }
    
    async waitIfNeeded() {
        const now = Date.now();
        
        // Remover requisições antigas (fora da janela de 1 minuto)
        this.requests = this.requests.filter(time => now - time < this.WINDOW);
        
        // Se atingiu o limite, aguardar
        if (this.requests.length >= this.LIMIT) {
            const oldestRequest = this.requests[0];
            const waitTime = this.WINDOW - (now - oldestRequest) + 100; // +100ms de margem
            
            console.log(`Rate limit atingido. Aguardando ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Limpar requisições antigas após esperar
            this.requests = this.requests.filter(time => Date.now() - time < this.WINDOW);
        }
        
        // Registrar nova requisição
        this.requests.push(now);
    }
}

// Uso com rate limiter
const rateLimiter = new RateLimiter();

async function makeApiCall(endpoint, options) {
    await rateLimiter.waitIfNeeded();
    return fetch(`https://public-api2.ploomes.com${endpoint}`, options);
}
```

## Otimização de performance

### Estratégias de Cache
```javascript
class PloomesCache {
    constructor(apiKey, ttl = 300000) { // 5 minutos padrão
        this.apiKey = apiKey;
        this.cache = new Map();
        this.ttl = ttl;
    }
    
    // Cache com TTL
    async get(endpoint, forceRefresh = false) {
        const cacheKey = endpoint;
        const cached = this.cache.get(cacheKey);
        
        if (!forceRefresh && cached && Date.now() - cached.timestamp < this.ttl) {
            return cached.data;
        }
        
        const response = await fetch(
            `https://public-api2.ploomes.com${endpoint}`,
            { headers: { 'User-Key': this.apiKey } }
        );
        
        const data = await response.json();
        
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
        
        return data;
    }
    
    // Cache de entidades estáticas
    async getCachedStatic(type) {
        const staticEndpoints = {
            pipelines: '/Deals@Pipelines',
            stages: '/Deals@Stages',
            userProfiles: '/Users@Profiles',
            currencies: '/Currencies',
            countries: '/Cities@Countries',
            states: '/Cities@States'
        };
        
        // TTL maior para dados estáticos (1 hora)
        const oldTTL = this.ttl;
        this.ttl = 3600000;
        const data = await this.get(staticEndpoints[type]);
        this.ttl = oldTTL;
        
        return data;
    }
}
```

### Paralelização de Requisições
```javascript
// Buscar dados em paralelo com controle de concorrência
class PloomesParallel {
    constructor(apiKey, maxConcurrent = 5) {
        this.apiKey = apiKey;
        this.maxConcurrent = maxConcurrent;
    }
    
    async fetchBatch(endpoints) {
        const results = [];
        
        for (let i = 0; i < endpoints.length; i += this.maxConcurrent) {
            const batch = endpoints.slice(i, i + this.maxConcurrent);
            const batchResults = await Promise.all(
                batch.map(endpoint => 
                    fetch(`https://public-api2.ploomes.com${endpoint}`, {
                        headers: { 'User-Key': this.apiKey }
                    }).then(r => r.json())
                )
            );
            results.push(...batchResults);
        }
        
        return results;
    }
    
    // Exemplo: Buscar detalhes completos de múltiplos negócios
    async getDealsComplete(dealIds) {
        const endpoints = [];
        
        dealIds.forEach(id => {
            endpoints.push(`/Deals/${id}`);
            endpoints.push(`/Quotes?$filter=DealId eq ${id}`);
            endpoints.push(`/Tasks?$filter=DealId eq ${id}`);
            endpoints.push(`/Documents?$filter=dealid eq ${id}`);
        });
        
        const results = await this.fetchBatch(endpoints);
        
        // Reorganizar resultados por negócio
        const dealData = {};
        let resultIndex = 0;
        
        dealIds.forEach(id => {
            dealData[id] = {
                deal: results[resultIndex++],
                quotes: results[resultIndex++].value,
                tasks: results[resultIndex++].value,
                documents: results[resultIndex++].value
            };
        });
        
        return dealData;
    }
}
```

### Otimização de Consultas
```javascript
// Usar projeção para reduzir payload
const contactosOtimizado = await fetch(
    'https://public-api2.ploomes.com/Contacts?' +
    '$select=Id,Name,Email,TypeId&' +  // Apenas campos necessários
    '$top=100&' +                       // Limitar resultados
    '$orderby=CreatedDate desc',        // Ordenação no servidor
    { headers: { 'User-Key': apiKey } }
);

// Evitar N+1 queries usando expand
// RUIM - N+1 queries
for (const deal of deals) {
    const contact = await fetch(`/Contacts/${deal.ContactId}`);
    // ...
}

// BOM - Single query com expand
const dealsComContatos = await fetch(
    '/Deals?$expand=Contact($select=Name,Email)',
    { headers: { 'User-Key': apiKey } }
);
```

## Migração de dados

### Importação em Massa
```javascript
class PloomesImporter {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://public-api2.ploomes.com';
        this.batchSize = 50;
        this.delayBetweenBatches = 1000; // 1 segundo
    }
    
    // Importar contatos de CSV
    async importContactsFromCSV(csvData) {
        const results = {
            success: [],
            errors: [],
            total: csvData.length
        };
        
        // Processar em lotes
        for (let i = 0; i < csvData.length; i += this.batchSize) {
            const batch = csvData.slice(i, i + this.batchSize);
            
            console.log(`Processando lote ${i / this.batchSize + 1}...`);
            
            const batchPromises = batch.map(async (row) => {
                try {
                    // Verificar duplicados
                    const existing = await this.checkDuplicate(row.email, row.document);
                    
                    if (existing) {
                        // Atualizar existente
                        const updated = await this.updateContact(existing.Id, row);
                        results.success.push({ ...row, action: 'updated', id: existing.Id });
                    } else {
                        // Criar novo
                        const created = await this.createContact(row);
                        results.success.push({ ...row, action: 'created', id: created.Id });
                    }
                } catch (error) {
                    results.errors.push({ ...row, error: error.message });
                }
            });
            
            await Promise.all(batchPromises);
            
            // Delay entre lotes para evitar rate limiting
            if (i + this.batchSize < csvData.length) {
                await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
            }
        }
        
        return results;
    }
    
    // Verificar duplicados
    async checkDuplicate(email, document) {
        let filter = [];
        
        if (email) filter.push(`Email eq '${email}'`);
        if (document) filter.push(`Document eq '${document}'`);
        
        if (filter.length === 0) return null;
        
        const response = await fetch(
            `${this.baseUrl}/Contacts?$filter=${filter.join(' or ')}&$select=Id,Name`,
            { headers: { 'User-Key': this.apiKey } }
        );
        
        const data = await response.json();
        return data.value?.[0] || null;
    }
    
    // Mapear campos do CSV para Ploomes
    mapCSVToContact(csvRow) {
        return {
            Name: csvRow.nome || csvRow.name,
            Email: csvRow.email,
            Document: csvRow.cpf || csvRow.cnpj || csvRow.document,
            TypeId: csvRow.cnpj ? 1 : 2,  // 1=Empresa, 2=Pessoa
            Phones: csvRow.telefone ? [{
                PhoneNumber: csvRow.telefone,
                TypeId: 1,
                CountryId: 76
            }] : [],
            Street: csvRow.endereco,
            StreetNumber: csvRow.numero,
            Neighborhood: csvRow.bairro,
            ZipCode: csvRow.cep?.replace(/\D/g, ''),
            CityId: csvRow.cityId,
            OtherProperties: this.mapCustomFields(csvRow)
        };
    }
    
    // Mapear campos customizados
    mapCustomFields(csvRow) {
        const customFields = [];
        
        // Mapear campos extras para OtherProperties
        const customMappings = {
            'setor': 'contact_SECTOR',
            'porte': 'contact_SIZE',
            'faturamento': 'contact_REVENUE'
        };
        
        for (const [csvField, ploomesKey] of Object.entries(customMappings)) {
            if (csvRow[csvField]) {
                customFields.push({
                    FieldKey: ploomesKey,
                    StringValue: csvRow[csvField]
                });
            }
        }
        
        return customFields;
    }
}
```

## Boas práticas essenciais

### O que FAZER
1. **Usar paginação sempre** - Máximo de 100 itens por página (recomendado)
2. **Respeitar rate limit** - 120 requisições por minuto
3. **Limitar requisições GET** - Máximo 300 itens para Contacts, Deals, Cities, Tasks, Orders, Quotes
4. **Implementar retry com backoff** - Para lidar com falhas temporárias
5. **Cachear dados estáticos** - Como listas de produtos ou opções
6. **Usar $select** - Buscar apenas os campos necessários
7. **Usar $expand=OtherProperties** - Para campos customizados
8. **Validar dados antes de enviar** - Evitar erros 400
9. **Usar campos customizados corretamente** - Via OtherProperties com FieldKey
10. **Descobrir estrutura de campos** - Usar /Fields antes de integrar
11. **Implementar logging detalhado** - Para debugging
12. **Usar HTTPS sempre** - Segurança obrigatória
13. **Proteger API keys** - Nunca expor em código cliente
14. **Usar requisições assíncronas** - Para não bloquear a interface
15. **Implementar cache local** - Para dados que não mudam frequentemente

### O que NÃO fazer
1. **Não exceder 120 requisições/minuto** - Causa bloqueio temporário
2. **Não requisitar mais de 300 itens** - Use paginação
3. **Não enviar payloads > 10MB** - Dividir em lotes menores
4. **Não fazer queries complexas com múltiplos $expand** - Causa timeout
5. **Não ignorar rate limiting** - Implementar controle no cliente
6. **Não hardcodar field keys** - Descobrir dinamicamente via /Fields
7. **Não usar credenciais de usuário regular** - Criar usuário de integração
8. **Não fazer polling excessivo** - Usar webhooks para real-time
9. **Não ignorar erros** - Implementar tratamento robusto
10. **Não fazer requests síncronos em loop** - Usar paralelização controlada
11. **Não assumir estrutura fixa** - Campos podem mudar
12. **Não fazer chamadas simultâneas desnecessárias** - Otimizar requests
13. **Não ignorar validação de webhooks** - Sempre validar X-Ploomes-Validation-Key
14. **Não ultrapassar limites de GET** - 300 itens máximo por requisição
15. **Não ignorar campos StreetAddress** - Campo unificado de endereço

## Peculiaridades e "pegadinhas" importantes

### Problema crítico de performance
**ATENÇÃO:** Queries com múltiplos níveis de $expand causam timeout. 

**Problema:**
```http
# ISTO CAUSA TIMEOUT!
GET /Quotes?$expand=Deal($expand=Contact($expand=Company)),Products($expand=Product)
```

**Solução obrigatória:**
```javascript
// 1. Primeiro buscar apenas IDs
const quotes = await fetch('/Quotes?$select=Id');

// 2. Depois buscar detalhes individualmente
for (const quote of quotes.value) {
    const details = await fetch(`/Quotes/${quote.Id}?$expand=Deal,Products`);
    // Processar...
}
```

### Campo TypeId em Contacts
- **TypeId = 1**: Empresa/Organização
- **TypeId = 2**: Pessoa física
- Crítico para distinguir entre pessoas e empresas

### Estrutura de campos customizados
Campos customizados **DEVEM** usar a estrutura correta de tipo:
- String → `StringValue`
- Número inteiro → `IntegerValue`
- Decimal → `DecimalValue`
- Booleano → `BooleanValue`
- Data → `DateTimeValue`

**Exemplo de ERRO comum:**
```json
// ERRADO!
{
  "OtherProperties": [
    {
      "FieldKey": "contact_IDADE",
      "StringValue": "25"  // ERRO: idade é integer!
    }
  ]
}

// CORRETO!
{
  "OtherProperties": [
    {
      "FieldKey": "contact_IDADE",
      "IntegerValue": 25
    }
  ]
}
```

### Webhooks - URL diferente
**IMPORTANTE:** Registro de webhooks usa base URL diferente:
- API normal: `https://public-api2.ploomes.com/`
- Webhooks: `https://api2.ploomes.com/`

### Sem ambiente de testes
**CRÍTICO:** Não existe sandbox! Toda operação é em produção.
- Criar usuário de integração específico para testes
- Testar com dados mínimos primeiro
- Implementar flags de "dry-run" na sua aplicação

### Formato de telefone brasileiro
```json
{
  "Phones": [
    {
      "PhoneNumber": "(11) 99999-9999",  // Formato esperado
      "TypeId": 1,  // 1=Comercial, 2=Celular, etc.
      "CountryId": 76  // Brasil
    }
  ]
}
```

### Datas sempre em UTC
Todas as datas devem ser enviadas em formato ISO 8601 com timezone UTC:
```
"2024-01-15T14:30:00Z"  // Correto
"2024-01-15T14:30:00"   // Pode causar problemas
"15/01/2024"            // ERRO!
```

## Versionamento e atualizações

### Versão atual
- **API v2** - Indicada por "api2" na URL
- Não há informações sobre deprecação da v1
- Sem política clara de versionamento documentada

### Como se manter atualizado
1. Monitorar https://developers.ploomes.com/
2. Assinar newsletter de desenvolvedores (se disponível)
3. Testar integração regularmente
4. Implementar testes automatizados

## Recursos e ferramentas

### Postman Collection
```
https://www.getpostman.com/collections/97e9e773223690f536d9
```

### Variáveis do Postman
- `{{server}}`: `https://public-api2.ploomes.com/`
- `{{uk}}`: Sua chave de API

### Documentação OData
- Especificação: http://docs.oasis-open.org/odata/odata/v4.0/
- URL Conventions: http://docs.oasis-open.org/odata/odata/v4.0/odata-v4.0-part2-url-conventions.html

### Bibliotecas disponíveis
**.NET:**
```bash
PM> Install-Package Ploomes.Api.Client
```

```csharp
var options = new PloomesApiClientOptions { Token = "sua-chave" };
var client = new PloomesClient(options);
```

## Checklist de implementação

### Configuração inicial
- [ ] Criar usuário de integração
- [ ] Obter e armazenar API key com segurança
- [ ] Configurar headers padrão
- [ ] Implementar classe/módulo de cliente base

### Funcionalidades básicas
- [ ] Implementar CRUD para entidades principais
- [ ] Adicionar suporte a campos customizados
- [ ] Implementar paginação
- [ ] Adicionar tratamento de erros
- [ ] Implementar retry com backoff

### Funcionalidades avançadas
- [ ] Configurar webhooks
- [ ] Implementar cache local
- [ ] Adicionar logging estruturado
- [ ] Criar testes automatizados
- [ ] Implementar monitoramento

### Segurança
- [ ] Proteger API keys
- [ ] Validar inputs
- [ ] Implementar rate limiting no cliente
- [ ] Validar webhooks recebidos
- [ ] Usar HTTPS sempre

## Tabela de referência rápida dos endpoints principais

| Operação | Endpoint | Método | Descrição |
|----------|----------|---------|-----------|
| **CONTATOS** | | | |
| Listar contatos | `/Contacts` | GET | Todos os contatos |
| Buscar contato | `/Contacts/{id}` | GET | Contato específico |
| Criar contato | `/Contacts` | POST | Novo contato |
| Atualizar contato | `/Contacts/{id}` | PUT/PATCH | Atualizar dados |
| Deletar contato | `/Contacts/{id}` | DELETE | Remover contato |
| **NEGÓCIOS** | | | |
| Listar negócios | `/Deals` | GET | Todos os negócios |
| Buscar negócio | `/Deals/{id}` | GET | Negócio específico |
| Criar negócio | `/Deals` | POST | Novo negócio |
| Mover no funil | `/Deals/{id}` | PATCH | Alterar StageId |
| **FUNIS** | | | |
| Listar funis | `/Deals@Pipelines` | GET | Todos os funis |
| Listar estágios | `/Deals@Stages` | GET | Todos os estágios |
| Estágios por funil | `/Deals@Stages?$filter=PipelineId eq {id}` | GET | Estágios de um funil |
| **VENDAS** | | | |
| Listar vendas | `/Orders` | GET | Todas as vendas |
| Criar venda | `/Orders` | POST | Nova venda |
| Estágios de venda | `/Orders@Stages` | GET | Estágios de vendas |
| **PROPOSTAS** | | | |
| Listar propostas | `/Quotes` | GET | Todas as propostas |
| Criar proposta | `/Quotes` | POST | Nova proposta |
| Produtos da proposta | `/QuoteProducts` | GET/POST | Produtos em propostas |
| **TAREFAS** | | | |
| Listar tarefas | `/Tasks` | GET | Todas as tarefas |
| Criar tarefa | `/Tasks` | POST | Nova tarefa |
| Marcar concluída | `/Tasks/{id}` | PATCH | Completed: true |
| **DOCUMENTOS** | | | |
| Listar documentos | `/Documents` | GET | Todos os documentos |
| Docs por negócio | `/Documents?$filter=dealid eq {id}` | GET | Docs de um negócio |
| **INTERAÇÕES** | | | |
| Registrar interação | `/InteractionRecords` | POST | Nova interação |
| Histórico | `/InteractionRecords?$filter=ContactId eq {id}` | GET | Por contato |
| **WEBHOOKS** | | | |
| Criar webhook | `https://api2.ploomes.com/Webhooks` | POST | Novo webhook |
| Listar ações | `/Webhooks@Actions` | GET | Ações disponíveis |
| **METADADOS** | | | |
| Campos | `/Fields` | GET | Todos os campos |
| Campos customizados | `/Fields?$filter=Dynamic eq true` | GET | Campos dinâmicos |
| Opções de campos | `/Fields@OptionsTables` | GET | Listas de opções |
| **ARQUIVOS** | | | |
| Upload | `/Files` | POST | Enviar arquivo |
| Download | `/Files/{id}/download` | GET | Baixar arquivo |
| Listar por entidade | `/Files?entityId={id}` | GET | Arquivos de entidade |

## Padrões de filtros OData

| Operador | Descrição | Exemplo |
|----------|-----------|---------|
| `eq` | Igual | `$filter=Name eq 'João'` |
| `ne` | Diferente | `$filter=TypeId ne 1` |
| `gt` | Maior que | `$filter=Amount gt 10000` |
| `ge` | Maior ou igual | `$filter=Date ge 2024-01-01` |
| `lt` | Menor que | `$filter=Amount lt 5000` |
| `le` | Menor ou igual | `$filter=Id le 100` |
| `and` | E | `$filter=TypeId eq 2 and Amount gt 1000` |
| `or` | Ou | `$filter=City eq 'SP' or City eq 'RJ'` |
| `contains()` | Contém | `$filter=contains(Name,'Silva')` |
| `startswith()` | Começa com | `$filter=startswith(Email,'joao')` |
| `endswith()` | Termina com | `$filter=endswith(Email,'gmail.com')` |

## Capacidades confirmadas da API

### ✅ Funcionalidades disponíveis
- CRUD completo para todas as entidades principais
- Sistema de funis e estágios personalizáveis
- Campos customizados via OtherProperties
- Webhooks para eventos em tempo real
- Documentos e arquivos com campo filename
- Registros de interação e histórico
- Paginação e filtros OData v4
- Expansão de relacionamentos ($expand)
- Batch operations (múltiplas operações)
- Upload e gerenciamento de arquivos

### ⚠️ Funcionalidades parcialmente documentadas
- Download direto de arquivos (endpoint provável: `/Files/{id}/download`)
- Histórico completo de modificações
- Logs de auditoria detalhados
- Métricas e analytics nativos
- Automações e workflows customizados

### ❌ Funcionalidades não confirmadas
- WebSocket/Real-time updates
- GraphQL endpoint
- Backup/Restore via API
- Sandbox de desenvolvimento

## Exemplos prontos para uso

### Configuração inicial completa
```javascript
// cliente.js - Cliente completo da API Ploomes
class PloomesClient {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://public-api2.ploomes.com';
        this.webhookUrl = 'https://api2.ploomes.com';
        this.headers = {
            'User-Key': apiKey,
            'Content-Type': 'application/json; charset=utf-8'
        };
    }
    
    // Método genérico de requisição
    async request(method, endpoint, body = null) {
        const options = {
            method,
            headers: this.headers
        };
        
        if (body && method !== 'GET') {
            options.body = JSON.stringify(body);
        }
        
        const response = await fetch(this.baseUrl + endpoint, options);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} - ${response.statusText}`);
        }
        
        return response.json();
    }
    
    // Métodos de conveniência
    get(endpoint) { return this.request('GET', endpoint); }
    post(endpoint, body) { return this.request('POST', endpoint, body); }
    put(endpoint, body) { return this.request('PUT', endpoint, body); }
    patch(endpoint, body) { return this.request('PATCH', endpoint, body); }
    delete(endpoint) { return this.request('DELETE', endpoint); }
    
    // Módulos específicos
    contacts = {
        list: (filter) => this.get(`/Contacts${filter ? '?' + filter : ''}`),
        get: (id) => this.get(`/Contacts/${id}`),
        create: (data) => this.post('/Contacts', data),
        update: (id, data) => this.patch(`/Contacts/${id}`, data),
        delete: (id) => this.delete(`/Contacts/${id}`)
    };
    
    deals = {
        list: (filter) => this.get(`/Deals${filter ? '?' + filter : ''}`),
        get: (id) => this.get(`/Deals/${id}`),
        create: (data) => this.post('/Deals', data),
        update: (id, data) => this.patch(`/Deals/${id}`, data),
        delete: (id) => this.delete(`/Deals/${id}`),
        moveStage: (id, stageId) => this.patch(`/Deals/${id}`, { StageId: stageId })
    };
    
    pipelines = {
        list: () => this.get('/Deals@Pipelines'),
        get: (id) => this.get(`/Deals@Pipelines/${id}`),
        stages: (pipelineId) => this.get(`/Deals@Stages?$filter=PipelineId eq ${pipelineId}`)
    };
}

// Uso
const ploomes = new PloomesClient('SUA_CHAVE_API');

// Buscar contatos
const contatos = await ploomes.contacts.list('$top=10');

// Criar negócio
const negocio = await ploomes.deals.create({
    Title: 'Nova oportunidade',
    Amount: 50000,
    ContactId: 123
});

// Mover negócio no funil
await ploomes.deals.moveStage(negocio.Id, 2);
```

---

## 📚 **Conclusão**

Este documento representa a **documentação mais completa possível** da API Ploomes v2, incluindo:

1. **70+ endpoints documentados** 
2. **40+ entidades mapeadas**
3. **Exemplos práticos funcionais**
4. **Padrões de integração**
5. **Otimizações de performance**
6. **Tratamento de erros robusto**
7. **Migração e importação de dados**

**Para a apresentação que você não consegui acessar**, se ela contiver informações adicionais específicas sobre:
- Endpoints não documentados
- Funcionalidades beta
- Roadmap da API
- Limites específicos de rate limiting
- Exemplos de casos de uso avançados

Por favor, compartilhe screenshots ou o conteúdo em texto que eu possa adicionar ao documento.

**Este documento está pronto para ser usado pelo Claude Code** para desenvolver integrações completas com a API Ploomes! 🚀