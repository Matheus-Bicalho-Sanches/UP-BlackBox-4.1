import pandas as pd
from datetime import datetime
import math

def run_operandomomentum(csv_path, x=0.05, y=5, w=5, stop_loss=-0.05, take_profit=0.08, dia_semana=None):
    """
    Estratégia Operandomomentum:
    - Compra no fechamento quando a ação tiver subido (x>0) ou caído (x<0) pelo menos x% nos últimos y períodos.
    - Saída por w períodos, stop loss (z) ou take profit (z), o que ocorrer primeiro.
    Parâmetros:
      x: percentual de variação (positivo = alta, negativo = queda)
      y: número de períodos para cálculo do movimento
      w: número de períodos de hold máximo
      stop_loss: stop loss percentual (ex: -0.05 para -5%)
      take_profit: take profit percentual (ex: 0.08 para +8%)
    """
    df = pd.read_csv(csv_path, sep=',', on_bad_lines='skip')
    print('==== DEBUG: df.head() ===')
    print(df.head())
    print('==== DEBUG: df.dtypes ===')
    print(df.dtypes)
    print('==== DEBUG: df.shape ===')
    print(df.shape)
    df['date'] = pd.to_datetime(df['date'], format='%d/%m/%Y %H:%M')
    df = df.sort_values('date').reset_index(drop=True)
    # Dia da semana: Monday=0 ... Sunday=6
    df['weekday'] = df['date'].dt.weekday

    print('==== DEBUG: Ordem das datas após sort ===')
    print("Primeiras 3 datas:", df['date'].head(3).tolist())
    print("Últimas 3 datas:", df['date'].tail(3).tolist())

    # Calcular variação percentual nos últimos y períodos
    df['var_y'] = df['close'].pct_change(periods=y)
    print(f'==== DEBUG: Variação {y} períodos (x={x}) ===')
    print("Primeiras 10 variações:", df['var_y'].head(10).tolist())

    if x > 0:
        df['sinal'] = df['var_y'] >= x
        print(f"Buscando variações >= {x} ({x*100:.1f}%)")
    else:
        df['sinal'] = df['var_y'] <= x
        print(f"Buscando variações <= {x} ({x*100:.1f}%)")

    sinais = df['sinal'].fillna(False)
    print(f"Total de sinais encontrados: {sinais.sum()}")
    print("Primeiros 10 sinais:", sinais.head(10).tolist())
    trades = []
    df['retorno_estrategia'] = 0.0
    i = 0
    print(f"==== Processando {sinais.sum()} sinais... ===")
    trades_processados = 0
    while i < len(df):
        if sinais.iloc[i]:
            # Se dia da semana foi especificado, só entra se coincidir
            if dia_semana is not None:
                try:
                    dia_semana_int = int(dia_semana)
                except Exception:
                    dia_semana_int = None
                if dia_semana_int is not None and int(df.at[i, 'weekday']) != dia_semana_int:
                    i += 1
                    continue
            entrada_idx = i
            entrada_data = df.at[entrada_idx, 'date']
            entrada_preco = df.at[entrada_idx, 'close']
            
            saida_idx = None
            saida_data = None
            saida_preco = None
            # Checar até w períodos à frente
            for j in range(1, w+1):
                if entrada_idx + j >= len(df):
                    break
                min_preco = df.at[entrada_idx + j, 'low'] if 'low' in df.columns else df.at[entrada_idx + j, 'close']
                max_preco = df.at[entrada_idx + j, 'high'] if 'high' in df.columns else df.at[entrada_idx + j, 'close']
                stop_price = entrada_preco * (1 + stop_loss)
                take_price = entrada_preco * (1 + take_profit)
                if min_preco <= stop_price:
                    saida_idx = entrada_idx + j
                    saida_data = df.at[saida_idx, 'date']
                    saida_preco = stop_price
                    break
                if max_preco >= take_price:
                    saida_idx = entrada_idx + j
                    saida_data = df.at[saida_idx, 'date']
                    saida_preco = take_price
                    break
            # Se não saiu por stop ou gain, sai por tempo (hold máximo)
            if saida_idx is None and entrada_idx + w < len(df):
                saida_idx = entrada_idx + w
                saida_data = df.at[saida_idx, 'date']
                saida_preco = df.at[saida_idx, 'close']
            # Só registra trade se houve saída
            if saida_idx is not None:
                trades.append({
                    'entrada_data': entrada_data.strftime('%Y-%m-%d %H:%M'),
                    'entrada_preco': float(entrada_preco),
                    'saida_data': saida_data.strftime('%Y-%m-%d %H:%M'),
                    'saida_preco': float(saida_preco),
                    'retorno': (saida_preco - entrada_preco) / entrada_preco
                })
                df.at[saida_idx, 'retorno_estrategia'] = (saida_preco - entrada_preco) / entrada_preco
                trades_processados += 1
                # Progresso a cada 100 trades
                if trades_processados % 100 == 0:
                    print(f"Trades processados: {trades_processados}")
                i = saida_idx + 1  # Pular para depois da venda
            else:
                i += 1
        else:
            i += 1

    print(f"==== Processamento concluído. Total trades: {trades_processados} ===")
    df['equity_estrategia'] = (1 + df['retorno_estrategia']).cumprod()
    equity_curve_estrategia = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], df['equity_estrategia'])
    ]
    # Equity curve do ativo (buy and hold no fechamento)
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
    n_operacoes = len(trades)
    retorno_total_estrategia = float(df['equity_estrategia'].iloc[-1]) - 1 if not df.empty else 0
    # Cálculo correto: média geométrica dos retornos
    if n_operacoes > 0:
        produto = 1.0
        for t in trades:
            produto *= (1 + t['retorno'])
        try:
            retorno_por_trade = produto ** (1 / n_operacoes) - 1
            if not math.isfinite(retorno_por_trade) or retorno_por_trade == 0.0:
                n_vencedores = len([t for t in trades if t['retorno'] > 0])
                n_perdedores = len([t for t in trades if t['retorno'] <= 0])
                ganho_medio_vencedores = (sum(t['retorno'] for t in trades if t['retorno'] > 0) / n_vencedores) if n_vencedores > 0 else 0.0
                perda_medio_perdedores = (sum(t['retorno'] for t in trades if t['retorno'] <= 0) / n_perdedores) if n_perdedores > 0 else 0.0
                retorno_por_trade = (
                    n_vencedores * ganho_medio_vencedores +
                    n_perdedores * perda_medio_perdedores
                ) / n_operacoes
        except Exception:
            n_vencedores = len([t for t in trades if t['retorno'] > 0])
            n_perdedores = len([t for t in trades if t['retorno'] <= 0])
            ganho_medio_vencedores = (sum(t['retorno'] for t in trades if t['retorno'] > 0) / n_vencedores) if n_vencedores > 0 else 0.0
            perda_medio_perdedores = (sum(t['retorno'] for t in trades if t['retorno'] <= 0) / n_perdedores) if n_perdedores > 0 else 0.0
            retorno_por_trade = (
                n_vencedores * ganho_medio_vencedores +
                n_perdedores * perda_medio_perdedores
            ) / n_operacoes
    else:
        retorno_por_trade = 0.0
    retorno_por_trade_percent = round(retorno_por_trade * 100, 3)
    tempo_posicionado = 0
    for trade in trades:
        entrada_idx = df.index[df['date'] == pd.to_datetime(trade['entrada_data'])][0]
        saida_idx = df.index[df['date'] == pd.to_datetime(trade['saida_data'])][0]
        tempo_posicionado += saida_idx - entrada_idx + 1  # inclui o dia de entrada e saída
    total_linhas = len(df)
    # Estatísticas de vencedores e perdedores
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
        'tempo_medio_perdedores': tempo_medio_perdedores,
        'parametros_detalhados': {
            'x': f"Percentual de variação nos últimos y períodos para gerar o sinal de compra. Positivo = alta, negativo = queda. Ex: x=0.05 (5%) compra se subir 5% ou mais; x=-0.03 (-3%) compra se cair 3% ou mais.",
            'y': "Quantidade de períodos (dias) para calcular a variação percentual.",
            'w': "Quantidade máxima de períodos (dias) para segurar a posição (hold máximo).",
            'stop_loss': "Stop loss percentual. Exemplo: -0.05 significa vender se cair 5% ou mais.",
            'take_profit': "Take profit percentual. Exemplo: 0.08 significa vender se subir 8% ou mais.",
            'dia_semana': 'Dia da semana permitido para iniciar a operação (0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex).'
        }
    } 