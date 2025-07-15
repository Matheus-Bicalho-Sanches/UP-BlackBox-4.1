import os
from firebase_admin import credentials, initialize_app, firestore
from dotenv import load_dotenv

# Carrega variáveis do .env
load_dotenv()

cred_dict = {
    "type": "service_account",
    "project_id": os.environ["FIREBASE_PROJECT_ID"],
    "private_key_id": os.environ["FIREBASE_PRIVATE_KEY_ID"],
    "private_key": os.environ["FIREBASE_PRIVATE_KEY"].replace("\\n", "\n"),
    "client_email": os.environ["FIREBASE_CLIENT_EMAIL"],
    "client_id": os.environ["FIREBASE_CLIENT_ID"],
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": os.environ["FIREBASE_CERT_URL"]
}

# Nome do bucket do Storage
STORAGE_BUCKET = os.environ.get("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET")

# Só inicializa uma vez
import firebase_admin
if not firebase_admin._apps:
    cred = credentials.Certificate(cred_dict)
    initialize_app(cred, {
        "storageBucket": STORAGE_BUCKET
    })

db = firestore.client() 