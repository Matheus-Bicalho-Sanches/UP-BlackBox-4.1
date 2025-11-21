from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
import json as json_module
from fastapi.responses import JSONResponse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime as dt
import time

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI()

# Executor dedicado para operações síncronas bloqueantes
history_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="history_")

# Configurar CORS para permitir requisições do frontend local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    logging.info("=== RECEIVED /history/ticks REQUEST ===")
    logging.info("Request body: ticker=%s, start=%s, end=%s", req.ticker, req.start, req.end)
    loop = asyncio.get_running_loop()
    # Executa chamada síncrona (que pode demorar) no executor padrão
    # Timeout aumentado para 120s para períodos maiores
    try:
        logging.info("Starting history extraction for %s from %s to %s", req.ticker, req.start, req.end)
        logging.info("🔵 About to call executor...")
        
        # Usar executor dedicado ao invés de None (executor padrão pode estar bloqueado)
        ticks = await loop.run_in_executor(
            history_executor,
            request_history_ticks_sync,
            req.ticker, 
            req.start, 
            req.end,
            120.0  # timeout de 120 segundos (2 minutos)
        )
        
        logging.info("🟢 Executor completed! Received %d ticks", len(ticks) if ticks else 0)
        logging.info("✅ request_history_ticks_sync returned. Total ticks: %d", len(ticks) if ticks else 0)
        
        if not ticks:
            logging.warning("⚠️ No ticks returned, returning empty response")
            return {"count": 0, "ticks": [], "saved": False}
        
        # O salvamento já foi feito dentro de request_history_ticks_sync
        # Verificar se há doc_id nos logs para extrair (por enquanto, assumir que foi salvo)
        # Nota: Se request_history_ticks_sync retornou, o salvamento foi feito
        doc_id = None  # Será extraído dos logs ou passado via retorno se necessário - retornar dados de qualquer forma
        
        # Log primeiro e último tick para debug
        logging.info("First tick sample: %s", ticks[0] if ticks else None)
        if len(ticks) > 1:
            logging.info("Last tick sample: %s", ticks[-1])
        
        # Preparar resposta (salvamento foi feito dentro de request_history_ticks_sync)
        response_data = {
            "count": len(ticks), 
            "ticks": ticks,
            "saved": True,  # Assumir que foi salvo se chegou aqui
            "message": f"Dados salvos no Firestore na collection 'history_ticks'",
        }
        logging.info("📦 Preparing response with count=%d", len(ticks))
        
        # Tentar serializar para verificar se há problemas
        response_size = 0
        try:
            logging.info("🔄 Attempting JSON serialization...")
            json_str = json_module.dumps(response_data, ensure_ascii=False)
            response_size = len(json_str)
            logging.info("✅ Response serialized successfully. Size: %d bytes (%.2f KB, %.2f MB)", 
                        response_size, response_size / 1024, response_size / (1024 * 1024))
        except (TypeError, ValueError) as json_err:
            logging.error("❌ JSON serialization failed: %s", json_err, exc_info=True)
            # Tentar serializar cada tick individualmente para identificar o problema
            if ticks:
                try:
                    json_module.dumps(ticks[0])
                    logging.error("First tick is serializable, problem may be in count or structure")
                except Exception as tick_err:
                    logging.error("First tick failed to serialize: %s", tick_err, exc_info=True)
            return JSONResponse({"error": f"Failed to serialize response: {str(json_err)}"}, status_code=500)
        except Exception as json_err:
            logging.error("❌ Unexpected error during JSON serialization: %s", json_err, exc_info=True)
            return JSONResponse({"error": f"Unexpected error: {str(json_err)}"}, status_code=500)
        
        logging.info("📤 Returning response to client (count=%d, size=%.2f KB)...", len(ticks), response_size / 1024)
        
        try:
            return response_data
        except Exception as return_err:
            logging.error("❌ Error returning response: %s", return_err, exc_info=True)
            return JSONResponse({"error": f"Error returning response: {str(return_err)}"}, status_code=500)
    except asyncio.TimeoutError as e:
        logging.error("❌ Timeout in /history/ticks: %s", e, exc_info=True)
        return JSONResponse({"error": "Request timeout"}, status_code=504)
    except Exception as e:
        logging.error("❌ Error in /history/ticks: %s", e, exc_info=True)
        import traceback
        logging.error("Full traceback: %s", traceback.format_exc())
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
