import pandas as pd
from datetime import datetime
import math

def run_voltaamediabollinger(csv_path, x=20, y=2, w=10, stop_loss=-0.05, take_profit=0.10, sair_em_z=False, z_saida=0.0, sair_na_media=False, z_somente_fechamento=True):
    """
    Estratégia:
    - Compra quando o fechamento cruza abaixo da banda inferior de Bollinger (só se não houver posição aberta).
    - Mantém a posição até take profit, stop loss, W períodos ou volta à média de Bollinger (se habilitado).
    Parâmetros:
      x: períodos da média móvel (ex: 20)
      y: desvio padrão (ex: 2)
      w: tempo máximo da operação (em períodos)
      stop_loss: stop loss percentual (ex: -0.05)
      take_profit: take profit percentual (ex: 0.10)
      sair_na_media: se True, sai quando o preço volta à média de Bollinger
      z_somente_fechamento: se True (padrão), a saída por Z (ou média) é verificada só no fechamento dos candles seguintes à entrada.
                            Se False, permite saída intrabar por Z em todos os candles (além do primeiro).
    """
    df = pd.read_csv(csv_path, sep=',', on_bad_lines='skip')
    df['date'] = pd.to_datetime(df['date'], format='%d/%m/%Y %H:%M')
    df = df.sort_values('date').reset_index(drop=True)
    # Calcular bandas de Bollinger
    df['media'] = df['close'].rolling(window=x).mean()
    df['std'] = df['close'].rolling(window=x).std()
    df['banda_inferior'] = df['media'] - y * df['std']
    trades = []
    df['retorno_estrategia'] = 0.0
    i = 0
    has_open = 'open' in df.columns
    has_low = 'low' in df.columns
    has_high = 'high' in df.columns
    while i < len(df):
        # Cálculo do gatilho de entrada no candle i
        preco_gatilho_entrada = df.at[i, 'banda_inferior']
        media_i = df.at[i, 'media']
        std_i = df.at[i, 'std']
        open_i = df.at[i, 'open'] if has_open else df.at[i, 'close']
        low_i = df.at[i, 'low'] if has_low else df.at[i, 'close']
        high_i = df.at[i, 'high'] if has_high else df.at[i, 'close']

        entrada_idx = None
        entrada_data = None
        entrada_preco = None
        entrada_tipo = None

        if not pd.isna(preco_gatilho_entrada):
            if has_open and open_i <= preco_gatilho_entrada:
                entrada_idx = i
                entrada_data = df.at[i, 'date']
                entrada_preco = float(open_i)
                entrada_tipo = 'open'
            elif has_low and open_i > preco_gatilho_entrada and low_i <= preco_gatilho_entrada:
                entrada_idx = i
                entrada_data = df.at[i, 'date']
                entrada_preco = float(preco_gatilho_entrada)
                entrada_tipo = 'low'
            else:
                # Fallback: cruzamento por fechamento como antes
                if i > 0 and df.at[i, 'close'] < preco_gatilho_entrada and df.at[i-1, 'close'] >= df.at[i-1, 'banda_inferior']:
                    entrada_idx = i
                    entrada_data = df.at[i, 'date']
                    entrada_preco = float(df.at[i, 'close'])
                    entrada_tipo = 'close'

        if entrada_idx is None:
            i += 1
            continue

        saida_idx = None
        saida_data = None
        saida_preco = None

        # Saídas intrabar no mesmo candle i
        stop_price_i = entrada_preco * (1 + stop_loss)
        take_price_i = entrada_preco * (1 + take_profit)
        efetiva_sair_em_z = bool(sair_em_z or sair_na_media)
        efetivo_z_saida = float(z_saida if sair_em_z else 0.0)
        z_exit_price_i = None
        if efetiva_sair_em_z and not pd.isna(media_i) and not pd.isna(std_i):
            z_exit_price_i = float(media_i - efetivo_z_saida * std_i)

        stop_trigger_i = has_low and (low_i <= stop_price_i)
        take_trigger_i = has_high and (high_i >= take_price_i)
        z_trigger_i = has_high and (z_exit_price_i is not None and high_i >= z_exit_price_i)

        # Regra conservadora: se a entrada ocorreu via toque na mínima,
        # não permitir ganho intrabar (take/Z) no mesmo candle. Stop continua permitido.
        if entrada_tipo == 'low':
            take_trigger_i = False
            z_trigger_i = False

        def is_ambiguous(exit_price: float) -> bool:
            if exit_price is None:
                return False
            low_bound = min(entrada_preco, exit_price)
            high_bound = max(entrada_preco, exit_price)
            close_i = df.at[i, 'close']
            return (low_i <= low_bound) and (high_i >= high_bound) and (low_bound < open_i < high_bound) and (low_bound < close_i < high_bound)

        ambiguous = any([
            is_ambiguous(stop_price_i) if stop_trigger_i else False,
            is_ambiguous(take_price_i) if take_trigger_i else False,
            is_ambiguous(z_exit_price_i) if z_trigger_i else False
        ])
        if ambiguous:
            i += 1
            continue

        if stop_trigger_i or take_trigger_i or z_trigger_i:
            saida_idx = i
            saida_data = df.at[i, 'date']
            if stop_trigger_i:
                saida_preco = float(stop_price_i)
            elif take_trigger_i:
                saida_preco = float(take_price_i)
            else:
                saida_preco = float(z_exit_price_i)
        else:
            # Varredura j=1..w nos candles seguintes
            for j in range(1, w+1):
                if entrada_idx + j >= len(df):
                    break
                min_preco = df.at[entrada_idx + j, 'low'] if has_low else df.at[entrada_idx + j, 'close']
                max_preco = df.at[entrada_idx + j, 'high'] if has_high else df.at[entrada_idx + j, 'close']
                preco_fechamento = df.at[entrada_idx + j, 'close']
                media_bollinger = df.at[entrada_idx + j, 'media']
                stop_price = entrada_preco * (1 + stop_loss)
                take_price = entrada_preco * (1 + take_profit)
                if min_preco <= stop_price:
                    saida_idx = entrada_idx + j
                    saida_data = df.at[saida_idx, 'date']
                    saida_preco = float(stop_price)
                    break
                if max_preco >= take_price:
                    saida_idx = entrada_idx + j
                    saida_data = df.at[saida_idx, 'date']
                    saida_preco = float(take_price)
                    break
                efetiva_sair_em_z = bool(sair_em_z or sair_na_media)
                efetivo_z_saida = float(z_saida if sair_em_z else 0.0)
                if efetiva_sair_em_z and not pd.isna(media_bollinger) and not pd.isna(df.at[entrada_idx + j, 'std']):
                    limite_saida = media_bollinger - efetivo_z_saida * df.at[entrada_idx + j, 'std']
                    # Se permitido, saída intrabar por Z usando a máxima do candle
                    if not z_somente_fechamento and has_high and max_preco >= limite_saida:
                        saida_idx = entrada_idx + j
                        saida_data = df.at[saida_idx, 'date']
                        saida_preco = float(limite_saida)
                        break
                    # Caso contrário, considera somente fechamento
                    if preco_fechamento >= limite_saida:
                        saida_idx = entrada_idx + j
                        saida_data = df.at[saida_idx, 'date']
                        saida_preco = float(preco_fechamento)
                        break

        if saida_idx is None and entrada_idx + w < len(df):
            saida_idx = entrada_idx + w
            saida_data = df.at[saida_idx, 'date']
            saida_preco = float(df.at[saida_idx, 'close'])
        if saida_idx is not None:
            trades.append({
                'entrada_data': entrada_data.strftime('%Y-%m-%d %H:%M'),
                'entrada_preco': float(entrada_preco),
                'saida_data': saida_data.strftime('%Y-%m-%d %H:%M'),
                'saida_preco': float(saida_preco),
                'retorno': (saida_preco - entrada_preco) / entrada_preco
            })
            df.at[saida_idx, 'retorno_estrategia'] = (saida_preco - entrada_preco) / entrada_preco
            i = saida_idx + 1
        else:
            i += 1
    df['equity_estrategia'] = (1 + df['retorno_estrategia']).cumprod()
    equity_curve_estrategia = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], df['equity_estrategia'])
    ]
    df['retorno_ativo'] = df['close'].pct_change().fillna(0)
    df['equity_ativo'] = (1 + df['retorno_ativo']).cumprod()
    equity_curve_ativo = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], df['equity_ativo'])
    ]
    roll_max_estrategia = df['equity_estrategia'].cummax()
    drawdown_estrategia = (df['equity_estrategia'] - roll_max_estrategia) / roll_max_estrategia
    drawdown_curve_estrategia = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], drawdown_estrategia)
    ]
    roll_max_ativo = df['equity_ativo'].cummax()
    drawdown_ativo = (df['equity_ativo'] - roll_max_ativo) / roll_max_ativo
    drawdown_curve_ativo = [
        {'data': d.strftime('%Y-%m-%d %H:%M'), 'valor': float(v)}
        for d, v in zip(df['date'], drawdown_ativo)
    ]
    n_operacoes = len(trades)
    retorno_total_estrategia = float(df['equity_estrategia'].iloc[-1]) - 1 if not df.empty else 0
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
        'tempo_medio_perdedores': tempo_medio_perdedores,
        'parametros_detalhados': {
            'descricao': (
                'Compra quando o fechamento cruza abaixo da banda inferior de Bollinger. '
                'Mantém a posição até atingir o take profit, o stop loss, a linha média ajustada por Z desvios (se habilitado) ou o tempo máximo (W períodos), o que ocorrer primeiro.'
            ),
            'x': (
                'Quantidade de períodos para o cálculo da média móvel de Bollinger (X).\n'
                'Exemplo: X = 20 → usa média móvel de 20 períodos.'
            ),
            'y': (
                'Desvio padrão multiplicador para as bandas de Bollinger (Y).\n'
                'Exemplo: Y = 2 → banda inferior = média - 2 * desvio padrão.'
            ),
            'w': (
                'Tempo máximo da operação em períodos (W).\n'
                'Exemplo: W = 10 → encerra a operação após 10 períodos, se não sair antes por stop, gain ou regra de Z desvios.'
            ),
            'stop_loss': (
                'Stop loss percentual.\n'
                'Exemplo: -0.05 significa encerrar a operação se cair 5% após a compra.'
            ),
            'take_profit': (
                'Take profit percentual.\n'
                'Exemplo: 0.10 significa encerrar a operação se subir 10% após a compra.'
            ),
            'sair_em_z': (
                'Se habilitado, encerra a operação quando o preço voltar até a média menos Z desvios padrão.\n'
                'Exemplo: Z = 0 → média (igual à antiga opção "sair na média"). Z = 1 → média - 1*desvio.'
            ),
            'z_saida': (
                'Valor de Z (desvios) para a regra de saída. Deve ser ≥ 0 e idealmente ≤ Y.'
            ),
            'z_somente_fechamento': (
                'Se verdadeiro, a verificação de saída por Z (ou média) nos candles após a entrada ocorre apenas no fechamento.\n'
                'Se falso, a saída por Z também pode acontecer intrabar (se a máxima do candle tocar a linha alvo).'
            )
        }
    } 