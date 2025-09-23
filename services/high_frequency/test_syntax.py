#!/usr/bin/env python3
"""Teste de sintaxe do main.py"""

try:
    import ast
    with open('main.py', 'r', encoding='utf-8') as f:
        source = f.read()
    
    # Parse do arquivo
    ast.parse(source)
    print("✅ Sintaxe OK - main.py está correto")
    
    # Teste de importação
    import importlib.util
    spec = importlib.util.spec_from_file_location("main", "main.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    print("✅ Importação OK - main.py pode ser importado")
    
    # Verifica se tem app
    if hasattr(module, 'app'):
        print("✅ App FastAPI encontrado")
    else:
        print("❌ App FastAPI não encontrado")
        
except SyntaxError as e:
    print(f"❌ Erro de sintaxe na linha {e.lineno}: {e.msg}")
    print(f"   Texto: {e.text}")
except Exception as e:
    print(f"❌ Erro: {e}")
