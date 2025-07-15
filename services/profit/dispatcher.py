from fastapi import FastAPI
from pydantic import BaseModel
from services.profit.profit_feed import (
    SubscribeTicker,
    start_background_feed,
    db,
    current_candles,
)  # type: ignore
import asyncio
import logging
from fastapi.responses import JSONResponse

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI()

class SubReq(BaseModel):
    ticker: str
    exch: str = "B"

class UnsubReq(BaseModel):
    ticker: str

# TODO: manter lista de subs ativos, chamar UnsubscribeTicker se disponível

@app.post("/subscribe")
def subscribe(req: SubReq):
    result = SubscribeTicker(req.ticker, req.exch)
    logging.info("SubscribeTicker %s -> code %s", req.ticker, result)
    return {"result": result}

@app.post("/unsubscribe")
def unsubscribe(req: UnsubReq):
    # Placeholder – implementar chamada ao UnsubscribeTicker
    return {"result": "ok"}

# Endpoint para candle corrente em memória
@app.get("/current/{ticker}")
def get_current_candle(ticker: str):
    ticker = ticker.upper()
    candle = current_candles.get(ticker)
    if not candle:
        return JSONResponse({"error": "not_found"}, status_code=404)
    return candle

# Startup event to launch aggregator
@app.on_event("startup")
async def _startup():
    loop = asyncio.get_event_loop()
    start_background_feed(loop)

    # Reinscrever tickers persistidos
    try:
        for doc in db.collection("activeSubscriptions").stream():
            t = doc.id
            exch = doc.to_dict().get("exchange", "B")
            logging.info("Auto-reSubscribe %s (%s)", t, exch)
            try:
                SubscribeTicker(t, exch)
            except Exception as e:
                logging.error("Erro ao reinscrever %s: %s", t, e)
    except Exception as e:
        logging.error("Falha ao carregar activeSubscriptions: %s", e) 