import pandas as pd
from datetime import datetime
import math

def run_predictCandle(csv_path, y=2, w=10, x=1, stop_loss=-0.05, take_profit=0.08):
    """
    Estratégia que compra na abertura quando o candle anterior teve variação entre Y% e W%.
    Mantém a posição por até X candles, verificando stop/take profit.
    
    Parâmetros:
      y: Percentual mínimo de variação no candle anterior (ex: 2 = 2%)
      w: Percentual máximo de variação no candle anterior (ex: 10 = 10%)
      x: Número máximo de candles para manter a posição (ex: 1 = mesmo candle, 5 = até 5 candles)
      stop_loss: Stop loss percentual (ex: -0.05 para -5%)
      take_profit: Take profit percentual (ex: 0.08 para +8%)
    
    Retorna:
      Dicionário com todos os dados necessários para o backtest
    """
    
    # 1. LER E PREPARAR OS DADOS
    df = pd.read_csv(csv_path, sep=',', on_bad_lines='skip')
    df['date'] = pd.to_datetime(df['date'], format='%d/%m/%Y %H:%M')
    df = df.sort_values('date').reset_index(drop=True)
    
    # Converter Y e W para decimal se necessário (se vier como 2 ou -2, vira 0.02 ou -0.02)
    # Usar abs() para funcionar com valores negativos também
    y_decimal = y / 100 if abs(y) > 1 else y
    w_decimal = w / 100 if abs(w) > 1 else w
    
    # Validar faixa: W deve ser >= Y
    if w_decimal < y_decimal:
        # Trocar valores se W < Y
        y_decimal, w_decimal = w_decimal, y_decimal
    
    # 2. CALCULAR ALTA DO CANDLE ANTERIOR
    # Alta = (close - open) / open do candle anterior
    df['alta_candle_anterior'] = (df['close'].shift(1) - df['open'].shift(1)) / df['open'].shift(1)
    # Não preencher NaN com 0, pois isso pode gerar sinais falsos
    # Manter NaN e garantir que não gere sinal de compra
    
    # Sinal de compra: variação do candle anterior está entre Y% e W% (inclusivo)
    # Se Y == W, compra apenas se variação for exatamente igual
    # Garantir que NaN não gere sinal (primeira linha não tem candle anterior)
    if y_decimal == w_decimal:
        df['sinal_compra'] = (df['alta_candle_anterior'] == y_decimal) & (df['alta_candle_anterior'].notna())
    else:
        df['sinal_compra'] = (df['alta_candle_anterior'] >= y_decimal) & (df['alta_candle_anterior'] <= w_decimal) & (df['alta_candle_anterior'].notna())
    
    # 3. EXECUTAR OS TRADES
    trades = []
    df['retorno_estrategia'] = 0.0
    
    i = 1  # Começar do índice 1, pois precisamos do candle anterior
    while i < len(df):
        if df.at[i, 'sinal_compra']:
            entrada_idx = i
            entrada_data = df.at[entrada_idx, 'date']
            entrada_preco = df.at[entrada_idx, 'open']  # Compra na abertura
            saida_idx = None
            saida_data = None
            saida_preco = None
            retorno = None
            
            # Verificar saída nos próximos X candles (do candle i até i+X-1)
            for j in range(x):
                if entrada_idx + j >= len(df):
                    break
                
                # Preços mínimos e máximos do candle atual
                min_preco = df.at[entrada_idx + j, 'low'] if 'low' in df.columns else df.at[entrada_idx + j, 'close']
                max_preco = df.at[entrada_idx + j, 'high'] if 'high' in df.columns else df.at[entrada_idx + j, 'close']
                
                # Preços de stop loss e take profit
                stop_price = entrada_preco * (1 + stop_loss)
                take_price = entrada_preco * (1 + take_profit)
                
                # Verificar stop loss
                if min_preco <= stop_price:
                    saida_idx = entrada_idx + j
                    saida_data = df.at[saida_idx, 'date']
                    saida_preco = stop_price
                    retorno = (saida_preco - entrada_preco) / entrada_preco
                    break
                
                # Verificar take profit
                if max_preco >= take_price:
                    saida_idx = entrada_idx + j
                    saida_data = df.at[saida_idx, 'date']
                    saida_preco = take_price
                    retorno = (saida_preco - entrada_preco) / entrada_preco
                    break
            
            # Se não saiu por stop ou gain, sai no fechamento do X-ésimo candle
            if saida_idx is None and entrada_idx + x - 1 < len(df):
                saida_idx = entrada_idx + x - 1
                saida_data = df.at[saida_idx, 'date']
                saida_preco = df.at[saida_idx, 'close']
                retorno = (saida_preco - entrada_preco) / entrada_preco
            
            # Registrar trade se houve saída
            if saida_idx is not None:
                trades.append({
                    'entrada_data': entrada_data.strftime('%Y-%m-%d %H:%M'),
                    'entrada_preco': float(entrada_preco),
                    'saida_data': saida_data.strftime('%Y-%m-%d %H:%M'),
                    'saida_preco': float(saida_preco),
                    'retorno': float(retorno)
                })
                df.at[saida_idx, 'retorno_estrategia'] = retorno
                i = saida_idx + 1  # Pula para depois da venda
            else:
                i += 1
        else:
            i += 1
    
    # 4. CALCULAR MÉTRICAS E RESULTADOS
    
    # Equity curve da estratégia
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
    
    # Drawdown da estratégia
    roll_max_estrategia = df['equity_estrategia'].cummax()
    drawdown_estrategia = (df['equity_estrategia'] - roll_max_estrategia) / roll_max_estrategia
    drawdown_curve_estrategia = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], drawdown_estrategia)
    ]
    
    # Drawdown do ativo
    roll_max_ativo = df['equity_ativo'].cummax()
    drawdown_ativo = (df['equity_ativo'] - roll_max_ativo) / roll_max_ativo
    drawdown_curve_ativo = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], drawdown_ativo)
    ]
    
    # 5. CALCULAR ESTATÍSTICAS
    
    n_operacoes = len(trades)
    retorno_total_estrategia = float(df['equity_estrategia'].iloc[-1]) - 1 if not df.empty else 0
    
    # Retorno por trade (média geométrica)
    if n_operacoes > 0:
        produto = 1.0
        for t in trades:
            produto *= (1 + t['retorno'])
        try:
            retorno_por_trade = produto ** (1 / n_operacoes) - 1
            if not math.isfinite(retorno_por_trade) or retorno_por_trade == 0.0:
                # Fallback para média aritmética
                retorno_por_trade = sum(t['retorno'] for t in trades) / n_operacoes
        except Exception:
            retorno_por_trade = sum(t['retorno'] for t in trades) / n_operacoes
    else:
        retorno_por_trade = 0.0
    
    retorno_por_trade_percent = round(retorno_por_trade * 100, 3)
    
    # Tempo posicionado
    tempo_posicionado = 0
    for trade in trades:
        entrada_idx = df.index[df['date'] == pd.to_datetime(trade['entrada_data'])][0]
        saida_idx = df.index[df['date'] == pd.to_datetime(trade['saida_data'])][0]
        tempo_posicionado += saida_idx - entrada_idx + 1
    
    total_linhas = len(df)
    
    # Estatísticas de vencedores e perdedores
    vencedores = [t for t in trades if t['retorno'] > 0]
    perdedores = [t for t in trades if t['retorno'] <= 0]
    
    pct_vencedores = (len(vencedores) / n_operacoes * 100) if n_operacoes > 0 else 0.0
    ganho_medio_vencedores = (sum(t['retorno'] for t in vencedores) / len(vencedores)) if vencedores else 0.0
    perda_medio_perdedores = (sum(t['retorno'] for t in perdedores) / len(perdedores)) if perdedores else 0.0
    
    # Tempo médio dos trades
    tempo_medio_vencedores = (sum([
        df.index[df['date'] == pd.to_datetime(t['saida_data'])][0] - df.index[df['date'] == pd.to_datetime(t['entrada_data'])][0] + 1
        for t in vencedores
    ]) / len(vencedores)) if vencedores else 0.0
    
    tempo_medio_perdedores = (sum([
        df.index[df['date'] == pd.to_datetime(t['saida_data'])][0] - df.index[df['date'] == pd.to_datetime(t['entrada_data'])][0] + 1
        for t in perdedores
    ]) / len(perdedores)) if perdedores else 0.0
    
    # 6. RETORNAR RESULTADOS
    
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

