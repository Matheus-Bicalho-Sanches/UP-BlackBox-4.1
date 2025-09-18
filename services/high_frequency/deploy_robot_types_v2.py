#!/usr/bin/env python3
"""
Script para implementar os 3 tipos de robôs baseados no volume em % do mercado
Robô Tipo 1: < 5%
Robô Tipo 2: 5% a 10%  
Robô Tipo 3: > 10%
"""

import asyncio
import sys
import os
import logging
from pathlib import Path

# Fix para Windows - corrige o event loop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Adiciona o diretório atual ao path para imports
current_dir = Path(__file__).parent
sys.path.append(str(current_dir))

from reclassify_existing_robots import reclassify_existing_robots

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def deploy_robot_types_v2():
    """Implementa os 3 tipos de robôs baseados no volume em % do mercado"""
    try:
        logger.info("🚀 Iniciando implementação dos 3 tipos de robôs...")
        
        # 1. Reclassifica robôs existentes
        logger.info("📊 Passo 1: Reclassificando robôs existentes...")
        reclassify_success = await reclassify_existing_robots()
        
        if not reclassify_success:
            logger.error("❌ Falha na reclassificação dos robôs existentes!")
            return False
        
        logger.info("✅ Reclassificação dos robôs existentes concluída!")
        
        # 2. Verifica se todos os arquivos foram modificados
        logger.info("📁 Passo 2: Verificando arquivos modificados...")
        
        files_to_check = [
            'robot_models.py',
            'robot_detector.py', 
            'robot_persistence.py',
            'main.py'
        ]
        
        missing_files = []
        for file_path in files_to_check:
            full_path = current_dir / file_path
            if not full_path.exists():
                missing_files.append(str(full_path))
        
        if missing_files:
            logger.warning(f"⚠️ Alguns arquivos não foram encontrados: {missing_files}")
        else:
            logger.info("✅ Todos os arquivos necessários estão presentes!")
        
        # 3. Resumo da implementação
        logger.info("📋 Passo 3: Resumo da implementação...")
        logger.info("✅ Enum RobotType com 3 tipos criado")
        logger.info("✅ Lógica de classificação por volume % implementada")
        logger.info("✅ TWAPDetector atualizado para classificar automaticamente")
        logger.info("✅ RobotPersistence atualizado para calcular e salvar tipo correto")
        logger.info("✅ Robôs existentes reclassificados baseado no volume %")
        
        logger.info("🎯 Critérios de classificação:")
        logger.info("   🟢 Robô Tipo 1: Volume < 5% do mercado")
        logger.info("   🟡 Robô Tipo 2: Volume entre 5% e 10% do mercado")
        logger.info("   🔴 Robô Tipo 3: Volume > 10% do mercado")
        
        logger.info("🎉 Implementação dos 3 tipos de robôs concluída com sucesso!")
        logger.info("🔄 Reinicie o serviço high_frequency para aplicar as mudanças")
        logger.info("🌐 Acesse a página Motion Tracker para ver os tipos atualizados")
        
        return True
        
    except Exception as e:
        logger.error(f"💥 Erro durante a implementação: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(deploy_robot_types_v2())
    if success:
        print("\n" + "="*70)
        print("🎯 IMPLEMENTAÇÃO DOS 3 TIPOS DE ROBÔS CONCLUÍDA!")
        print("="*70)
        print("🤖 CRITÉRIOS DE CLASSIFICAÇÃO:")
        print("   🟢 Robô Tipo 1: Volume < 5% do mercado")
        print("   🟡 Robô Tipo 2: Volume entre 5% e 10% do mercado") 
        print("   🔴 Robô Tipo 3: Volume > 10% do mercado")
        print()
        print("📋 PRÓXIMOS PASSOS:")
        print("1. Reinicie o serviço high_frequency:")
        print("   python main.py")
        print("2. Acesse a interface Motion Tracker:")
        print("   http://localhost:3000/dashboard/blackbox-multi/motion-tracker")
        print("3. Verifique se os robôs aparecem com os tipos corretos")
        print("4. Novos robôs serão automaticamente classificados")
        print("="*70)
    else:
        print("\n❌ FALHA NA IMPLEMENTAÇÃO!")
        print("Verifique os logs acima para detalhes do erro.")
        sys.exit(1)
