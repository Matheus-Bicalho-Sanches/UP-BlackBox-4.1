#!/usr/bin/env python3
"""
Script para verificar o tamanho real das coleções do Firestore
Usa o Firebase Admin SDK para acesso direto
"""

import firebase_admin
from firebase_admin import credentials, firestore
from pathlib import Path
import json

def load_firebase_credentials():
    """Carrega credenciais do Firebase"""
    # Tentar diferentes localizações do arquivo de credenciais
    possible_paths = [
        Path(__file__).parent.parent / "UP BlackBox 4.0" / "secrets" / "up-gestao-firebase-adminsdk-fbsvc-7657b3faa7.json",
        Path(__file__).parent.parent / "UP BlackBox 4.0" / "blackbox-ba9f6-firebase-adminsdk-4aovl-8facc6eaf5.json",
        Path(__file__).parent.parent / "blackbox-ba9f6-firebase-adminsdk-4aovl-8facc6eaf5.json",
        Path(__file__).parent.parent / "firebase-credentials.json",
    ]
    
    for path in possible_paths:
        if path.exists():
            print(f"✅ Credenciais encontradas em: {path}")
            return str(path)
    
    print("❌ Arquivo de credenciais não encontrado!")
    print("   Procurado em:")
    for path in possible_paths:
        print(f"   - {path}")
    return None

def check_collection_sizes():
    """Verifica o tamanho de cada coleção"""
    
    # Inicializar Firebase Admin
    cred_path = load_firebase_credentials()
    if not cred_path:
        return
    
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin inicializado com sucesso!\n")
    except Exception as e:
        print(f"❌ Erro ao inicializar Firebase: {e}")
        return
    
    db = firestore.client()
    
    collections = [
        'posicoesDLL',
        'posicoesAjusteManual',
        'ordensDLL',
        'CarteirasDeRefDLL',
        'strategies',
        'contasDll',
        'strategyAllocations'
    ]
    
    print("🔍 Verificando tamanho das coleções do Firestore...\n")
    
    results = []
    
    for collection_name in collections:
        try:
            print(f"📊 Verificando {collection_name}...", end=" ", flush=True)
            
            # Contar documentos
            collection_ref = db.collection(collection_name)
            docs = collection_ref.stream()
            count = sum(1 for _ in docs)
            
            results.append({
                'collection': collection_name,
                'count': count
            })
            
            print(f"✅ {count:,} documentos")
            
        except Exception as e:
            print(f"❌ Erro: {e}")
            results.append({
                'collection': collection_name,
                'count': 'ERROR',
                'error': str(e)
            })
    
    # Resumo
    print("\n╔════════════════════════════════════════════════════════════╗")
    print("║              RESUMO DAS COLEÇÕES FIRESTORE                 ║")
    print("╠════════════════════════════════════════════════════════════╣")
    
    for result in results:
        collection_str = result['collection'].ljust(30)
        count_str = str(result['count']).rjust(20) if result['count'] != 'ERROR' else 'ERROR'.rjust(20)
        print(f"║ {collection_str} {count_str} ║")
    
    print("╚════════════════════════════════════════════════════════════╝")
    
    # Análise detalhada
    posicoes = next((r['count'] for r in results if r['collection'] == 'posicoesDLL'), 0)
    ajustes = next((r['count'] for r in results if r['collection'] == 'posicoesAjusteManual'), 0)
    
    if isinstance(posicoes, int) and isinstance(ajustes, int):
        print("\n📊 ANÁLISE:")
        print(f"   • Total de documentos em posicoesDLL: {posicoes:,}")
        print(f"   • Total de documentos em posicoesAjusteManual: {ajustes:,}")
        print(f"   • Total combinado: {posicoes + ajustes:,}")
        
        print("\n🔴 PROBLEMA IDENTIFICADO:")
        print(f"   • Reads reportados pelo monitor em 3.57 min:")
        print(f"     - posicoesDLL: 19.688 reads")
        print(f"     - posicoesAjusteManual: 7.180 reads")
        print(f"     - Total: 26.868 reads")
        
        print(f"\n   • Documentos reais nas coleções:")
        print(f"     - posicoesDLL: {posicoes:,} docs")
        print(f"     - posicoesAjusteManual: {ajustes:,} docs")
        print(f"     - Total: {posicoes + ajustes:,} docs")
        
        if posicoes + ajustes > 0:
            multiplier = 26868 / (posicoes + ajustes)
            print(f"\n   • 🚨 O sistema está lendo os mesmos dados ~{multiplier:.1f}x!")
            print(f"   • Isso indica múltiplas chamadas desnecessárias.")
            print(f"   • Economia potencial: {26868 - (posicoes + ajustes):,} reads ({((26868 - (posicoes + ajustes)) / 26868 * 100):.1f}%)")
    
    # Análise de ordens também
    ordens = next((r['count'] for r in results if r['collection'] == 'ordensDLL'), 0)
    if isinstance(ordens, int):
        print(f"\n⚠️  ATENÇÃO: ordensDLL tem {ordens:,} documentos!")
        if ordens > 10000:
            print(f"   • Esta coleção está muito grande e pode causar custos altos.")
            print(f"   • Considere implementar paginação ou arquivamento de ordens antigas.")

if __name__ == "__main__":
    check_collection_sizes()
