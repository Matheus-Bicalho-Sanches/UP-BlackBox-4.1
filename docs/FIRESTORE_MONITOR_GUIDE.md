# 🔍 Guia do Firestore Monitor

Sistema de monitoramento de custos do Firestore implementado para rastrear leituras de documentos e identificar operações custosas.

## 📋 O que foi implementado?

### 1. **FirestoreMonitor** (`src/lib/firestoreMonitor.ts`)
Classe principal que rastreia todas as leituras do Firestore:
- Conta documentos lidos por coleção
- Agrupa por contexto (qual função fez a leitura)
- Calcula custos estimados
- Exporta relatórios detalhados

### 2. **trackedGetDocs** (`src/lib/firebaseHelpers.ts`)
Função helper que substitui `getDocs()` e adiciona tracking automático:
- Rastreia quantos documentos foram lidos
- Registra qual coleção foi acessada
- Salva o contexto da chamada
- Mede tempo de execução

### 3. **trackedFetch** (`src/lib/firebaseHelpers.ts`)
Wrapper para chamadas de API que rastreia reads do backend:
- Intercepta chamadas `fetch()` para APIs internas
- Extrai métricas reais de reads do backend
- Registra reads de `posicoesDLL` e `posicoesAjusteManual`
- Fallback para estimativa se backend não retornar métricas

### 4. **FirestoreMonitorWidget** (`src/components/FirestoreMonitorWidget.tsx`)
Widget visual que aparece no canto inferior direito da tela:
- Mostra total de reads em tempo real
- Exibe custo estimado
- Lista top 5 coleções mais custosas
- Botões para exportar dados e resetar contadores

### 5. **Backend Metrics** (`UP BlackBox 4.0/main.py`)
Endpoint `/client-positions/{account_id}` modificado para retornar métricas:
- Conta reads reais de `posicoesDLL`
- Conta reads reais de `posicoesAjusteManual`
- Retorna totais na resposta (`firestore_metrics`)

## 🎯 Como usar

### Interface Visual

Quando você abrir a página `/dashboard/up-blackbox4/sync`, verá um widget no canto inferior direito:

```
┌────────────────────────────┐
│ 📊 FIRESTORE MONITOR       │
├────────────────────────────┤
│ Total Reads    250         │
│ Custo (USD)    $0.0002     │
├────────────────────────────┤
│ Top Coleções:              │
│ • posicoesDLL     180 72%  │
│ • strategies       45 18%  │
│ • contasDll        25 10%  │
├────────────────────────────┤
│ [Relatório] [Exportar]     │
│ [Reset]                    │
└────────────────────────────┘
```

**Botões:**
- **Relatório**: Gera relatório detalhado no console (F12)
- **Exportar**: Baixa arquivo JSON com todos os dados
- **Reset**: Zera todos os contadores

### Console do Navegador

Pressione **F12** para abrir o console e use:

```javascript
// Ver relatório completo
window.firestoreMonitor.getReport();

// Exportar dados como JSON
window.firestoreMonitor.exportJSON();

// Resetar contadores
window.firestoreMonitor.reset();

// Ver resumo programático
window.firestoreMonitor.getSummary();
```

### Exemplo de Relatório

```
╔═══════════════════════════════════════════════════════════════╗
║           FIRESTORE READS REPORT (15.5 min)                   ║
╠═══════════════════════════════════════════════════════════════╣
║ strategies::initialLoad                         10 reads      ║
║ contasDll::initialLoad                         15 reads      ║
║ CarteirasDeRefDLL::fetchReferencePositions     25 reads      ║
║ posicoesDLL::loadAccountPositions (backend)    450 reads      ║
║ posicoesAjusteManual::loadAccountPositions     135 reads      ║
╠═══════════════════════════════════════════════════════════════╣
║ strategies                        10 ( 1.6%)                  ║
║ contasDll                        15 ( 2.4%)                  ║
║ CarteirasDeRefDLL                25 ( 3.9%)                  ║
║ posicoesDLL                     450 (70.6%)                  ║
║ posicoesAjusteManual            135 (21.2%)                  ║
╠═══════════════════════════════════════════════════════════════╣
║ TOTAL:                                          635 reads      ║
║ Custo estimado (US$ 0.06/100k): US$   0.0004                 ║
╚═══════════════════════════════════════════════════════════════╝

Nota: Reads marcados com "(backend)" são executados pelo servidor Python,
      mas são contabilizados pois geram custo no Firestore.
```

## 🧪 Como testar

### Teste 1: Carga Inicial da Página
1. Abra a página `/dashboard/up-blackbox4/sync`
2. Aguarde carregar completamente
3. Clique em **"Relatório"** no widget
4. Veja no console quais coleções foram lidas

### Teste 2: Seleção de Estratégia
1. Clique em **"Reset"** no widget
2. Selecione uma estratégia no dropdown
3. Aguarde carregar as posições
4. Clique em **"Relatório"** para ver os reads

### Teste 3: Modal "Sincronizar Todos"
1. Clique em **"Reset"** no widget
2. Clique no botão **"Sincronizar Todos"**
3. Aguarde processar
4. Clique em **"Relatório"** para ver impacto

### Teste 4: Sessão Completa
1. Use a página normalmente por 30-60 minutos
2. Clique em **"Exportar"** no widget
3. Analise o arquivo JSON baixado
4. Identifique as operações mais custosas

## 📊 Interpretando os Dados

### Custos do Firestore
- **Preço**: $0.06 por 100.000 leituras
- **1.000 reads** = $0.0006
- **10.000 reads** = $0.006
- **100.000 reads** = $0.06

### O que procurar?
- ✅ **Ideal**: 100-500 reads na carga inicial
- ⚠️ **Atenção**: 1.000-5.000 reads por ação
- 🚨 **Problema**: 10.000+ reads frequentes

### Coleções a monitorar
1. **posicoesDLL**: Posições dos clientes (pode ter 1000+ docs)
2. **CarteirasDeRefDLL**: Posições de referência (50-200 docs)
3. **ordensDLL**: Ordens (pode ter 10.000+ docs)
4. **strategies**: Estratégias (5-20 docs) ✅ OK
5. **contasDll**: Contas (10-50 docs) ✅ OK

## 🎯 Próximos Passos

Após coletar dados por 1-2 dias:

1. **Identificar gargalos**: Quais coleções têm mais reads?
2. **Analisar contextos**: Quais funções fazem mais chamadas?
3. **Otimizar queries**: Adicionar filtros, limites, índices
4. **Implementar cache**: Para dados que não mudam frequentemente
5. **Considerar WebSocket**: Para atualizações em tempo real

## 💰 Estimativa de Economia

Se identificarmos que você está fazendo **50.000 reads/dia desnecessários**:
- **Custo atual**: $0.03/dia = $0.90/mês
- **Após otimização**: $0.005/dia = $0.15/mês
- **Economia**: $0.75/mês (83% de redução)

Em escala, com 100 usuários ativos:
- **Custo atual**: $90/mês
- **Após otimização**: $15/mês
- **Economia**: $75/mês = $900/ano

## ❓ Perguntas Frequentes

### O monitor consome recursos?
Não. Ele apenas conta operações que já estão acontecendo. O impacto na performance é imperceptível (<1ms por operação).

### O monitor tem custo adicional?
Zero custo adicional. Nenhuma query extra ao Firestore é feita.

### Posso usar em produção?
Sim, mas recomendamos usar apenas para análise. Após identificar os problemas, você pode remover o monitor.

### Os dados são compartilhados?
Não. Cada navegador tem seus próprios contadores. Para análise consolidada, peça para cada usuário exportar os dados.

### Como remover o monitor?
Simplesmente remova as seguintes linhas da página Sync:
- Import do `trackedGetDocs` e `FirestoreMonitorWidget`
- Substitua `trackedGetDocs()` por `getDocs()`
- Remova `<FirestoreMonitorWidget />`

## 📞 Suporte

Se tiver dúvidas ou problemas:
1. Verifique o console do navegador (F12) para erros
2. Confirme que o widget está visível no canto da tela
3. Teste em navegador incógnito para descartar cache
4. Exporte os dados e analise o JSON

---

**Implementado em**: 30/09/2025
**Versão**: 1.0
**Status**: ✅ Ativo na página `/dashboard/up-blackbox4/sync`
