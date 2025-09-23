## IA para Trades – Arquitetura, Treinamento e Visualização (AI Lab)

### Objetivo
- **Construir e operar modelos de IA** (inicialmente LightGBM, evoluindo para TCN/SSM/Transformers eficientes) usando dados de `ticks_raw` para gerar sinais de compra/venda com latência de 1–2s, considerando custos e execução realista.

### Visão Geral da Solução
- **Dados**: `ticks_raw` (preço, volume, timestamp, agressor via trade_type=2/3, agentes, exchange).
- **ETL/Features**: agregação em “event bars” (tick/volume/dólar), cálculo de features de microestrutura e temporais, normalização rolling.
- **Rótulos (labels)**: sinal/retorno futuro em Δt ou esquema “triple‑barrier”.
- **Modelagem**: baseline com LightGBM; extensões com TCN/GRU, SSM (Mamba/S4) e Transformers eficientes.
- **Validação**: walk‑forward, backtest com custos/latência, promotion apenas se superar baseline e custos.
- **Frontend (AI Lab)**: página para controlar treino, acompanhar métricas ao vivo, comparar experimentos e visualizar resultados de backtests.

---

## Dados e ETL

### Fonte
- Tabela `ticks_raw` (TimescaleDB/PostgreSQL): `symbol, price, volume, timestamp, buy_agent, sell_agent, exchange, trade_type`.
  - `trade_type`: 2 comprador agressor (market buy), 3 vendedor agressor (market sell).

### Construção de Barras (amostragem por eventos)
- **Tick bars**: N negócios por barra (ex.: 200 trades).
- **Volume bars**: soma de volume fixa por barra (ex.: 100k ações).
- **Dollar bars**: soma de preço×volume fixa.
- Benefícios: reduz ruído e padroniza janelas para modelos sequenciais.

### Features (exemplos)
- **Preço/Retorno**: retorno log, retornos acumulados em janelas multi‑escala (1s, 5s, 30s, 5m), ATR curto.
- **Fluxo de ordem**: volume assinado pelo agressor, OFI simplificado, razão buy/sell agressor, razão ticks up/down.
- **Tempo**: tempo entre trades (inter‑arrival), hora do dia, dia da semana, sazonalidades intradiárias.
- **Volatilidade/Liquidez**: vol rolling, proxies de spread/microprice (se possível), concentração de agentes.
- Normalização: rolling por ativo (sem vazamento), winsorization/robust scaler quando necessário.

### Rótulos (Targets)
- **Classificação**: sinal do retorno em Δt (ex.: 5s, 30s ou 50 trades à frente).
- **Regressão**: retorno esperado em Δt.
- **Triple‑Barrier** (Lopez de Prado): define buy/sell/flat com take‑profit/stop/time‑out.

### Higiene de Dados
- Treino/validação/teste por tempo (walk‑forward). Nada de shuffle aleatório global.
- Custo/latência simulados no backtest; evitar vazamento (normalizações e features só com passado).

---

## Arquiteturas de Modelos

### LightGBM/XGBoost (Árvores em Boosting)
- Como funciona: muitas árvores pequenas aprendem correções sobre o erro da anterior (boosting baseado em histogramas – rápido e leve).
- Por que usar: robusto em dados tabulares com boas features; inferência em milissegundos; ótimo baseline.
- Treinamento (passo a passo):
  1) Gerar event bars, calcular features e rótulos.
  2) Criar LightGBM Dataset (tipos leves: float32/int32), salvar em binário (save_binary) e usar `free_raw_data=True`.
  3) Hiperparâmetros iniciais: `learning_rate=0.05–0.1`, `num_leaves=31–255`, `max_depth=4–8`, `feature_fraction/bagging_fraction=0.7–0.9`, `min_data_in_leaf=100–1000`, `max_bin=63–255`, `early_stopping_rounds=50–200`.
  4) Treino multi‑thread, early stopping; validação walk‑forward.
- Vantagens: rápido, estável, fácil de servir (CPU‑only).
- Desvantagens: depende da qualidade/riqueza das features; não “lê” sequência crua.

### GRU/LSTM (Redes Recorrentes)
- Como funciona: mantém um estado ao longo da sequência (portas de entrada/esquecimento/saída) para “lembrar” o passado.
- Uso: dependências temporais de curto/médio prazo sem engenharia de features pesada.
- Treinamento: janelas L=512–2048, 1–2 camadas, 64–256 unidades, dropout 0.1–0.2, Adam 1e‑3.
- Vantagens: simples, bom custo/benefício.
- Desvantagens: piora com contextos muito longos; menos paralelizável que TCN.

### TCN (Temporal Convolutional Network)
- Como funciona: convoluções 1D causais com dilatação + blocos residuais; receptive field cresce exponencialmente com as dilatações.
- Uso: dependências longas com latência baixa (CPU‑friendly).
- Treinamento: 4–8 blocos, kernel=3, canais 32–128, dilations [1,2,4,8,...], dropout 0.1, Adam 1e‑3.
- Vantagens: muito rápido e paralelizável; alcança milhares de passos.
- Desvantagens: precisa calibrar a janela/dilations para cobrir o horizonte.

### SSM (State Space Models – S4, Mamba)
- Como funciona: modela a sequência via equações de estado; memória longa com custo linear em L.
- Uso: janelas longas (10k–100k passos) com baixa latência.
- Treinamento: 2–4 camadas pequenas (d_model 64–128), Adam+scheduler, early stopping.
- Vantagens: excelente para longos contextos; eficiente.
- Desvantagens: tooling menos maduro que CNN/RNN/Transformer.

### Transformers (atenção)
- Como funciona: atenção permite que cada passo “olhe” para todos os outros (dependências de longo alcance).
- Desafio: atenção densa é O(L^2); usar variantes eficientes:
  - **Transformer‑XL** (memória recorrente), **Longformer/BigBird** (atenção esparsa), **Performer/Reformer** (atenção aproximada), **PatchTST** (patches).
- Treinamento: 2–4 camadas pequenas, d_model 64–128, 2–4 heads, L 512–1024; dropout 0.1–0.2; clipping de gradiente; warmup.
- Vantagens: muito flexível e expressivo.
- Desvantagens: maior risco de overfit/custo; exige mais engenharia para latência.

### Qual arquitetura para qual contexto
- Até ~4k passos: TCN ou GRU pequenos.
- ~4k–16k: TCN bem dilatado; considerar Transformer eficiente pequeno.
- 10k–100k: SSM (Mamba/S4) ou Transformers eficientes (Transformer‑XL/Longformer/BigBird/Performer/PatchTST).
- Baseline sempre útil: LightGBM com features multi‑escala.

---

## Pipeline de Treino, Validação e Backtest

### Passos
1) **ETL**: extrair `ticks_raw` → construir event bars → calcular features e rótulos → salvar Dataset (binário para LightGBM).
2) **Split temporal**: walk‑forward (treina numa janela, valida na seguinte, testa depois).
3) **Treino**: LightGBM baseline; depois TCN/GRU; evoluir para SSM/Transformer se justificar.
4) **Backtest**: simular custos (fees, spread, slippage) e latência; operar só quando score/retorno supera custos.
5) **Promoção**: versionar modelos/datasets; promover apenas se superar baseline + custos em múltiplos períodos.

### KPIs e Diagnósticos
- AUC/PR, Logloss, PnL e Sharpe netos, Max Drawdown, turnover, hit rate, retorno por decil de score.
- Latência p50/p95 (feature→inferência→decisão), gaps de dados, estabilidade por intervalo do dia.

---

## Frontend – Página “AI Lab” (MVP)

### Estrutura (Next.js/Tailwind)
- Rota: `src/app/dashboard/ai-lab/page.tsx` (ou dentro de `blackbox-multi`).

#### 1) Controle de Experimentos
- Form para iniciar treino: arquitetura (LightGBM/TCN/…), horizonte Δt, janelas, custos, seed, seleção de ativos.
- Ações: Iniciar, Pausar, Parar, Duplicar, Rodar Backtest.
- Lista de runs recentes com status e tempo.

#### 2) Treino ao Vivo
- Gráficos: loss/metric por iteração (LightGBM), tempo/iteração, tamanho do dataset.
- Top‑N Feature Importance (e SHAP resumido ao final).
- Log streaming com filtros (info/warn/error).

#### 3) Comparador de Experimentos
- Seleciona 2–3 runs para comparar AUC/PR, curvas de aprendizado, importância de features, tempo total.

#### 4) Backtest
- Curva de equity e drawdown; tabela de trades; distribuição de retornos; hit por decil de score.
- Heatmap por hora do dia/dia da semana; PnL vs custos.
- Slider de threshold com recomputação das métricas sem re‑treinar.

#### 5) Saúde dos Dados e Latência
- Status do pipeline de event bars; volumetria; gaps.
- Latência end‑to‑end p50/p95; throughput de ticks.

### Integração em Tempo Real
- WebSocket para status/métricas/logs; fallback por polling (3–5s).
- Notificações de conclusão/falha; links para baixar artefatos (modelo/dataset binário).

---

## Backend – Endpoints (proposta)

### Experimentos
- `POST /ml/experiments` – inicia treino (JSON com config: modelo, janelas, Δt, custos, seed, ativos).
- `GET /ml/experiments` – lista runs.
- `GET /ml/experiments/{id}` – status, config, tempos.
- `GET /ml/experiments/{id}/metrics` – histórico por iteração.
- `GET /ml/experiments/{id}/importance` – importância de features.
- `GET /ml/experiments/{id}/logs` – SSE/WS de logs.

### Backtests
- `POST /ml/backtests` – executa backtest com custos e threshold.
- `GET /ml/backtests/{id}/results` – equity, drawdown, KPIs.
- `GET /ml/backtests/{id}/trades` – trades paginados.

### Dados/Infra
- `GET /ml/data/status` – saúde do dataset/event bars.
- `WS /ws/ml` – atualizações em tempo real de treino/teste.

### Armazenamento (metadados)
- Tabelas (ou coleções): `ml_experiments`, `ml_metrics`, `ml_feature_importance`, `ml_backtests`, `ml_backtest_trades`.
- Artefatos em disco/objeto: dataset binário LightGBM, modelos (Pickle/ONNX/TorchScript), config YAML/JSON.

---

## Produção e Latência (20 GB de RAM, 1–2s)

### Boas Práticas
- **Features incrementais**: buffers em memória (ring buffer), métricas rolling sem recomputar histórico.
- **Micro‑batching**: agregar novos eventos a cada 100–200 ms antes da inferência.
- **Servir modelos**: LightGBM com Treelite/ONNX; PyTorch com TorchScript/ONNX; quantização int8 se necessário.
- **Arquitetura assíncrona**: filas para CPU‑bound (ProcessPool), timeouts e “cooldowns” por ativo.
- **Monitoramento**: logs estruturados, métricas Prometheus/Grafana para latência e throughput.

---

## Roadmap de Implementação

### Fase 1 – Baseline LightGBM
- ETL de `ticks_raw` → event bars + features + labels.
- Treino LightGBM com early stopping; validação walk‑forward; backtest com custos e latência simulada.
- Página AI Lab (MVP): controle, treino ao vivo, comparador, backtest, saúde dos dados.

### Fase 2 – Modelos Sequenciais
- TCN pequeno (campo receptivo 8k–12k) e/ou GRU pequena.
- Comparar contra baseline; manter latência ≤ 2s.

### Fase 3 – Longo Contexto
- SSM (Mamba/S4) pequeno; Transformer eficiente (Transformer‑XL/Longformer/PatchTST) pequeno, se necessário.
- Promotion apenas se ganhos netos e estabilidade em múltiplos períodos.

---

## Riscos e Mitigações
- **Custos e slippage**: thresholds conservadores; operar só quando edge > custo; execução inteligente.
- **Overfitting**: walk‑forward, regularização, min_data_in_leaf, validação em múltiplas janelas.
- **Mudança de regime**: re‑treino frequente, monitoramento de degradação, desligar em regime hostil.
- **Latência**: micro‑batching, buffers, modelos pequenos/otimizados, profiling contínuo.

---

## KPIs Principais
- AUC/PR, Logloss (treino/val/teste), PnL/Sharpe netos, Max DD, turnover, hit rate.
- PnL por decil de score, estabilidade por hora do dia/dia da semana.
- Latência p50/p95 e throughput (eventos/s).

---

## Próximos Passos (ação)
- Implementar ETL → Dataset LightGBM binário (com `save_binary`).
- Criar serviço de treino (endpoints) e UI AI Lab (MVP) conforme especificação.
- Rodar 1º experimento baseline e um backtest com custos realistas; iterar.


