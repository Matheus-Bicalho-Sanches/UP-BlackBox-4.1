import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from services.market_feed_next.dll import ProfitDLL

logging.basicConfig(level="INFO")
logger = logging.getLogger("market_feed_next_api")

app = FastAPI(title="Market Feed Next API", version="1.0.0")

# A DLL agora é gerenciada pelo launcher.py. 
# Esta instância aqui serve apenas para interagir com a DLL já carregada.
# Nota: Assumimos que o launcher.py já inicializou a DLL no mesmo processo
# ou que estamos lidando com um singleton gerenciado pelo ctypes no Windows.
try:
    dll = ProfitDLL()
    # A inicialização e callbacks são tratados pelo launcher.
    # Apenas garantimos que a instância seja criada para chamarmos subscribe/unsubscribe.
except Exception as e:
    logger.error(f"Erro ao instanciar a classe da DLL na API: {e}. A API não poderá se comunicar com a DLL.")
    dll = None

class SubscribeReq(BaseModel):
	symbol: str
	exchange: str = "B"

class UnsubscribeReq(BaseModel):
	symbol: str

@app.on_event("startup")
def startup_event():
    logger.info("API do Market Feed Next iniciada. Esta API apenas envia comandos para o processo da DLL.")
    if not dll:
        logger.warning("A instância da DLL não está disponível. Os endpoints de subscribe/unsubscribe não funcionarão.")

@app.post("/subscribe")
def subscribe(req: SubscribeReq):
	if not dll:
		raise HTTPException(status_code=503, detail="Serviço da DLL indisponível.")
	try:
		logger.info(f"API recebendo pedido de subscribe: {req.symbol}")
		# Chama o método subscribe na instância compartilhada/já carregada
		dll.subscribe(req.symbol, req.exchange)
		return {"ok": True, "message": f"Comando de subscribe para {req.symbol} enviado."}
	except Exception as e:
		logger.error(f"Erro no endpoint /subscribe: {e}")
		raise HTTPException(status_code=500, detail=str(e))

@app.post("/unsubscribe")
def unsubscribe(req: UnsubscribeReq):
	if not dll:
		raise HTTPException(status_code=503, detail="Serviço da DLL indisponível.")
	try:
		logger.info(f"API recebendo pedido de unsubscribe: {req.symbol}")
		dll.unsubscribe(req.symbol)
		return {"ok": True, "message": f"Comando de unsubscribe para {req.symbol} enviado."}
	except Exception as e:
		logger.error(f"Erro no endpoint /unsubscribe: {e}")
		raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "ok", "dll_available": dll is not None}
