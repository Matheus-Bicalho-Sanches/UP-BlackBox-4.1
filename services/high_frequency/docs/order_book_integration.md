# ProfitDLL Order Book Integration – Research Notes

## Objetivo da etapa 1
Reunir todas as informações relevantes sobre as estruturas e callbacks disponíveis na ProfitDLL relacionadas ao livro de ofertas (book), para embasar as próximas etapas da implementação (assinatura, parse e persistência).

## Funções expostas relacionadas ao book

Fonte: `Dll_Profit/manual_profit.txt`, seção **3.1 Exposed Functions**.

- `DLLInitializeLogin` / `DLLInitializeMarketLogin`
  - Ambos aceitam parâmetros:
    - `PriceBookCallback : TPriceBookCallback`
    - `OfferBookCallback : TOfferBookCallback`
    - `TinyBookCallback : TTinyBookCallback`
  - (Além de `NewTradeCallback`, `NewDailyCallback`, etc.)
- `SubscribePriceBook(pwcTicker, pwcBolsa) : Integer`
- `UnsubscribePriceBook(pwcTicker, pwcBolsa) : Integer`
- `SubscribeOfferBook(pwcTicker, pwcBolsa) : Integer`
- `UnsubscribeOfferBook(pwcTicker, pwcBolsa) : Integer`
- `SetPriceBookCallback(const a_PriceBookCallback : TPriceBookCallback)`
- `SetPriceBookCallbackV2(const a_PriceBookCallbackV2 : TPriceBookCallbackV2)`
- (`SetOfferBookCallback`, `SetTinyBookCallback` – descritos em seções posteriores)

Essas funções indicam que a DLL publica mudanças de book via callbacks registrados na inicialização do market data ou através dos setters dedicados.

## Tipos de callback de book

Fonte: mesma documentação, seções “Callback Types” / “Callback Description”.

### `TPriceBookCallback`
Assinatura (Delphi):
```pascal
TPriceBookCallback = procedure(
  rAssetID : TAssetIDRec;
  nAction  : Integer;
  nPosition: Integer;
  Side     : Integer; // 0=Buy, 1=Sell
  nQtds    : Integer; // quantidade do nível
  nCount   : Integer; // quantidade de níveis no array
  sPrice   : Double;  // preço do nível
  pArraySell: Pointer; // ponteiro para array de níveis de venda
  pArrayBuy : Pointer  // ponteiro para array de níveis de compra
); stdcall;
```
- `TAssetIDRec` contém ticker (`pwcTicker`), bolsa (`pwcBolsa`), feed (`nFeed`).
- `nAction`: 0 – snapshot; 1 – atualização de venda; 2 – atualização de compra (ver tabela na doc).
- `nPosition`: posição do nível (0 = melhor preço).
- `Side`: `0` bid, `1` ask.
- `pArraySell`, `pArrayBuy`: apontam para arrays de estruturas (`TPriceArrayItem`) contendo os níveis. É necessário converter manualmente (ver exemplos Delphi/C#).

### `TPriceBookCallbackV2`
Assinatura semelhante, porém com estrutura de array diferente (mais compacta). Segundo a doc:
> “Similar to TPriceBookCallback; layout do array: `packed record` com `Price`, `Quantity`, `AgentID`, `Aggressor`, etc.”
- Útil quando queremos dados adicionais (IDs, agressor). A doc inclui tabela com offsets.

### `TOfferBookCallback`
Callback focado em ofertas **próprias** (ordens do usuário). Estrutura contém identificadores de ordem, etc. Não é o book agregado da bolsa.

### `TTinyBookCallback`
Callback simplificado: apenas melhores ofertas (top 1). Estrutura `TTinyBookStruct` (BidPrice, BidQty, AskPrice, AskQty).

## Estruturas auxiliares

### Arrays de níveis (`PriceBook`)

Documentação descreve dois formatos:

- **Versão 1 (`TPriceArrayItem`)**
  ```pascal
  TPriceArrayItem = packed record
    Price : Double;
    Quantity : Integer;
    Position : Integer;
    OfferCount : Integer;
    AgentID : Integer;
  end;
  ```

- **Versão 2 (`TPriceArrayItemV2`)**
  ```pascal
  TPriceArrayItemV2 = packed record
    Price : Double;
    Quantity : Int64;
    OfferCount : Integer;
    Aggressor : Integer;
    AgentID : Integer;
    UpdateID : Int64;
  end;
  ```
  (Estrutura detalhada perto das linhas 1500–1580 do manual.)

Dependendo do callback (`SetPriceBookCallback` vs `SetPriceBookCallbackV2`), os ponteiros `pArraySell`/`pArrayBuy` apontam para uma dessas versões. A doc inclui funções “DecryptPriceArray/DecryptPriceArrayV2” nos exemplos Delphi para converter.

### Tiny book (`TTinyBookStruct`)
```
TTinyBookStruct = packed record
  BidPrice: Double;
  BidQuantity: Integer;
  AskPrice: Double;
  AskQuantity: Integer;
end;
```
Callback recebe ponteiro para essa struct quando configurado.

## Como ativar o recebimento de book

1. Registrar o callback (na inicialização):
   ```pascal
   SetPriceBookCallback(PriceBookCallback);
   // ou
   SetPriceBookCallbackV2(PriceBookCallbackV2);
   ```
2. Assinar o book do ativo:
   ```pascal
   SubscribePriceBook('ABEV3', 'B');
   ```
   - `pwcBolsa` é o código da bolsa (B3 = 'B', cf. tabela de exchanges).
3. Para ofertas próprias, usar `SubscribeOfferBook`.
4. Para melhores preços, `SetTinyBookCallback` + `SubscribePriceBook` (mesmo feed).

Importante: `SubscribePriceBook` deve ser chamado após `DLLInitializeMarketLogin`. A doc também menciona que o callback dispara imediatamente com o snapshot inicial.

## Referências a exemplos

- `Dll_Profit/Exemplo C#/Program.cs`: método `PriceBookCallback(...)` já implementa parse dos ponteiros.
- `Dll_Profit/Exemplo Delphi/Wrapper/callbackWrapperU.pas`: funções `PriceBookCallback`/`PriceBookCallbackV2` com `DecryptPriceArray`/`DecryptPriceArrayV2`.
- `Dll_Profit/Exemplo Python/profitTypes.py`: classes `TPriceBookCallback`, `TPriceArrayItem`, etc., úteis para `ctypes`.

## Etapa 2 – Modelagem proposta (snapshots + eventos)

### Objetivos
- Reconstituir rapidamente o estado do book atual e histórico recente.
- Permitir auditoria detalhada (cada atualização recebida da DLL).
- Garantir armazenamento de longo prazo para treinamento, usando particionamento/compressão para manter performance.

### Tabelas sugeridas

**`order_book_snapshots`**
- `id bigint identity`
- `event_time timestamptz`
- `symbol varchar(20)`
- `sequence bigint` (quando disponível)
- `bids jsonb` (lista ordenada de níveis com `price`, `quantity`, `offer_count`, `agent_id`)
- `asks jsonb` (mesmo formato)
- `best_bid_price`, `best_bid_qty`, `best_ask_price`, `best_ask_qty`
- `levels integer` (quantidade de níveis armazenados em cada lado)
- `raw_event jsonb` (opcional para depuração)
- Índice sugerido: `(symbol, event_time DESC)`

**`order_book_events`**
- `id bigint identity`
- `event_time timestamptz`
- `symbol varchar(20)`
- `action smallint` (0 snapshot DLL, 1 update ask, 2 update bid, etc.)
- `side smallint` (0 buy, 1 sell)
- `position integer`
- `price numeric`
- `quantity numeric`
- `offer_count integer`
- `agent_id integer`
- `sequence bigint`
- `raw_payload jsonb`
- Índice sugerido: `(symbol, event_time DESC)`

- **Snapshots**: capturar a cada 5 segundos **ou** sempre que o melhor bid/ask mudar. Mantém estado disponível para dashboards e reduz necessidade de replay.
- **Eventos**: registrar todos os callbacks (`PriceBookCallbackV2`) sem descarte automático. Os dados servirão de base para treinamento; precisamos de compressão/particionamento (Timescale hypertables) e monitoramento de espaço.
- **Top N níveis**: armazenar até 10 níveis por lado (configurável). JSONB mantém todos os níveis de um snapshot em linha única, evitando multiplicação de tuples.

### Estruturas Python
```python
@dataclass
class OrderBookLevel:
    price: float
    quantity: int
    offer_count: int
    agent_id: Optional[int] = None


@dataclass
class OrderBookSnapshot:
    symbol: str
    timestamp: datetime
    bids: list[OrderBookLevel]
    asks: list[OrderBookLevel]
    sequence: Optional[int]
    source_event: dict | None = None
```

### Próximos passos
- Implementar wrappers `SetPriceBookCallbackV2` / `SubscribePriceBook` na camada que já inicializa a DLL.
- Montar fila/queue para isolar o callback (alta frequência) da persistência.
- Definir migrations SQL para criar as tabelas propostas, convertendo-as em hypertables se usarmos TimescaleDB.
- Configurar compressão e monitoramento de espaço (sem purga automática), garantindo retenção indefinida.

> **Observação**: Usar `PriceBookCallbackV2` garante acesso a `offer_count`, `agent_id`, e `update_id`. Caso o feed não entregue algum campo, preencher com `NULL`.

