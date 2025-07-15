# 🔄 Atualização do Nome da Estratégia

## ⚠️ AÇÃO NECESSÁRIA: Atualizar Nome no Frontend

O ticker da estratégia foi corrigido de **WINFUT** para **WINQ25** (ticker correto do Mini Índice Futuro).

### 📝 O que mudou:

- ❌ **Antigo**: `Voltaamedia_Bollinger_1min_WINFUT`
- ✅ **Novo**: `Voltaamedia_Bollinger_1min_WINQ25`

### 🛠️ Como atualizar:

#### Opção 1: Criar Nova Estratégia (RECOMENDADO)
1. Acesse: `http://localhost:3000/dashboard/market-data/teste-2`
2. Clique: **"Nova Estratégia"**
3. Preencha:
   ```
   Nome: Voltaamedia_Bollinger_1min_WINQ25
   Carteira BlackBox: [Selecione uma existente]
   Tamanho Posição: 10.0%
   Status: ✅ Ativo
   ```
4. **Desative** a estratégia antiga se existir

#### Opção 2: Editar Estratégia Existente
1. Acesse: `http://localhost:3000/dashboard/market-data/teste-2`
2. Localize a estratégia antiga: `Voltaamedia_Bollinger_1min_WINFUT`
3. Clique em **"Editar"**
4. Altere o nome para: `Voltaamedia_Bollinger_1min_WINQ25`
5. Salve as alterações

### ✅ Verificação

Execute o teste para confirmar que os dados estão disponíveis:

```bash
cd services/quant
python test_winq25_data.py
```

Se tudo estiver OK, você verá:
```
🎉 DADOS WINQ25 DISPONÍVEIS!
✅ O Quant Engine pode processar esta estratégia
```

### 🔍 Compatibilidade

**Boa notícia**: O código mantém compatibilidade com ambos os nomes:
- ✅ `Voltaamedia_Bollinger_1min_WINQ25` (preferido)
- ✅ `Voltaamedia_Bollinger_1min_WINFUT` (compatibilidade)

Ambos irão processar dados do **WINQ25** automaticamente.

### 🚀 Próximos Passos

1. ✅ **Atualizar estratégia no frontend**
2. ✅ **Testar dados**: `python test_winq25_data.py`
3. ✅ **Verificar serviços**: `python check_services.py` 
4. ✅ **Iniciar Quant Engine**: `start_quant_engine.bat`

---

**📍 Status**: Ticker **WINQ25** é o correto para Mini Índice Futuro conforme dados no Firebase! 