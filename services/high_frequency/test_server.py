#!/usr/bin/env python3
"""Teste do servidor FastAPI"""

import subprocess
import time
import requests
import sys

def test_server():
    print("🔍 Testando servidor FastAPI...")
    
    try:
        # Testa sintaxe do main.py
        print("1. Verificando sintaxe do main.py...")
        result = subprocess.run([sys.executable, "-m", "py_compile", "main.py"], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Erro de sintaxe: {result.stderr}")
            return False
        print("✅ Sintaxe OK")
        
        # Testa importação
        print("2. Testando importação...")
        result = subprocess.run([sys.executable, "-c", 
                               "import main; print('Import OK')"], 
                              capture_output=True, text=True)
        if result.returncode != 0:
            print(f"❌ Erro de importação: {result.stderr}")
            return False
        print("✅ Importação OK")
        
        # Inicia servidor em background
        print("3. Iniciando servidor...")
        process = subprocess.Popen([sys.executable, "start_uvicorn.py"], 
                                 stdout=subprocess.PIPE, 
                                 stderr=subprocess.PIPE)
        
        # Aguarda um pouco
        time.sleep(5)
        
        # Testa se o servidor está rodando
        print("4. Testando endpoint...")
        try:
            response = requests.get("http://localhost:8002/status", timeout=5)
            if response.status_code == 200:
                print("✅ Servidor rodando corretamente!")
                print(f"   Resposta: {response.json()}")
                return True
            else:
                print(f"❌ Servidor retornou status {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"❌ Erro ao conectar: {e}")
        
        # Mata o processo
        process.terminate()
        process.wait()
        
    except Exception as e:
        print(f"❌ Erro geral: {e}")
        return False
    
    return False

if __name__ == "__main__":
    success = test_server()
    sys.exit(0 if success else 1)
