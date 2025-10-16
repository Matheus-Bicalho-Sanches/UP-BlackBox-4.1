#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Teste de carregamento da ProfitDLL
===================================

Este script testa se a ProfitDLL pode ser carregada corretamente
na VM Azure Windows Server 2022.

Uso:
    python test_dll.py

Autor: Sistema UP BlackBox 4.0
Data: 16/10/2025
"""

import os
import sys
import ctypes
from pathlib import Path

def test_dll_loading():
    """
    Testa o carregamento da ProfitDLL.dll
    """
    print("=" * 60)
    print("🔍 TESTE DE CARREGAMENTO DA PROFITDLL")
    print("=" * 60)
    print()
    
    # Caminho da DLL conforme configurado na VM
    dll_path = r"C:\Users\UPgestao\Desktop\Site-UP- 4.1 - dev\Dll_Profit\DLLs\Win64"
    dll_file = os.path.join(dll_path, "ProfitDLL.dll")
    
    print(f"📁 Caminho da pasta DLL: {dll_path}")
    print(f"📄 Arquivo DLL: {dll_file}")
    print()
    
    # Verificar se a pasta existe
    if not os.path.exists(dll_path):
        print(f"❌ ERRO: Pasta não encontrada: {dll_path}")
        print("   Verifique se a pasta Dll_Profit foi copiada corretamente para a VM")
        return False
    
    print(f"✅ Pasta encontrada: {dll_path}")
    
    # Verificar se o arquivo DLL existe
    if not os.path.exists(dll_file):
        print(f"❌ ERRO: Arquivo DLL não encontrado: {dll_file}")
        print("   Verifique se ProfitDLL.dll está na pasta Win64")
        return False
    
    print(f"✅ Arquivo DLL encontrado: {dll_file}")
    
    # Verificar tamanho do arquivo
    file_size = os.path.getsize(dll_file)
    file_size_mb = file_size / (1024 * 1024)
    print(f"📊 Tamanho do arquivo: {file_size_mb:.2f} MB")
    
    # Verificar dependências (arquivos .dll na mesma pasta)
    print()
    print("🔍 Verificando dependências na pasta Win64:")
    dll_dependencies = [
        "libcrypto-1_1-x64.dll",
        "libssl-1_1-x64.dll", 
        "libeay32.dll"
    ]
    
    for dep in dll_dependencies:
        dep_path = os.path.join(dll_path, dep)
        if os.path.exists(dep_path):
            print(f"  ✅ {dep}")
        else:
            print(f"  ❌ {dep} (FALTANDO)")
    
    print()
    print("🚀 Tentando carregar ProfitDLL.dll...")
    
    try:
        # Tentar carregar a DLL
        # Usar WinDLL para DLLs Windows que seguem convenção __stdcall
        profit_dll = ctypes.WinDLL(dll_file)
        
        print("✅ SUCESSO! ProfitDLL.dll carregada com sucesso!")
        print(f"✅ Handle da DLL: {profit_dll}")
        
        # Tentar verificar se a DLL tem funções básicas
        print()
        print("🔍 Verificando funções disponíveis na DLL...")
        try:
            # Listar algumas funções comuns que podem existir
            # (Isso pode variar dependendo da versão da DLL)
            functions_to_check = [
                "Initialize",
                "Login", 
                "GetAccounts",
                "GetPositions",
                "SendOrder"
            ]
            
            available_functions = []
            for func_name in functions_to_check:
                try:
                    func = getattr(profit_dll, func_name)
                    available_functions.append(func_name)
                    print(f"  ✅ {func_name}")
                except AttributeError:
                    print(f"  ❓ {func_name} (não encontrada)")
            
            if available_functions:
                print(f"\n✅ Encontradas {len(available_functions)} funções na DLL")
            else:
                print("\n⚠️  Nenhuma função conhecida encontrada (pode ser normal)")
                
        except Exception as e:
            print(f"⚠️  Erro ao verificar funções: {e}")
            print("   (Isso pode ser normal - a DLL foi carregada com sucesso)")
        
        return True
        
    except OSError as e:
        print(f"❌ ERRO ao carregar DLL: {e}")
        print()
        print("💡 Possíveis soluções:")
        print("   1. Verificar se Visual C++ Redistributable está instalado")
        print("   2. Verificar se todas as dependências (.dll) estão na pasta")
        print("   3. Verificar se a DLL é compatível com Windows Server 2022")
        print("   4. Executar como Administrador")
        return False
        
    except Exception as e:
        print(f"❌ ERRO inesperado: {e}")
        return False

def test_environment():
    """
    Testa o ambiente Python e dependências
    """
    print("=" * 60)
    print("🐍 INFORMAÇÕES DO AMBIENTE PYTHON")
    print("=" * 60)
    print()
    
    print(f"Python: {sys.version}")
    print(f"Plataforma: {sys.platform}")
    print(f"Arquitetura: {os.environ.get('PROCESSOR_ARCHITECTURE', 'N/A')}")
    print(f"Diretório atual: {os.getcwd()}")
    print()

def main():
    """
    Função principal do teste
    """
    test_environment()
    
    success = test_dll_loading()
    
    print("=" * 60)
    if success:
        print("🎉 RESULTADO: DLL CARREGADA COM SUCESSO!")
        print("   ✅ A ProfitDLL está funcionando corretamente na VM")
        print("   ✅ Pode prosseguir com a configuração do serviço Windows")
    else:
        print("❌ RESULTADO: ERRO AO CARREGAR DLL")
        print("   ❌ Verifique os problemas listados acima")
        print("   ❌ Corrija antes de prosseguir")
    print("=" * 60)
    
    return success

if __name__ == "__main__":
    main()
