import uvicorn
import os
import sys
from pathlib import Path
import platform
import asyncio

# Garante que o diretório raiz do projeto esteja no sys.path
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_PROJECT_ROOT_STR = str(_PROJECT_ROOT)
if _PROJECT_ROOT_STR not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT_STR)

# Ajuste de event loop no Windows (psycopg não funciona com Proactor)
if platform.system().lower().startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except Exception:
        pass

if __name__ == "__main__":
    uvicorn.run(
        "services.ml_lab.main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8010")),
        reload=False,
        log_level="info",
    )


