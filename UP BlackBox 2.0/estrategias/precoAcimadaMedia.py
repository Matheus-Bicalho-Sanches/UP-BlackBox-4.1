import pandas as pd
from datetime import datetime
import math

def run_precoAcimadaMedia(csv_path, x=20, stop_loss=-0.05, take_profit=0.08, cooldown=0, horario_entrada_inicio=None, horario_entrada_fim=None, momentum_alta_percent=0, tempo_momentum=0):
    """
    Estratégia que compra quando o preço está acima da média móvel e mantém a posição enquanto o preço permanecer acima.
    
    Parâmetros:
      x: Períodos da média móvel aritmética (padrão: 20)
      stop_loss: Stop loss percentual (ex: -0.05 para -5%)
      take_profit: Take profit percentual (ex: 0.08 para +8%)
      cooldown: Períodos de espera após uma saída antes de permitir nova entrada (padrão: 0)
      horario_entrada_inicio: Horário inicial da janela permitida para entradas (formato "HH:MM"). Se None, não aplica filtro.
      horario_entrada_fim: Horário final da janela permitida para entradas (formato "HH:MM"). Se None, não aplica filtro.
      momentum_alta_percent: Percentual mínimo que a média deve ter subido para permitir entrada (ex: 0.02 para 2%). Se 0, desabilita o filtro.
      tempo_momentum: Quantidade de períodos para olhar para trás no cálculo de momentum (ex: 5). Se 0, desabilita o filtro.
    
    Retorna:
      Dicionário com todos os dados necessários para o backtest
    """
    
    # 1. LER E PREPARAR OS DADOS
    df = pd.read_csv(csv_path, sep=',', on_bad_lines='skip')
    df['date'] = pd.to_datetime(df['date'], format='%d/%m/%Y %H:%M')
    df = df.sort_values('date').reset_index(drop=True)
    
    # 2. CALCULAR MÉDIA MÓVEL
    df['media'] = df['close'].rolling(window=x).mean()
    
    # 3. EXECUTAR OS TRADES
    trades = []
    df['retorno_estrategia'] = 0.0
    i = 0
    has_low = 'low' in df.columns
    has_high = 'high' in df.columns
    cooldown_until_idx = -1  # Índice até o qual o cooldown está ativo (-1 = nenhum cooldown)
    posicao_aberta = False  # Flag para rastrear se há posição aberta
    entrada_idx = None
    entrada_data = None
    entrada_preco = None
    
    while i < len(df):
        # Verificar se estamos em período de cooldown
        if cooldown > 0 and i < cooldown_until_idx:
            i += 1
            continue
        
        # Se não há posição aberta, verificar sinal de compra
        if not posicao_aberta:
            # Verificar se há média calculada
            if pd.isna(df.at[i, 'media']):
                i += 1
                continue
            
            # Sinal de compra: preço cruza acima da média
            # Condição: close[i] > media[i] E (i == 0 OU close[i-1] <= media[i-1])
            if i == 0:
                compra_sinal = df.at[i, 'close'] > df.at[i, 'media']
            else:
                media_anterior = df.at[i-1, 'media'] if not pd.isna(df.at[i-1, 'media']) else None
                if media_anterior is not None:
                    compra_sinal = (df.at[i, 'close'] > df.at[i, 'media']) and (df.at[i-1, 'close'] <= media_anterior)
                else:
                    compra_sinal = df.at[i, 'close'] > df.at[i, 'media']
            
            if compra_sinal:
                entrada_idx = i
                entrada_data = df.at[i, 'date']
                entrada_preco = float(df.at[i, 'close'])
                
                # Validar filtro de momentum de alta (se ativado)
                if tempo_momentum > 0 and momentum_alta_percent > 0:
                    # Verificar se há dados suficientes
                    if i >= tempo_momentum:
                        media_atual = df.at[i, 'media']
                        media_passada = df.at[i - tempo_momentum, 'media']
                        
                        # Verificar se ambas as médias são válidas
                        if not pd.isna(media_atual) and not pd.isna(media_passada) and media_passada > 0:
                            # Verificar se a média subiu pelo menos o percentual exigido
                            if media_atual < media_passada * (1 + momentum_alta_percent):
                                # Não passou no filtro de momentum, pular entrada
                                i += 1
                                continue
                
                # Validar horário de entrada antes de permitir entrada
                if horario_entrada_inicio and horario_entrada_fim:
                    try:
                        hora_entrada = entrada_data.time()
                        hora_inicio = datetime.strptime(horario_entrada_inicio, '%H:%M').time()
                        hora_fim = datetime.strptime(horario_entrada_fim, '%H:%M').time()
                        if not (hora_inicio <= hora_entrada <= hora_fim):
                            # Fora do horário permitido, pular entrada
                            i += 1
                            continue
                    except (ValueError, TypeError):
                        # Se houver erro no parsing, não aplicar filtro
                        pass
                
                posicao_aberta = True
                i += 1
                continue
        
        # Se há posição aberta, verificar condições de saída
        if posicao_aberta:
            saida_idx = None
            saida_data = None
            saida_preco = None
            motivo_saida = None
            
            # Preços de stop loss e take profit
            stop_price = entrada_preco * (1 + stop_loss)
            take_price = entrada_preco * (1 + take_profit)
            
            # Verificar saída intrabar no mesmo candle (se disponível)
            if has_low and has_high:
                low_i = df.at[i, 'low']
                high_i = df.at[i, 'high']
                
                # Verificar stop loss intrabar
                if low_i <= stop_price:
                    saida_idx = i
                    saida_data = df.at[i, 'date']
                    saida_preco = float(stop_price)
                    motivo_saida = 'stop_loss'
                # Verificar take profit intrabar
                elif high_i >= take_price:
                    saida_idx = i
                    saida_data = df.at[i, 'date']
                    saida_preco = float(take_price)
                    motivo_saida = 'take_profit'
            
            # Se não saiu intrabar, verificar saída por média ou fechamento
            if saida_idx is None:
                close_i = df.at[i, 'close']
                media_i = df.at[i, 'media']
                
                # Verificar se preço caiu abaixo da média
                if not pd.isna(media_i) and close_i < media_i:
                    saida_idx = i
                    saida_data = df.at[i, 'date']
                    saida_preco = float(close_i)
                    motivo_saida = 'abaixo_media'
                # Verificar stop loss por fechamento
                elif close_i <= stop_price:
                    saida_idx = i
                    saida_data = df.at[i, 'date']
                    saida_preco = float(stop_price)
                    motivo_saida = 'stop_loss'
                # Verificar take profit por fechamento
                elif close_i >= take_price:
                    saida_idx = i
                    saida_data = df.at[i, 'date']
                    saida_preco = float(take_price)
                    motivo_saida = 'take_profit'
            
            # Se encontrou saída, registrar trade
            if saida_idx is not None:
                retorno = (saida_preco - entrada_preco) / entrada_preco
                trades.append({
                    'entrada_data': entrada_data.strftime('%Y-%m-%d %H:%M'),
                    'entrada_preco': float(entrada_preco),
                    'saida_data': saida_data.strftime('%Y-%m-%d %H:%M'),
                    'saida_preco': float(saida_preco),
                    'retorno': float(retorno)
                })
                df.at[saida_idx, 'retorno_estrategia'] = retorno
                
                # Ativar cooldown após qualquer saída
                if cooldown > 0:
                    cooldown_until_idx = saida_idx + cooldown + 1
                
                # Resetar posição
                posicao_aberta = False
                entrada_idx = None
                entrada_data = None
                entrada_preco = None
                i = saida_idx + 1
            else:
                # Continuar mantendo a posição
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
                # Fallback para média aritmética ponderada
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

