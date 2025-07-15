# Como Criar uma Nova Estratégia no UP BlackBox 2.0

Este guia mostra o passo a passo para adicionar uma nova estratégia de backtest ao sistema, incluindo exemplos de código, integração backend (FastAPI) e frontend (Next.js/React).

---

## 1. Estrutura do Código da Estratégia (Python)

Crie um novo arquivo em `UP BlackBox 2.0/estrategias/`, por exemplo: `minhaestrategia.py`.

### Exemplo de função de estratégia
```python
import pandas as pd
from datetime import datetime

def run_minhaestrategia(csv_path, param1=3, param2=5, stop_loss=-0.05, take_profit=0.08):
    """
    Descreva a lógica da estratégia aqui.
    Parâmetros:
      param1: descrição
      param2: descrição
      stop_loss: stop loss percentual (ex: -0.05 para -5%)
      take_profit: take profit percentual (ex: 0.08 para +8%)
    """
    df = pd.read_csv(csv_path, sep=',', on_bad_lines='skip')
    df['date'] = pd.to_datetime(df['date'], format='%d/%m/%Y %H:%M')
    df = df.sort_values('date').reset_index(drop=True)
    # ... lógica da estratégia ...
    # Exemplo de trade fictício:
    trades = [{
        'entrada_data': '2024-01-01 17:00',
        'entrada_preco': 10.0,
        'saida_data': '2024-01-10 17:00',
        'saida_preco': 11.0,
        'retorno': 0.1
    }]
    # Equity curve da estratégia
    df['retorno_estrategia'] = 0.0
    df['equity_estrategia'] = (1 + df['retorno_estrategia']).cumprod()
    equity_curve_estrategia = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], df['equity_estrategia'])
    ]
    # Equity curve do ativo (buy and hold)
    df['retorno_ativo'] = df['close'].pct_change().fillna(0)
    df['equity_ativo'] = (1 + df['retorno_ativo']).cumprod()
    equity_curve_ativo = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], df['equity_ativo'])
    ]
    # Drawdown estratégia
    roll_max_estrategia = df['equity_estrategia'].cummax()
    drawdown_estrategia = (df['equity_estrategia'] - roll_max_estrategia) / roll_max_estrategia
    drawdown_curve_estrategia = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], drawdown_estrategia)
    ]
    # Drawdown ativo
    roll_max_ativo = df['equity_ativo'].cummax()
    drawdown_ativo = (df['equity_ativo'] - roll_max_ativo) / roll_max_ativo
    drawdown_curve_ativo = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], drawdown_ativo)
    ]
    # Estatísticas obrigatórias
    n_operacoes = len(trades)
    retorno_total_estrategia = float(df['equity_estrategia'].iloc[-1]) - 1 if not df.empty else 0
    if n_operacoes > 0:
        produto = 1.0
        for t in trades:
            produto *= (1 + t['retorno'])
        retorno_por_trade = produto ** (1 / n_operacoes) - 1
    else:
        retorno_por_trade = 0.0
    retorno_por_trade_percent = round(retorno_por_trade * 100, 3)
    tempo_posicionado = 0
    for trade in trades:
        entrada_idx = df.index[df['date'] == pd.to_datetime(trade['entrada_data'])][0]
        saida_idx = df.index[df['date'] == pd.to_datetime(trade['saida_data'])][0]
        tempo_posicionado += saida_idx - entrada_idx + 1
    total_linhas = len(df)
    vencedores = [t for t in trades if t['retorno'] > 0]
    perdedores = [t for t in trades if t['retorno'] <= 0]
    pct_vencedores = (len(vencedores) / n_operacoes * 100) if n_operacoes > 0 else 0.0
    ganho_medio_vencedores = (sum(t['retorno'] for t in vencedores) / len(vencedores)) if vencedores else 0.0
    tempo_medio_vencedores = (sum([
        df.index[df['date'] == pd.to_datetime(t['saida_data'])][0] - df.index[df['date'] == pd.to_datetime(t['entrada_data'])][0] + 1
        for t in vencedores
    ]) / len(vencedores)) if vencedores else 0.0
    perda_medio_perdedores = (sum(t['retorno'] for t in perdedores) / len(perdedores)) if perdedores else 0.0
    tempo_medio_perdedores = (sum([
        df.index[df['date'] == pd.to_datetime(t['saida_data'])][0] - df.index[df['date'] == pd.to_datetime(t['entrada_data'])][0] + 1
        for t in perdedores
    ]) / len(perdedores)) if perdedores else 0.0
    return {
        'equity_curve_estrategia': equity_curve_estrategia,
        'equity_curve_ativo': equity_curve_ativo,
        'drawdown_estrategia': drawdown_curve_estrategia,
        'drawdown_ativo': drawdown_curve_ativo,
        'n_operacoes': n_operacoes,
        'retorno_total_estrategia': retorno_total_estrategia,
        'retorno_total_ativo': float(df['equity_ativo'].iloc[-1]) - 1 if not df.empty else 0,
        'retorno_por_trade': retorno_por_trade,
        'retorno_por_trade_percent': retorno_por_trade_percent,
        'trades': trades,
        'tempo_posicionado': int(tempo_posicionado),
        'total_linhas': int(total_linhas),
        'pct_vencedores': pct_vencedores,
        'ganho_medio_vencedores': ganho_medio_vencedores,
        'tempo_medio_vencedores': tempo_medio_vencedores,
        'perda_medio_perdedores': perda_medio_perdedores,
        'tempo_medio_perdedores': tempo_medio_perdedores
    }
```

### Dados e estatísticas obrigatórios (sempre exportar):
- `equity_curve_estrategia`: lista de dicionários com data e valor da curva da estratégia
- `equity_curve_ativo`: lista de dicionários com data e valor da curva do ativo (buy and hold)
- `drawdown_estrategia`: lista de dicionários com data e valor do drawdown da estratégia
- `drawdown_ativo`: lista de dicionários com data e valor do drawdown do ativo
- `trades`: lista de trades (entrada, saída, preços, retorno)
- `n_operacoes`: número de operações
- `retorno_total_estrategia`, `retorno_total_ativo`
- `retorno_por_trade`, `retorno_por_trade_percent`
- `tempo_posicionado`, `total_linhas`
- `pct_vencedores`, `ganho_medio_vencedores`, `tempo_medio_vencedores`, `perda_medio_perdedores`, `tempo_medio_perdedores`

---

## 2. Integração ao Backend (FastAPI)

1. Importe a função no `main.py`:
```python
from estrategias.minhaestrategia import run_minhaestrategia
```
2. Adicione um bloco no endpoint `/api/run-backtest`:
```python
elif estrategia_nome.lower() == 'minhaestrategia':
    param1 = parametros.get('param1', 3)
    param2 = parametros.get('param2', 5)
    stop_loss = parametros.get('stop_loss', -0.05)
    take_profit = parametros.get('take_profit', 0.08)
    resultado = run_minhaestrategia(tmp_path, param1, param2, stop_loss, take_profit)
    backtest_doc = {
        'base_dados': base_nome,
        'estrategia': estrategia_nome,
        'criadoEm': firestore.SERVER_TIMESTAMP,
        'equity_curve_estrategia': resultado['equity_curve_estrategia'],
        'equity_curve_ativo': resultado['equity_curve_ativo'],
        'drawdown_estrategia': resultado.get('drawdown_estrategia'),
        'drawdown_ativo': resultado.get('drawdown_ativo'),
        'trades': resultado['trades'],
        'metrics': {
            'n_operacoes': resultado['n_operacoes'],
            'retorno_total_estrategia': resultado['retorno_total_estrategia'],
            'retorno_total_ativo': resultado['retorno_total_ativo'],
            'retorno_por_trade': resultado['retorno_por_trade'],
            'retorno_por_trade_percent': resultado['retorno_por_trade_percent'],
            'param1': param1,
            'param2': param2,
            'stop_loss': stop_loss,
            'take_profit': take_profit,
            'pct_vencedores': resultado.get('pct_vencedores'),
            'ganho_medio_vencedores': resultado.get('ganho_medio_vencedores'),
            'tempo_medio_vencedores': resultado.get('tempo_medio_vencedores'),
            'perda_medio_perdedores': resultado.get('perda_medio_perdedores'),
            'tempo_medio_perdedores': resultado.get('tempo_medio_perdedores'),
        },
        'parametros': {'param1': param1, 'param2': param2, 'stop_loss': stop_loss, 'take_profit': take_profit},
        'tempo_posicionado': resultado.get('tempo_posicionado'),
        'total_linhas': resultado.get('total_linhas'),
    }
```
3. Pronto! Agora a estratégia pode ser chamada via API.

---

## 3. Integração ao Frontend (Next.js/React)

### a) Adicione a estratégia na lista de seleção
No arquivo do modal de novo backtest (ex: `src/app/dashboard/up-blackbox2/backtest/page.tsx`):
- Adicione a estratégia na lista de opções.
- Crie inputs para os parâmetros necessários.
- Envie os parâmetros corretamente ao backend.

#### Exemplo:
```tsx
// ...
const estrategias = [
  { value: "comprafechamento_vendeabertura", label: "CompraFechamento_VendeAbertura" },
  { value: "buyifstockupxpercentage", label: "BuyIfStockUpXPercentage" },
  { value: "minhaestrategia", label: "MinhaEstratégia" },
];
// ...
{selectedEstrategia === "minhaestrategia" && (
  <div>
    <input type="number" value={param1} onChange={e => setParam1(Number(e.target.value))} />
    <input type="number" value={param2} onChange={e => setParam2(Number(e.target.value))} />
    <input type="number" value={paramStopLoss} onChange={e => setParamStopLoss(Number(e.target.value))} />
    <input type="number" value={paramTakeProfit} onChange={e => setParamTakeProfit(Number(e.target.value))} />
  </div>
)}
// ...
if (selectedEstrategia === "minhaestrategia") {
  body.parametros = {
    param1,
    param2,
    stop_loss: paramStopLoss / 100,
    take_profit: paramTakeProfit / 100,
  };
}
```

### b) Exiba os parâmetros e explicação na tela de detalhes do backtest
```tsx
{backtest.estrategia && backtest.estrategia.toLowerCase() === "minhaestrategia" && (
  <div>
    Estratégia MinhaEstratégia com param1={backtest.parametros?.param1}, param2={backtest.parametros?.param2},
    stop loss={backtest.parametros?.stop_loss}, take profit={backtest.parametros?.take_profit}
  </div>
)}
```

---

## 4. Checklist Final
- [ ] Função Python criada e testada
- [ ] Exporta todos os dados e estatísticas obrigatórios
- [ ] Integrada ao backend (FastAPI)
- [ ] Integrada ao frontend (inputs, envio de parâmetros, exibição)
- [ ] Testada rodando um backtest real

---

Se seguir este guia, sua estratégia estará disponível para todos os usuários do sistema! 