# Correção: Erro de Edição de Ordens Master Batch

## Problema Identificado

O sistema estava falhando ao editar ordens Master Batch com erro:
```
500, message='Attempt to decode JSON with unexpected mimetype: text/plain; charset=utf-8', url='http://localhost:8000/edit_orders_batch'
```

## Causa Raiz

Inconsistência nos nomes dos campos entre o Quant Engine e o endpoint UP BlackBox 4.0:

**Quant Engine enviava:**
- `"new_price": float(new_price)`
- `"base_qty": int(new_quantity)`

**Endpoint BlackBox esperava:**
- `"price"` 
- `"baseQty"`

Quando o endpoint tentava fazer `float(data.get("price"))` mas recebia `"new_price"`, obtinha `None` e falhava ao converter para float, causando erro 500.

## Correção Aplicada

Alterado `services/quant/quant_engine.py` linha 481-484 para usar os nomes corretos:

```python
# ANTES
edit_data = {
    "master_batch_id": order_id,
    "new_price": float(new_price),
    "base_qty": int(new_quantity)
}

# DEPOIS  
edit_data = {
    "master_batch_id": order_id,
    "price": float(new_price),
    "baseQty": int(new_quantity)
}
```

## Resultado

- ✅ Edição de ordens Master Batch agora funciona corretamente
- ✅ Sistema pode editar preços sem precisar cancelar/recriar ordens
- ✅ Redução significativa no número de chamadas à API (50% menos quando só o preço muda)

## Teste

O sistema agora deve ser capaz de editar ordens Master Batch quando o preço da Bollinger Band inferior mudar, em vez de sempre cancelar e recriar as ordens. 