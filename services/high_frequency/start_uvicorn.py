"""
Script para iniciar o uvicorn com a política correta do event loop no Windows
"""
import asyncio
import platform
import sys
import os
from pathlib import Path

# Fix para Windows: força uso do SelectorEventLoop ANTES de qualquer outra coisa
if platform.system() == 'Windows':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Ensure project root is on sys.path so that 'services.*' absolute imports work
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
_PROJECT_ROOT_STR = str(_PROJECT_ROOT)
if _PROJECT_ROOT_STR not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT_STR)

# Agora importa uvicorn e inicia
import uvicorn

if __name__ == "__main__":
    # Configura o loop antes de iniciar uvicorn
    if platform.system() == 'Windows':
        # Força novamente para garantir
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    # Inicia o uvicorn
    uvicorn.run(
        "services.high_frequency.main:app",
        host="0.0.0.0",
        port=8002,
        reload=False,
        log_level="info"
    )
