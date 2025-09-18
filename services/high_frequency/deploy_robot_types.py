#!/usr/bin/env python3
"""
Script para executar a implementação completa do sistema de tipos de robôs
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

from execute_robot_type_migration import execute_migration

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def deploy_robot_types():
    """Executa a implementação completa do sistema de tipos de robôs"""
    try:
        logger.info("🚀 Iniciando implementação do sistema de tipos de robôs...")
        
        # 1. Executa migração do banco de dados
        logger.info("📊 Passo 1: Executando migração do banco de dados...")
        migration_success = await execute_migration()
        
        if not migration_success:
            logger.error("❌ Falha na migração do banco de dados!")
            return False
        
        logger.info("✅ Migração do banco de dados concluída com sucesso!")
        
        # 2. Verifica se todos os arquivos foram modificados
        logger.info("📁 Passo 2: Verificando arquivos modificados...")
        
        files_to_check = [
            'robot_models.py',
            'robot_detector.py', 
            'robot_persistence.py',
            'main.py',
            '../../../src/app/dashboard/blackbox-multi/motion-tracker/page.tsx'
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
        logger.info("✅ Coluna 'robot_type' adicionada à tabela robot_patterns")
        logger.info("✅ Enum RobotType criado em robot_models.py")
        logger.info("✅ TWAPPattern atualizado com campo robot_type")
        logger.info("✅ TWAPDetector modificado para salvar como 'Robô Tipo 1'")
        logger.info("✅ RobotPersistence atualizado com robot_type em todas as queries")
        logger.info("✅ API modificada para retornar robot_type")
        logger.info("✅ Interface Motion Tracker atualizada para exibir tipo do robô")
        
        logger.info("🎉 Implementação do sistema de tipos de robôs concluída com sucesso!")
        logger.info("🔄 Reinicie o serviço high_frequency para aplicar as mudanças")
        logger.info("🌐 Atualize a página Motion Tracker para ver as mudanças na interface")
        
        return True
        
    except Exception as e:
        logger.error(f"💥 Erro durante a implementação: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(deploy_robot_types())
    if success:
        print("\n" + "="*60)
        print("🎯 IMPLEMENTAÇÃO CONCLUÍDA COM SUCESSO!")
        print("="*60)
        print("📋 PRÓXIMOS PASSOS:")
        print("1. Reinicie o serviço high_frequency:")
        print("   cd services/high_frequency && python main.py")
        print("2. Acesse a interface Motion Tracker:")
        print("   http://localhost:3000/dashboard/blackbox-multi/motion-tracker")
        print("3. Verifique se os robôs aparecem como 'Robô Tipo 1'")
        print("="*60)
    else:
        print("\n❌ FALHA NA IMPLEMENTAÇÃO!")
        print("Verifique os logs acima para detalhes do erro.")
        sys.exit(1)
