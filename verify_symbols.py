#!/usr/bin/env python3
"""
Script para verificar se todos os símbolos do dll_launcher.py estão na lista do Motion Tracker
"""

def extract_symbols_from_dll_launcher():
    """Extrai todos os símbolos do dll_launcher.py"""
    symbols = []
    
    try:
        with open('services/market_feed_next/dll_launcher.py', 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Busca por todas as linhas com dll_instance.subscribe
        lines = content.split('\n')
        for line in lines:
            if 'dll_instance.subscribe(' in line:
                # Extrai o símbolo entre aspas
                start = line.find('"') + 1
                end = line.find('"', start)
                if start > 0 and end > start:
                    symbol = line[start:end]
                    symbols.append(symbol)
                    
    except Exception as e:
        print(f"Erro ao ler dll_launcher.py: {e}")
        return []
    
    return sorted(symbols)

def extract_symbols_from_motion_tracker():
    """Extrai todos os símbolos do Motion Tracker (exceto 'TODOS')"""
    symbols = []
    
    try:
        with open('src/app/dashboard/blackbox-multi/motion-tracker/page.tsx', 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Busca pela seção de mockSymbols
        start = content.find('const mockSymbols = [')
        if start == -1:
            return []
            
        end = content.find('];', start)
        if end == -1:
            return []
            
        symbols_section = content[start:end]
        
        # Extrai símbolos entre aspas simples
        import re
        pattern = r"'([A-Z0-9]+)'"
        matches = re.findall(pattern, symbols_section)
        
        # Remove 'TODOS' e ordena
        symbols = [s for s in matches if s != 'TODOS']
        symbols.sort()
        
    except Exception as e:
        print(f"Erro ao ler Motion Tracker: {e}")
        return []
    
    return symbols

def main():
    print("🔍 VERIFICANDO SÍMBOLOS ENTRE DLL_LAUNCHER E MOTION TRACKER")
    print("=" * 60)
    
    # Extrai símbolos do dll_launcher.py
    dll_symbols = extract_symbols_from_dll_launcher()
    print(f"\n📊 DLL Launcher ({len(dll_symbols)} símbolos):")
    for i, symbol in enumerate(dll_symbols, 1):
        print(f"  {i:2d}. {symbol}")
    
    # Extrai símbolos do Motion Tracker
    mt_symbols = extract_symbols_from_motion_tracker()
    print(f"\n📊 Motion Tracker ({len(mt_symbols)} símbolos):")
    for i, symbol in enumerate(mt_symbols, 1):
        print(f"  {i:2d}. {symbol}")
    
    # Verifica diferenças
    dll_set = set(dll_symbols)
    mt_set = set(mt_symbols)
    
    missing_in_mt = dll_set - mt_set
    extra_in_mt = mt_set - dll_set
    
    print(f"\n🔍 ANÁLISE:")
    print(f"  ✅ Símbolos em ambos: {len(dll_set & mt_set)}")
    print(f"  ❌ Faltando no Motion Tracker: {len(missing_in_mt)}")
    print(f"  ⚠️  Extras no Motion Tracker: {len(extra_in_mt)}")
    
    if missing_in_mt:
        print(f"\n❌ SÍMBOLOS FALTANDO NO MOTION TRACKER:")
        for symbol in sorted(missing_in_mt):
            print(f"  - {symbol}")
    
    if extra_in_mt:
        print(f"\n⚠️  SÍMBOLOS EXTRAS NO MOTION TRACKER:")
        for symbol in sorted(extra_in_mt):
            print(f"  - {symbol}")
    
    if not missing_in_mt and not extra_in_mt:
        print(f"\n🎉 PERFEITO! Todos os símbolos estão sincronizados!")
    
    print(f"\n📈 RESUMO:")
    print(f"  DLL Launcher: {len(dll_symbols)} símbolos")
    print(f"  Motion Tracker: {len(mt_symbols)} símbolos + 'TODOS'")
    print(f"  Total único: {len(dll_set)} símbolos")

if __name__ == "__main__":
    main()
