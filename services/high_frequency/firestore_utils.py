"""
Utilitários para integração com Firestore
"""
import logging
import firebase_admin
from firebase_admin import credentials, firestore
import os
from pathlib import Path
from dotenv import load_dotenv

# Carrega .env.local se ainda não foi carregado
_PROJECT_ROOT = Path(__file__).resolve().parents[2]
env_local = _PROJECT_ROOT / ".env.local"
if env_local.exists():
    load_dotenv(env_local)

logger = logging.getLogger(__name__)

def init_firebase():
    """Inicializa Firebase Admin SDK usando variáveis de ambiente."""
    try:
        # Primeiro tenta usar arquivo de credenciais se existir
        firebase_credentials_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "firebase-credentials.json")
        
        if os.path.exists(firebase_credentials_path):
            cred = credentials.Certificate(firebase_credentials_path)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK initialized successfully with credentials file")
            return
        
        # Se não tem arquivo, tenta usar variáveis de ambiente
        firebase_project_id = os.getenv("FIREBASE_PROJECT_ID")
        firebase_private_key = os.getenv("FIREBASE_PRIVATE_KEY")
        firebase_client_email = os.getenv("FIREBASE_CLIENT_EMAIL")
        
        if firebase_project_id and firebase_private_key and firebase_client_email:
            cred_dict = {
                "type": "service_account",
                "project_id": firebase_project_id,
                "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
                "private_key": firebase_private_key.replace("\\n", "\n"),
                "client_email": firebase_client_email,
                "client_id": os.getenv("FIREBASE_CLIENT_ID"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "client_x509_cert_url": os.getenv("FIREBASE_CERT_URL")
            }
            
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred, {
                "storageBucket": os.getenv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET")
            })
            logger.info("Firebase Admin SDK initialized successfully with environment variables")
            return
        
        # Se não tem nem arquivo nem variáveis, usa default
        logger.warning("Firebase credentials not found in file or environment variables, using default app")
        firebase_admin.initialize_app()
        
    except Exception as e:
        logger.error(f"Failed to initialize Firebase: {e}")

async def load_subscriptions_from_firestore():
    """Carrega assinaturas ativas do Firestore."""
    try:
        db = firestore.client()
        docs = db.collection('activeSubscriptions').where('status', '==', 'active').stream()
        
        loaded_count = 0
        for doc in docs:
            data = doc.to_dict()
            symbol = data.get('symbol', '').upper()
            if symbol:
                # Aqui você pode adicionar lógica para auto-subscribe
                logger.info(f"Carregando assinatura do Firestore: {symbol}")
                loaded_count += 1
        
        logger.info(f"Carregadas {loaded_count} assinaturas do Firestore")
        
    except Exception as e:
        logger.error(f"Erro ao carregar assinaturas do Firestore: {e}")
