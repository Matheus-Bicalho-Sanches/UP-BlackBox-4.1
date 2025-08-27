import os
import sys
from pathlib import Path

# Ensure project root is on sys.path so that 'services.*' absolute imports work
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_PROJECT_ROOT_STR = str(_PROJECT_ROOT)
if _PROJECT_ROOT_STR not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT_STR)

import logging
import time
import requests
from services.market_feed_next.dll import ProfitDLL

# Configuração de logging - DEBUG para ver todos os detalhes
logging.basicConfig(level=logging.DEBUG, format="%(asctime)s %(levelname)s:%(name)s:%(message)s")
logger = logging.getLogger("dll_launcher")

# Váriavel global para manter a DLL viva
dll_instance = None
hf_ingest_url_tick = os.getenv("HF_INGEST_URL", "http://127.0.0.1:8002/ingest/batch").replace("/batch", "/tick")
http_session = requests.Session()

def on_trade(symbol: str, price: float, qty: int, ts: float, extra_data: dict = None):
    """
    Callback de trade. Envia o tick para o backend de alta frequência com retentativas.
    """
    payload = {
        "symbol": symbol,
        "exchange": "B",
        "price": price,
        "volume": qty,
        "timestamp": ts
    }
    
    # Adiciona dados extras se disponíveis
    if extra_data:
        payload.update({
            "trade_id": extra_data.get('trade_id'),
            "buy_agent": extra_data.get('buy_agent'),
            "sell_agent": extra_data.get('sell_agent'),
            "trade_type": extra_data.get('trade_type'),
            "volume_financial": extra_data.get('volume_financial'),
            "is_edit": extra_data.get('is_edit', False)
        })
    
    # Tenta enviar o tick algumas vezes antes de desistir
    for attempt in range(5):  # Aumentado para 5 tentativas
        try:
            response = http_session.post(hf_ingest_url_tick, json=payload, timeout=5.0)  # Timeout aumentado
            if response.status_code == 200:
                return # Sucesso, sai da função
            else:
                logger.warning(f"Falha ao enviar tick para HF Backend (tentativa {attempt+1}): {response.status_code} - {response.text}")
        except requests.RequestException as e:
            logger.error(f"Erro de conexão ao enviar tick para HF Backend (tentativa {attempt+1}): {e}")
        
        # Espera um pouco antes de tentar novamente
        time.sleep(1.0)  # Aumentado para 1 segundo
    
    logger.error(f"Desistindo de enviar o tick para {symbol} após 5 tentativas.")


def wait_for_hf_backend():
    """Aguarda o HF Backend estar pronto para receber conexões."""
    logger.info("Aguardando HF Backend estar pronto...")
    
    for attempt in range(30):  # 30 tentativas = 30 segundos
        try:
            response = http_session.get(hf_ingest_url_tick.replace("/ingest/tick", "/test"), timeout=2.0)
            if response.status_code == 200:
                logger.info("HF Backend está pronto para receber ticks!")
                return True
        except Exception:
            pass
        
        time.sleep(1)
        logger.info(f"Aguardando HF Backend... tentativa {attempt + 1}/30")
    
    logger.warning("HF Backend não respondeu em 30 segundos, prosseguindo mesmo assim...")
    return False

def main():
    global dll_instance
    logger.info(f"DLL Launcher iniciado. Enviando ticks para: {hf_ingest_url_tick}")

    # Aguarda o HF Backend estar pronto
    wait_for_hf_backend()

    try:
        os.environ["PROFIT_INIT_MODE"] = "login"
        
        dll_instance = ProfitDLL()
        logger.info("Configurando callback de trade...")
        dll_instance.set_trade_callback(on_trade)
        logger.info("Callback de trade configurado com sucesso!")
        
        # A inscrição virá da API, mas pré-inscrevemos para teste
        dll_instance.subscribe("PORD11")
        dll_instance.subscribe("CACR11")
        dll_instance.subscribe("HGLG11")
        # dll_instance.subscribe("KDIF11")
        # dll_instance.subscribe("HGRE11")
        # dll_instance.subscribe("AFHI11")
        # dll_instance.subscribe("MGLU3")
        # dll_instance.subscribe("BPAC11")
        # dll_instance.subscribe("SIMH3")
        # dll_instance.subscribe("B3SA3")
        # dll_instance.subscribe("ABEV3")
        # dll_instance.subscribe("BBDC4")
        # dll_instance.subscribe("BBAS3")
        # dll_instance.subscribe("BBSE3")
        # dll_instance.subscribe("ITUB4")
        # dll_instance.subscribe("RADL3")
        # dll_instance.subscribe("YDUQ3")
        # dll_instance.subscribe("PETR4")
        # dll_instance.subscribe("VALE3")
        # dll_instance.subscribe("PSSA3")
        # dll_instance.subscribe("RAIZ4")
        # dll_instance.subscribe("RURA11")
        # dll_instance.subscribe("FGAA11")
        # dll_instance.subscribe("VGIR11")
        # dll_instance.subscribe("VGIA11")
        # dll_instance.subscribe("LVBI11")
        # dll_instance.subscribe("BODB11")
        # dll_instance.subscribe("CDII11")
        # dll_instance.subscribe("CSUD3")
        # dll_instance.subscribe("RENT3")
        # dll_instance.subscribe("MRFG3")
        dll_instance.subscribe("BRBI11")
        dll_instance.subscribe("WEGE3")
        dll_instance.subscribe("RDOR3")
        dll_instance.subscribe("BRFS3")
        dll_instance.subscribe("SLCE3")
        dll_instance.subscribe("PGMN3")
        dll_instance.subscribe("CAML3")
        dll_instance.subscribe("PETZ3")
        dll_instance.subscribe("PFRM3")
        dll_instance.subscribe("SAPR4")
        # dll_instance.subscribe("SOJA3")
        # dll_instance.subscribe("TIMS3")
        # dll_instance.subscribe("VIVT3")
        # dll_instance.subscribe("XPML11")
        dll_instance.subscribe("URPR11")

        dll_instance.initialize()
        
        logger.info("DLL inicializada pelo launcher. O processo ficará ativo para manter a conexão.")
        
        # Loop infinito para manter o processo vivo
        while True:
            time.sleep(3600)

    except Exception as e:
        logger.error(f"Erro fatal no DLL Launcher: {e}", exc_info=True)
        exit(1)

if __name__ == "__main__":
    main()
