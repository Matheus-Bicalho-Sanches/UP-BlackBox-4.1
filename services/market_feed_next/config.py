import os
from pathlib import Path

# Diretórios
REPO_ROOT = Path(__file__).resolve().parents[2]
DLL_DIR_CANDIDATES = [
	REPO_ROOT / "Dll_Profit" / "bin" / "Win64" / "Example",
	REPO_ROOT / "Dll_Profit" / "DLLs" / "Win64",
	Path(__file__).resolve().parent,
]

# Variáveis de ambiente
HF_INGEST_URL = os.getenv("HF_INGEST_URL", "http://127.0.0.1:8002/ingest/batch")
HF_BATCH_MS = int(os.getenv("HF_BATCH_MS", "50"))
HF_BATCH_MAX = int(os.getenv("HF_BATCH_MAX", "1000"))

KEEPALIVE_INTERVAL_SEC = int(os.getenv("KEEPALIVE_INTERVAL_SEC", "20"))
GAP_THRESHOLD_SEC = float(os.getenv("GAP_THRESHOLD_SEC", "12"))
BACKFILL_MINUTES = int(os.getenv("BACKFILL_MINUTES", "3"))

FEED_HOST = os.getenv("FEED_HOST", "0.0.0.0")
FEED_PORT = int(os.getenv("FEED_PORT", "8001"))

# DEBUG por padrão
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG").upper()

# Credenciais Profit via .env já são carregadas no processo externo (start-dev.bat)
