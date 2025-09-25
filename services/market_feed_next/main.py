import logging
import os
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level="INFO")
logger = logging.getLogger("market_feed_next_api")

app = FastAPI(title="Market Feed Next API", version="1.0.0")

HF_BACKEND_URL = os.getenv("HF_BACKEND_URL", "http://127.0.0.1:8002")

class SubscribeReq(BaseModel):
    symbol: str
    exchange: str = "B"

class UnsubscribeReq(BaseModel):
    symbol: str

@app.on_event("startup")
def startup_event():
    logger.info("API do Market Feed Next iniciada. Ela encaminha solicitações ao backend de alta frequência.")

@app.post("/subscribe")
def subscribe(req: SubscribeReq):
    try:
        payload = {"symbol": req.symbol.upper(), "exchange": req.exchange.upper()}
        response = requests.post(f"{HF_BACKEND_URL}/subscribe", json=payload, timeout=5.0)
        if response.status_code != 200:
            logger.error("Falha ao repassar subscribe para HF: %s - %s", response.status_code, response.text)
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()
    except requests.RequestException as exc:
        logger.error("Erro HTTP ao repassar subscribe: %s", exc)
        raise HTTPException(status_code=503, detail="hf_unreachable")

@app.post("/unsubscribe")
def unsubscribe(req: UnsubscribeReq):
    try:
        payload = {"symbol": req.symbol.upper()}
        response = requests.post(f"{HF_BACKEND_URL}/unsubscribe", json=payload, timeout=5.0)
        if response.status_code != 200:
            logger.error("Falha ao repassar unsubscribe para HF: %s - %s", response.status_code, response.text)
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()
    except requests.RequestException as exc:
        logger.error("Erro HTTP ao repassar unsubscribe: %s", exc)
        raise HTTPException(status_code=503, detail="hf_unreachable")

@app.get("/health")
def health_check():
    return {"status": "ok", "hf_backend": HF_BACKEND_URL}
