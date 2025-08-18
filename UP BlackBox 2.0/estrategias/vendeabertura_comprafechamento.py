import pandas as pd
from datetime import datetime
import math

def run_vendeabertura_comprafechamento(csv_path, dia_semana=None):
    """
    Estratégia inversa da CompraFechamento_VendeAbertura.
    
    Lógica:
    - Vende na abertura do dia
    - Compra no fechamento do mesmo dia
    - Retorno = (abertura - fechamento) / abertura
    
    Esta estratégia se beneficia quando o preço cai durante o dia (abertura > fechamento).
    """
    # Lê o CSV
    df = pd.read_csv(csv_path, sep=',', on_bad_lines='skip')
    df['date'] = pd.to_datetime(df['date'], format='%d/%m/%Y %H:%M')
    df = df.sort_values('date').reset_index(drop=True)
    # Dia da semana: Monday=0 ... Sunday=6
    df['weekday'] = df['date'].dt.weekday
    
    # Estratégia: vende na abertura, compra no fechamento do mesmo dia
    # Como vendemos na abertura e compramos no fechamento:
    # Retorno = (preço_venda - preço_compra) / preço_venda = (open - close) / open
    df['retorno_estrategia'] = (df['open'] - df['close']) / df['open']
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
    for i in range(len(df)):
        if dia_semana is not None:
            try:
                dia_semana_int = int(dia_semana)
            except Exception:
                dia_semana_int = None
            if dia_semana_int is not None and int(df.at[i, 'weekday']) != dia_semana_int:
                continue
        # Para cada linha, temos um trade completo no mesmo dia
        entrada_data = df.at[i, 'date']  # Venda na abertura
        entrada_preco = df.at[i, 'open']  # Preço de venda (abertura)
        saida_data = df.at[i, 'date']     # Compra no fechamento (mesmo dia)
        saida_preco = df.at[i, 'close']   # Preço de compra (fechamento)
        
        # Retorno da operação de venda (retorno positivo quando open > close)
        retorno = (entrada_preco - saida_preco) / entrada_preco
        
        trades.append({
            'entrada_data': entrada_data.strftime('%Y-%m-%d %H:%M'),
            'entrada_preco': float(entrada_preco),  # Preço de venda
            'saida_data': saida_data.strftime('%Y-%m-%d %H:%M'),
            'saida_preco': float(saida_preco),      # Preço de compra
            'retorno': float(retorno)
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
    retorno_total_estrategia = float(df['equity_estrategia'].iloc[-1]) - 1 if not df.empty else 0
    
    if n_operacoes > 0:
        produto = 1.0
        for trade in trades:
            produto *= (1 + trade['retorno'])
        
        try:
            retorno_por_trade = produto ** (1 / n_operacoes) - 1
            if not math.isfinite(retorno_por_trade) or retorno_por_trade == 0.0:
                # Fallback para média aritmética
                retorno_por_trade = sum(t['retorno'] for t in trades) / n_operacoes
        except Exception:
            # Fallback para média aritmética
            retorno_por_trade = sum(t['retorno'] for t in trades) / n_operacoes
    else:
        retorno_por_trade = 0.0
    
    retorno_por_trade_percent = round(retorno_por_trade * 100, 3)
    
    # Calcular tempo posicionado
    # Como cada trade dura apenas 1 dia (abertura -> fechamento), tempo = número de trades
    tempo_posicionado = n_operacoes
    total_linhas = len(df)
    
    # Estatísticas de vencedores e perdedores
    vencedores = [t for t in trades if t['retorno'] > 0]
    perdedores = [t for t in trades if t['retorno'] <= 0]
    
    pct_vencedores = (len(vencedores) / n_operacoes * 100) if n_operacoes > 0 else 0.0
    ganho_medio_vencedores = (sum(t['retorno'] for t in vencedores) / len(vencedores)) if vencedores else 0.0
    tempo_medio_vencedores = 1.0  # Cada trade dura 1 dia
    perda_medio_perdedores = (sum(t['retorno'] for t in perdedores) / len(perdedores)) if perdedores else 0.0
    tempo_medio_perdedores = 1.0  # Cada trade dura 1 dia
    
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
            'dia_semana': 'Dia da semana permitido para iniciar a operação (0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex).'
        }
    } 