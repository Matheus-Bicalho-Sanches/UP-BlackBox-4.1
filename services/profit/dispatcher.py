from fastapi import FastAPI
import sys, asyncio
if sys.platform == "win32":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass
from pydantic import BaseModel
from services.profit.profit_feed import (
    SubscribeTicker,
    start_background_feed,
    db,
    current_candles,
    initialize_market_session,
    request_history_ticks_sync
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

class HistoryReq(BaseModel):
    ticker: str
    start: str  # dd/MM/yyyy
    end: str    # dd/MM/yyyy

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

@app.post("/history/ticks")
async def get_history_ticks(req: HistoryReq):
    loop = asyncio.get_running_loop()
    # Executa chamada síncrona (que pode demorar) no executor padrão
    try:
        ticks = await loop.run_in_executor(
            None, 
            request_history_ticks_sync,
            req.ticker, 
            req.start, 
            req.end
        )
        return {"count": len(ticks), "ticks": ticks}
    except Exception as e:
        logging.error("Error in /history/ticks: %s", e)
        return JSONResponse({"error": str(e)}, status_code=500)

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
    # Inicializa sessão de market antes de iniciar as tasks de background
    initialize_market_session()
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
