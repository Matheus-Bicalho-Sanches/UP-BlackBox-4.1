# 🚀 Guia Completo para Criar Novas Estratégias de Backtest

Este guia mostra **exatamente** o que você precisa fazer para criar uma nova estratégia de backtest no sistema UP BlackBox 2.0.

---

## 📋 **Resumo do que Fizemos**

✅ **Criamos**: `UP BlackBox 2.0/estrategias/minha_estrategia.py`  
✅ **Integramos**: No backend FastAPI (`main.py`)  
✅ **Adicionamos**: No frontend React (`backtest/page.tsx`)  
✅ **Criamos**: Script para adicionar ao Firebase (`criar_estrategia.py`)  

---

## 🔧 **Passo a Passo Detalhado**

### **Passo 1: Criar o Arquivo da Estratégia Python**

**Localização**: `UP BlackBox 2.0/estrategias/minha_estrategia.py`

**O que fazer**:
1. Copie o arquivo `minha_estrategia.py` que criamos
2. Modifique a lógica da estratégia conforme sua necessidade
3. Mantenha a estrutura de retorno igual

**Estrutura obrigatória**:
```python
def run_minha_estrategia(csv_path, param1=3, param2=5, stop_loss=-0.05, take_profit=0.08):
    # Sua lógica aqui
    
    return {
        'equity_curve_estrategia': equity_curve_estrategia,
        'equity_curve_ativo': equity_curve_ativo,
        'drawdown_estrategia': drawdown_curve_estrategia,
        'drawdown_ativo': drawdown_curve_ativo,
        'n_operacoes': n_operacoes,
        'retorno_total_estrategia': retorno_total_estrategia,
        'retorno_total_ativo': retorno_total_ativo,
        'retorno_por_trade': retorno_por_trade,
        'retorno_por_trade_percent': retorno_por_trade_percent,
        'trades': trades,
        'tempo_posicionado': tempo_posicionado,
        'total_linhas': total_linhas,
        'pct_vencedores': pct_vencedores,
        'ganho_medio_vencedores': ganho_medio_vencedores,
        'tempo_medio_vencedores': tempo_medio_vencedores,
        'perda_medio_perdedores': perda_medio_perdedores,
        'tempo_medio_perdedores': tempo_medio_perdedores
    }
```

### **Passo 2: Integrar no Backend (FastAPI)**

**Localização**: `UP BlackBox 2.0/main.py`

**O que fazer**:
1. **Importar** a estratégia (linha ~25):
   ```python
   from estrategias.minha_estrategia import run_minha_estrategia
   ```

2. **Adicionar** no endpoint de backtest (linha ~365):
   ```python
   elif estrategia_nome.lower() == 'minha_estrategia':
       param1 = parametros.get('param1', 3)
       param2 = parametros.get('param2', 5)
       stop_loss = parametros.get('stop_loss', -0.05)
       take_profit = parametros.get('take_profit', 0.08)
       resultado = run_minha_estrategia(tmp_path, param1, param2, stop_loss, take_profit)
   ```

### **Passo 3: Adicionar no Frontend (React)**

**Localização**: `src/app/dashboard/backtests/backtest/page.tsx`

**O que fazer**:
1. **Adicionar** a lógica de parâmetros (linha ~200):
   ```typescript
   } else if (selectedEstrategia.toLowerCase() === "minha_estrategia") {
     body.parametros = {
       param1: numX,
       param2: numY,
       stop_loss: numStopLoss / 100,
       take_profit: numTakeProfit / 100,
     };
   }
   ```

### **Passo 4: Criar no Firebase**

**Localização**: `UP BlackBox 2.0/criar_estrategia.py`

**O que fazer**:
1. Execute o script:
   ```bash
   cd "UP BlackBox 2.0"
   python criar_estrategia.py
   ```

2. **OU** crie manualmente no Firebase:
   - Vá para `http://localhost:3000/dashboard/backtests/estrategias`
   - Clique em "Tutorial" (quando implementado)
   - Ou crie diretamente no Firestore

---

## 🎯 **Como Personalizar a Estratégia**

### **Exemplo 1: Estratégia de RSI**

```python
def run_estrategia_rsi(csv_path, periodo_rsi=14, sobrecompra=70, sobrevenda=30, stop_loss=-0.05, take_profit=0.08):
    # Calcular RSI
    df['rsi'] = calcular_rsi(df['close'], periodo_rsi)
    
    # Sinais de compra e venda
    df['sinal_compra'] = (df['rsi'] < sobrevenda) & (df['rsi'].shift(1) >= sobrevenda)
    df['sinal_venda'] = (df['rsi'] > sobrecompra) & (df['rsi'].shift(1) <= sobrecompra)
    
    # Resto da lógica...
```

### **Exemplo 2: Estratégia de Breakout**

```python
def run_estrategia_breakout(csv_path, periodo=20, multiplicador=2, stop_loss=-0.05, take_profit=0.08):
    # Calcular bandas de Bollinger
    df['media'] = df['close'].rolling(window=periodo).mean()
    df['desvio'] = df['close'].rolling(window=periodo).std()
    df['banda_superior'] = df['media'] + (df['desvio'] * multiplicador)
    df['banda_inferior'] = df['media'] - (df['desvio'] * multiplicador)
    
    # Sinais de breakout
    df['sinal_compra'] = df['close'] > df['banda_superior'].shift(1)
    df['sinal_venda'] = df['close'] < df['banda_inferior'].shift(1)
    
    # Resto da lógica...
```

---

## 🚨 **Pontos Importantes**

### **1. Estrutura de Dados CSV**
Seu CSV deve ter estas colunas:
- `date`: Data no formato `dd/mm/yyyy HH:MM`
- `close`: Preço de fechamento
- `high`: Preço máximo (opcional, mas recomendado)
- `low`: Preço mínimo (opcional, mas recomendado)

### **2. Parâmetros Padrão**
Sempre defina valores padrão para seus parâmetros:
```python
def run_minha_estrategia(csv_path, param1=3, param2=5, stop_loss=-0.05, take_profit=0.08):
```

### **3. Tratamento de Erros**
Use try/catch para evitar que a estratégia quebre:
```python
try:
    resultado = calculo_complexo()
except Exception as e:
    print(f"Erro no cálculo: {e}")
    resultado = valor_padrao
```

### **4. Validação de Dados**
Verifique se os dados existem antes de usar:
```python
if 'high' in df.columns and 'low' in df.columns:
    # Usar high/low
else:
    # Usar apenas close
```

---

## 🧪 **Como Testar**

### **1. Teste Local**
```bash
cd "UP BlackBox 2.0"
python -c "
from estrategias.minha_estrategia import run_minha_estrategia
resultado = run_minha_estrategia('caminho/para/seu/arquivo.csv')
print(f'Operações: {resultado[\"n_operacoes\"]}')
print(f'Retorno: {resultado[\"retorno_total_estrategia\"]:.2%}')
"
```

### **2. Teste no Sistema**
1. Reinicie o backend FastAPI
2. Execute o script `criar_estrategia.py`
3. Vá para `http://localhost:3000/dashboard/backtests/estrategias`
4. Verifique se sua estratégia aparece
5. Execute um backtest

---

## 🔍 **Solução de Problemas**

### **Erro: "Estratégia não implementada"**
- Verifique se importou a estratégia no `main.py`
- Verifique se adicionou o `elif` no endpoint de backtest
- Reinicie o backend

### **Erro: "Módulo não encontrado"**
- Verifique se o arquivo está em `UP BlackBox 2.0/estrategias/`
- Verifique se o nome da função está correto
- Verifique se não há erros de sintaxe

### **Estratégia não aparece na lista**
- Execute o script `criar_estrategia.py`
- Verifique se foi criada no Firebase
- Recarregue a página

---

## 📚 **Recursos Adicionais**

### **Estratégias Existentes para Referência**
- `buyifstockupxpercentage.py`: Compra quando sobe X%
- `buysequenciadealtaouqueda.py`: Compra em sequências de alta/queda
- `operandomomentum.py`: Opera com momentum
- `voltaamediabollinger.py`: Volta à média com Bollinger

### **Documentação Técnica**
- `docs/como_criar_nova_estrategia.md`: Guia original
- `docs/ajuste_formula_sincronizacao.md`: Ajustes de fórmulas
- `docs/correcao_bug4_sincronizacao_dados.md`: Correções de bugs

---

## 🎉 **Parabéns!**

Agora você sabe **exatamente** como criar novas estratégias de backtest no sistema UP BlackBox 2.0!

**Resumo do que você aprendeu**:
1. ✅ Como estruturar uma estratégia Python
2. ✅ Como integrar no backend FastAPI
3. ✅ Como adicionar no frontend React
4. ✅ Como criar no Firebase
5. ✅ Como testar e debugar

**Próximos passos**:
1. 🚀 Crie sua própria estratégia personalizada
2. 🧪 Teste com diferentes parâmetros
3. 📊 Analise os resultados
4. 🔄 Itere e melhore

**Dúvidas?** Sempre pode perguntar! Estou aqui para ajudar. 😊

