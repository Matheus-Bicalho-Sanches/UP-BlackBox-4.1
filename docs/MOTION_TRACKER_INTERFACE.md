# 🚀 Motion Tracker - Interface de Rastreamento de Robôs

## 📋 Visão Geral

A interface **Motion Tracker** foi implementada para demonstrar como será o sistema de rastreamento de robôs de compra/venda. Esta é uma versão inicial com dados fictícios para validação da interface.

## 🎯 Funcionalidades Implementadas

### 0. **Visão Consolidada (TODOS)**
- **Opção Padrão**: "TODOS" é selecionado por padrão
- **Dados Consolidados**: Mostra informações de todos os ativos simultaneamente
- **Identificação por Símbolo**: Cada robô/trade mostra seu símbolo quando "TODOS" está ativo
- **Métricas Globais**: Estatísticas consolidadas de todo o mercado

### 1. **Seleção de Ativos**
- **Dropdown de Ativos**: TODOS, PETR4, VALE3, ITUB4, BBDC4, ABEV3, WEGE3, RENT3, LREN3
- **Opção TODOS**: Consolida dados de todos os ativos (padrão)
- **Seleção de Mercado**: B3 (Ações) e BMF (Futuros)

### 2. **Dashboard de Resumo**
- **Robôs Ativos**: Contador de robôs em execução
- **Volume Total**: Volume executado pelos robôs detectados
- **Trades Totais**: Número total de execuções
- **Confiança Média**: Score médio de confiança das detecções

### 3. **Abas de Análise**

#### **Aba 1: Padrões Detectados**
- **Lista de Robôs**: Cada robô com suas características
- **Tipo de Padrão**: TWAP, VWAP, UNKNOWN
- **Status**: Ativo, Inativo, Suspeito
- **Métricas**: Volume, Trades, Frequência, Confiança
- **Timestamps**: Primeira e última execução

#### **Aba 2: Atividade em Tempo Real**
- **Trades Recentes**: Execuções dos robôs
- **Indicadores Visuais**: Verde (Compra), Vermelho (Venda)
- **Informações**: Preço, Volume, Agente, Horário

#### **Aba 3: Análise Avançada**
- **Distribuição por Tipo**: Gráficos de barras por padrão
- **Métricas de Performance**: Estatísticas consolidadas
- **Análise Comparativa**: Comparação entre robôs

## 🎨 Características da Interface

### **Design System**
- **Tema Dark**: Consistente com o resto do dashboard
- **Cores Semânticas**: 
  - 🔵 Azul: TWAP
  - 🟣 Roxo: VWAP
  - 🟠 Laranja: UNKNOWN
  - 🟢 Verde: Ativo
  - 🟡 Amarelo: Suspeito
  - ⚫ Cinza: Inativo

### **Responsividade**
- **Grid Adaptativo**: Layout que se adapta a diferentes tamanhos de tela
- **Mobile First**: Interface otimizada para dispositivos móveis
- **Breakpoints**: md (768px), lg (1024px)

### **Componentes UI**
- **Cards**: Para organizar informações em blocos
- **Badges**: Para destacar tipos e status
- **Tabs**: Para organizar conteúdo em abas
- **Select**: Para seleção de opções
- **Grid**: Para layout responsivo

## 📊 Dados Fictícios Implementados

### **Robôs de Exemplo**

#### **Robô 1 - PETR4 (TWAP)**
- **Agente**: 1001
- **Confiança**: 89%
- **Volume**: 1.5M
- **Trades**: 45
- **Frequência**: 3 min
- **Status**: Ativo

#### **Robô 2 - PETR4 (VWAP)**
- **Agente**: 1002
- **Confiança**: 76%
- **Volume**: 2.2M
- **Trades**: 38
- **Frequência**: 4 min
- **Status**: Ativo

#### **Robô 3 - VALE3 (UNKNOWN)**
- **Agente**: 2001
- **Confiança**: 45%
- **Volume**: 800K
- **Trades**: 12
- **Frequência**: 5 min
- **Status**: Suspeito

#### **Robô 4 - ITUB4 (TWAP)**
- **Agente**: 3001
- **Confiança**: 92%
- **Volume**: 3.2M
- **Trades**: 64
- **Frequência**: 3 min
- **Status**: Ativo

## 🔧 Como Usar

### **1. Acessar a Interface**
```
URL: http://localhost:3000/dashboard/blackbox-multi/motion-tracker
```

### **2. Selecionar Ativo**
- **Opção TODOS**: Veja dados consolidados de todos os ativos (padrão)
- **Ativo Específico**: Escolha um ativo específico no dropdown
- Selecione o mercado (B3/BMF)

### **3. Analisar Dados**
- **Aba Padrões**: Veja os robôs detectados (com símbolo quando "TODOS" selecionado)
- **Aba Atividade**: Monitore execuções em tempo real (com símbolo quando "TODOS" selecionado)
- **Aba Análise**: Consulte métricas consolidadas de todos os ativos

### **4. Interpretar Informações**
- **Confiança Alta** (>80%): Robô bem identificado
- **Confiança Média** (50-80%): Robô com padrão parcial
- **Confiança Baixa** (<50%): Padrão suspeito ou incompleto

## 🚧 Próximos Passos

### **Fase 1: Validação da Interface** ✅
- [x] Interface básica implementada
- [x] Dados fictícios configurados
- [x] Componentes UI criados
- [x] Layout responsivo implementado

### **Fase 2: Backend Real** 🔄
- [ ] Criar tabelas no banco de dados
- [ ] Implementar algoritmos de detecção
- [ ] Desenvolver API endpoints
- [ ] Conectar com dados reais

### **Fase 3: Funcionalidades Avançadas** 🔄
- [ ] Gráficos interativos
- [ ] Alertas em tempo real
- [ ] Filtros avançados
- [ ] Exportação de dados

### **Fase 4: Otimizações** 🔄
- [ ] Performance e escalabilidade
- [ ] Machine Learning para detecção
- [ ] Cache e análise em background
- [ ] Monitoramento e métricas

## 💡 Observações Técnicas

### **Componentes Criados**
- `src/components/ui/tabs.tsx` - Sistema de abas
- `src/app/dashboard/blackbox-multi/motion-tracker/page.tsx` - Página principal

### **Dependências Instaladas**
- `@radix-ui/react-tabs` - Para funcionalidade de abas

### **Estrutura de Dados**
- **RobotPattern**: Padrões detectados
- **RobotTrade**: Execuções individuais
- **Mock Data**: Dados fictícios para demonstração

## 🎯 Objetivo da Validação

Esta interface permite validar:
1. **Usabilidade**: Facilidade de navegação e compreensão
2. **Design**: Aparência visual e consistência
3. **Funcionalidade**: Organização das informações
4. **Responsividade**: Comportamento em diferentes dispositivos

**Após validação positiva, avançaremos para implementação do backend real com algoritmos de detecção de robôs!** 🚀
