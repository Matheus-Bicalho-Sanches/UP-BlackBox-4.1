# Motion Tracker – Diagnóstico Atual

## Objetivo Original

O Motion Tracker deveria transformar os ticks que captamos em tempo real em alertas úteis sobre robôs operando padrões repetitivos (ex.: TWAP à mercado). Esses alertas devem aparecer quase instantaneamente na aba "Start/Stop", enquanto a aba "Padrões Detectados" exibiria um estado consolidado do dia (ativos e inativos) com possibilidade de auditoria via "Listar Operações". A implementação atual bloqueia esse fluxo em vários pontos.

## 1. Pipeline de detecção não roda de forma contínua

- `services/high_frequency/main.py` agenda as tasks `start_twap_detection`, `start_inactivity_monitoring` e `start_volume_percentage_monitoring` **antes** de `system_initialized` ser marcado como `True`. Como cada coroutine aborta quando encontra `system_initialized=False`, nenhuma delas entra no loop periódico. Resultado: nenhum padrão é detectado, nenhum status é atualizado e o WebSocket nunca emite notificações.
- Mesmo que as tarefas rodassem, o detector nunca repopula `active_patterns` a partir do banco ao reiniciar. Após um restart, tudo começa vazio até que a primeira rodada de detecção conclua.
- A janela de análise é executada apenas a cada 60 segundos e depende de consultas longas ao banco (`get_recent_ticks*`). Sem indexação dedicada ou filtragem incremental, o custo de varrer 24h para muitos símbolos tende a inviabilizar respostas em tempo real.

## 2. Persistência e APIs não entregam dados úteis

- `/robots/patterns` retorna somente o cache em memória de `twap_detector.get_active_patterns()`. Se a detecção não rodou (ou ainda não rodou após o boot), o endpoint devolve `[]`, independentemente do conteúdo salvo em `robot_patterns`.
- `/robots/status-changes` e `/robots/all-changes` dependem do histórico mantido em `RobotStatusTracker`. Esse histórico só é alimentado por `add_status_change`/`add_type_change`, que por sua vez só são chamados dentro do fluxo de detecção e monitoramento. Sem o pipeline ativo, a aba "Start/Stop" fica permanentemente vazia.
- O endpoint `/robots/{symbol}/{agent_id}/trades` usa `robot_trades`, mas os trades só são salvos quando `MarketTWAPDetector.save_pattern_and_trades` é chamado. Com o pipeline parado, o botão "Listar Operações" sempre recebe `[]`.

## 3. Integração WebSocket não fornece start/stop em tempo real

- As notificações em `start_stop` foram pensadas para vir tanto do WebSocket quanto de um fallback de polling. Contudo, o WebSocket nunca chama `broadcast_status_change` porque nenhuma mudança chega a ser registrada.
- Não há mecanismo de replay no momento da conexão. Se o usuário abre a página após um evento importante, ele não recebe o histórico recente sem depender das chamadas HTTP (que, como vimos, devolvem vazio quando o pipeline não rodou).

## 4. Problemas de UX e filtragem no frontend (`motion-tracker/page.tsx`)

- A lista de símbolos (`mockSymbols`) é fixa e pode não refletir o que o backend realmente está monitorando. Falta sincronização com a API (ex.: `/subscriptions` ou um endpoint dedicado).
- A aba "Padrões" filtra por tipos de robô com base em `robot_type`. Como o detector padrão TWAP usa valores `Robô Tipo 0/1/2/3` e o TWAP à mercado usa `TWAP à Mercado`, qualquer inconsistência de nomenclatura impede a exibição.
- O modal de operações assume que o backend sempre retorna preços e volumes corretos já formatados; não há tratamento para ausência parcial de dados (por exemplo, se apenas parte dos trades matching foi salva).
- Indicadores de carregamento: `loading` global é reutilizado para múltiplos fetches e pode esconder loaders individuais. Ao trocar de símbolo, alguns cards exibem `...` mesmo quando os endpoints retornam erro.

## 5. Resiliência & Observabilidade

- Não há testes automáticos cobrindo a detecção (unitários ou integração). É difícil validar mudanças no algoritmo sem rodar o sistema completo com dados reais.
- Faltam métricas e logs de saúde expostos via alguma dashboard para saber se as tasks estão rodando, quantos padrões foram detectados na última rodada, tempo gasto nas queries etc.
- Sem índices específicos em `ticks_raw` (por `symbol`, `timestamp`, `buy_agent`/`sell_agent`), consultas recorrentes podem saturar o banco conforme o volume cresce.

## Recomendações

1. **Corrigir inicialização das tasks**: diferir `asyncio.create_task(...)` para depois de `init_high_frequency_systems()` ou mover o flag `system_initialized = True` para antes de agendá-las.
2. **Carregar padrões existentes na memória** ao subir o backend e oferecer um endpoint que leia diretamente do banco (com paginação) para garantir dados mesmo se o detector estiver em manutenção.
3. **Melhorar o WebSocket**: suportar replay inicial (ex.: enviar as últimas N mudanças assim que o cliente se conecta), enviar heartbeats e tratar reconexões lado servidor.
4. **Refinar ux do frontend**: buscar símbolos dinamicamente, separar loaders por aba, evidenciar quando os dados vêm de cache histórico vs tempo real, validar filtros múltiplos (status + tipo).
5. **Adicionar observabilidade e testes**: métricas (quantos padrões ativos, latência da última rodada), dashboards simples, testes unitários para `_get_matching_trades_for_pattern` e para a lógica de persistência de trades.
6. **Planejar indexação/ETL incremental**: criar índices necessários, avaliar reduzir janelas (por exemplo, carregar apenas últimos X minutos por padrão em vez de 24h) e registrar checkpoints para não reprocessar o mesmo período repetidamente.

Seguindo esse roteiro, conseguimos aproximar o funcionamento real do Motion Tracker ao que foi idealizado: alertas confiáveis, dados auditáveis e uma interface responsiva mesmo com reboots ou falhas temporárias.

