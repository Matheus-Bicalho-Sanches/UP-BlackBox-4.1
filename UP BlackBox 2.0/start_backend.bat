@echo off
REM Inicia o backend FastAPI da UP BlackBox 2.0
python -m uvicorn main:app --reload --port 8003
pause 