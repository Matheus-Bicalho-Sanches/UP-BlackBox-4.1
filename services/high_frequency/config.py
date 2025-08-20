"""
Configurações do High Frequency Backend
"""
import os

# Configurações do sistema
HF_DISABLE_SIM = os.getenv("HF_DISABLE_SIM", "0").lower() in ("1", "true", "yes")
PROFIT_FEED_URL = os.getenv("PROFIT_FEED_URL", "http://localhost:8001")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/market_data")
FIREBASE_SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "firebase-credentials.json")

# Configurações de buffer
HF_BATCH_MS = int(os.getenv("HF_BATCH_MS", "100"))
HF_BATCH_MAX = int(os.getenv("HF_BATCH_MAX", "1000"))

# Configurações de ingestão
HF_INGEST_URL = os.getenv("HF_INGEST_URL", "http://127.0.0.1:8002/ingest/batch")
