# UP BlackBox 4.0 - Documentação Arquitetural

## Visão Geral

O UP BlackBox 4.0 é um sistema de gestão de carteiras que suporta tanto gestão manual quanto automatizada de investimentos.

## Arquitetura do Sistema

### Carteiras e Estratégias

- **UP BlackBox FIIs**: Carteira manual que investe em FIIs FI-Infra e FI-Agro
- **UP BlackBox Multi**: Carteira que investe em ações e futuros (atualmente manual, futuramente automatizada)

### Conceito de "MASTER"

- **NÃO é uma conta real** - é uma abstração para consolidar dados
- Usado para:
  - Consolidar posições de todas as contas
  - Enviar ordens em lote para múltiplas contas
  - Visualizar dados agregados por estratégia

### Estratégias

- Representam carteiras específicas da gestora
- Cada estratégia pode ter múltiplas contas de clientes alocadas
- Permitem gerenciar alocações de capital por cliente
- Base para cálculo proporcional de ordens

## Segurança e Autenticação

### Autenticação de Usuários
- Autenticação via `/login` (página principal)
- Apenas colaboradores da empresa têm acesso
- Todos os usuários têm o mesmo nível de permissão

### Login DLL
- Login automático na DLL do Profit (sistema de trading)
- Não é autenticação de usuário
- Realizado automaticamente na inicialização do backend

## Integração com Backend

### Status de Produção
- **Sistema já está em produção**
- **NÃO usar fallbacks fictícios** - podem atrapalhar operações reais
- Todas as operações devem ser reais e validadas

### Sincronização
- Sistema depende de conexão estável com backend
- Falhas de rede devem ser tratadas adequadamente
- Não há fallback local para dados fictícios

## Funcionalidades Principais

### Gestão de Posições
- Visualização por conta individual
- Consolidação por estratégia
- Consolidação geral (MASTER)
- Cálculo baseado em ordens executadas

### Gestão de Ordens
- Ordens individuais por conta
- Ordens consolidadas (MASTER) com alocação proporcional
- Ordens iceberg para execução gradual
- Fechamento de posições em lote

### Gestão de Estratégias
- Criação e edição de estratégias (carteiras)
- Alocação de clientes por estratégia
- Definição de valor investido por cliente

## Considerações Importantes

### Para Desenvolvedores
1. **Nunca usar dados fictícios** - sistema está em produção
2. **MASTER não é conta real** - apenas abstração
3. **Todos os usuários têm mesmo acesso** - não implementar hierarquias
4. **Validar sempre** - operações afetam dinheiro real

### Para Usuários
1. **Sistema em produção** - operações são reais
2. **MASTER consolida dados** - não é uma conta específica
3. **Estratégias são carteiras** - representam produtos da gestora
4. **Alocações definem proporções** - base para ordens consolidadas

## Estrutura de Dados

### Coleções Firebase
- `strategies`: Estratégias (carteiras)
- `strategyAllocations`: Alocações de clientes por estratégia
- `posicoesDLL`: Posições calculadas por conta
- `ordensDLL`: Ordens enviadas e executadas
- `contasDLL`: Informações das contas dos clientes

### APIs Backend
- `/strategies`: Gestão de estratégias
- `/allocations`: Gestão de alocações
- `/positions`: Consulta de posições
- `/order`: Envio de ordens
- `/login`: Login na DLL do Profit 