import pandas as pd
from datetime import datetime
import math

def run_comprafechamento_vendeabertura(csv_path, dia_semana=None):
    # Lê o CSV
    df = pd.read_csv(csv_path, sep=',', on_bad_lines='skip')
    df['date'] = pd.to_datetime(df['date'], format='%d/%m/%Y %H:%M')
    df = df.sort_values('date').reset_index(drop=True)
    # Dia da semana: Monday=0 ... Sunday=6
    df['weekday'] = df['date'].dt.weekday
    # Estratégia: compra no fechamento, vende na abertura do dia seguinte
    # Calcula o retorno da estratégia
    df['retorno_estrategia'] = (df['open'].shift(-1) - df['close']) / df['close']
    df['retorno_estrategia'] = df['retorno_estrategia'].fillna(0)
    # Se um dia da semana for especificado, zera retornos nos demais dias para não contar operação
    if dia_semana is not None:
        try:
            dia_semana_int = int(dia_semana)
        except Exception:
            dia_semana_int = None
        if dia_semana_int is not None:
            df.loc[df['weekday'] != dia_semana_int, 'retorno_estrategia'] = 0
    df['equity_estrategia'] = (1 + df['retorno_estrategia']).cumprod()
    equity_curve_estrategia = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], df['equity_estrategia'])
    ]
    # Histórico de trades
    trades = []
    for i in range(len(df) - 1):
        if dia_semana is not None:
            try:
                dia_semana_int = int(dia_semana)
            except Exception:
                dia_semana_int = None
            if dia_semana_int is not None and int(df.at[i, 'weekday']) != dia_semana_int:
                continue
        entrada_data = df.at[i, 'date']
        entrada_preco = df.at[i, 'close']
        saida_data = df.at[i + 1, 'date']
        saida_preco = df.at[i + 1, 'open']
        trades.append({
            'entrada_data': entrada_data.strftime('%Y-%m-%d %H:%M'),
            'entrada_preco': float(entrada_preco),
            'saida_data': saida_data.strftime('%Y-%m-%d %H:%M'),
            'saida_preco': float(saida_preco)
        })
    # Equity curve do ativo (buy and hold no fechamento)
    df['retorno_ativo'] = df['close'].pct_change().fillna(0)
    df['equity_ativo'] = (1 + df['retorno_ativo']).cumprod()
    equity_curve_ativo = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], df['equity_ativo'])
    ]
    # Cálculo do drawdown da estratégia
    roll_max_estrategia = df['equity_estrategia'].cummax()
    drawdown_estrategia = (df['equity_estrategia'] - roll_max_estrategia) / roll_max_estrategia
    drawdown_curve_estrategia = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], drawdown_estrategia)
    ]
    # Cálculo do drawdown do ativo
    roll_max_ativo = df['equity_ativo'].cummax()
    drawdown_ativo = (df['equity_ativo'] - roll_max_ativo) / roll_max_ativo
    drawdown_curve_ativo = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], drawdown_ativo)
    ]
    # Cálculo correto: média geométrica dos retornos
    n_operacoes = len(trades)
    if n_operacoes > 0:
        produto = 1.0
        for i in range(n_operacoes):
            entrada_preco = trades[i]['entrada_preco']
            saida_preco = trades[i]['saida_preco']
            retorno = (saida_preco - entrada_preco) / entrada_preco
            produto *= (1 + retorno)
        try:
            retorno_por_trade = produto ** (1 / n_operacoes) - 1
            if not math.isfinite(retorno_por_trade) or retorno_por_trade == 0.0:
                n_vencedores = len([t for t in trades if (t['saida_preco'] - t['entrada_preco']) > 0])
                n_perdedores = len([t for t in trades if (t['saida_preco'] - t['entrada_preco']) <= 0])
                ganho_medio_vencedores = (sum((t['saida_preco'] - t['entrada_preco']) / t['entrada_preco'] for t in trades if (t['saida_preco'] - t['entrada_preco']) > 0) / n_vencedores) if n_vencedores > 0 else 0.0
                perda_medio_perdedores = (sum((t['saida_preco'] - t['entrada_preco']) / t['entrada_preco'] for t in trades if (t['saida_preco'] - t['entrada_preco']) <= 0) / n_perdedores) if n_perdedores > 0 else 0.0
                retorno_por_trade = (
                    n_vencedores * ganho_medio_vencedores +
                    n_perdedores * perda_medio_perdedores
                ) / n_operacoes
        except Exception:
            n_vencedores = len([t for t in trades if (t['saida_preco'] - t['entrada_preco']) > 0])
            n_perdedores = len([t for t in trades if (t['saida_preco'] - t['entrada_preco']) <= 0])
            ganho_medio_vencedores = (sum((t['saida_preco'] - t['entrada_preco']) / t['entrada_preco'] for t in trades if (t['saida_preco'] - t['entrada_preco']) > 0) / n_vencedores) if n_vencedores > 0 else 0.0
            perda_medio_perdedores = (sum((t['saida_preco'] - t['entrada_preco']) / t['entrada_preco'] for t in trades if (t['saida_preco'] - t['entrada_preco']) <= 0) / n_perdedores) if n_perdedores > 0 else 0.0
            retorno_por_trade = (
                n_vencedores * ganho_medio_vencedores +
                n_perdedores * perda_medio_perdedores
            ) / n_operacoes
    else:
        retorno_por_trade = 0.0
    retorno_por_trade_percent = round(retorno_por_trade * 100, 3)
    # Calcular tempo posicionado (quantidade de linhas entre entrada e saída de cada trade)
    tempo_posicionado = 0
    for trade in trades:
        entrada_idx = df.index[df['date'] == pd.to_datetime(trade['entrada_data'])][0]
        saida_idx = df.index[df['date'] == pd.to_datetime(trade['saida_data'])][0]
        tempo_posicionado += saida_idx - entrada_idx + 1  # inclui o dia de entrada e saída
    total_linhas = len(df)
    # Estatísticas de vencedores e perdedores
    vencedores = [t for t in trades if (t['saida_preco'] - t['entrada_preco']) > 0]
    perdedores = [t for t in trades if (t['saida_preco'] - t['entrada_preco']) <= 0]
    pct_vencedores = (len(vencedores) / n_operacoes * 100) if n_operacoes > 0 else 0.0
    ganho_medio_vencedores = (sum((t['saida_preco'] - t['entrada_preco']) / t['entrada_preco'] for t in vencedores) / len(vencedores)) if vencedores else 0.0
    tempo_medio_vencedores = (sum([
        df.index[df['date'] == pd.to_datetime(t['saida_data'])][0] - df.index[df['date'] == pd.to_datetime(t['entrada_data'])][0] + 1
        for t in vencedores
    ]) / len(vencedores)) if vencedores else 0.0
    perda_medio_perdedores = (sum((t['saida_preco'] - t['entrada_preco']) / t['entrada_preco'] for t in perdedores) / len(perdedores)) if perdedores else 0.0
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
        'retorno_total_estrategia': float(df['equity_estrategia'].iloc[-1]) - 1 if not df.empty else 0,
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
            'dia_semana': 'Dia da semana permitido para iniciar a operação (0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex).'
        }
    } 