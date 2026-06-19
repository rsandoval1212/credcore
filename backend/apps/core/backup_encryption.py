"""
RIESGO 5: Cifrado de backups con Fernet (AES-128-CBC + HMAC-SHA256).

La clave se deriva de BACKUP_ENCRYPTION_KEY env var, o se genera automáticamente
y se guarda en backups/.encryption_key (solo en desarrollo).
"""
import os
import base64
import hashlib
import logging
from pathlib import Path

logger = logging.getLogger('credcore.backup')


def get_backups_dir() -> str:
    """Ruta escribible para guardar respaldos.

    Prioridad:
    1. BACKUPS_DIR env var (la setea credcore_app.py apuntando a %APPDATA%\\CredCore\\backups)
    2. %APPDATA%\\CredCore\\backups (fallback Windows)
    3. ~/.credcore/backups (fallback Linux/Mac)
    """
    env_dir = os.environ.get('BACKUPS_DIR', '').strip()
    if env_dir:
        return env_dir

    appdata = os.environ.get('APPDATA', '')
    if appdata:
        return str(Path(appdata) / 'CredCore' / 'backups')

    return str(Path.home() / '.credcore' / 'backups')


def _get_encryption_key() -> bytes:
    """Obtiene o genera la clave de cifrado para backups."""
    env_key = os.environ.get('BACKUP_ENCRYPTION_KEY', '')
    if env_key:
        # Derivar clave de 32 bytes del valor proporcionado
        return base64.urlsafe_b64encode(hashlib.sha256(env_key.encode()).digest())

    # Usar la carpeta escribible de backups (no BASE_DIR que es read-only en Program Files)
    key_path = Path(get_backups_dir()) / '.encryption_key'
    if key_path.exists():
        return key_path.read_bytes().strip()

    from cryptography.fernet import Fernet
    key = Fernet.generate_key()
    key_path.parent.mkdir(parents=True, exist_ok=True)
    key_path.write_bytes(key)
    logger.info('[BACKUP] Clave de cifrado generada en %s', key_path)
    return key


def encrypt_backup(source_path: str) -> str:
    """
    Cifra un archivo de backup. Retorna la ruta del archivo cifrado (.enc).
    El archivo original se elimina después de cifrar.
    """
    from cryptography.fernet import Fernet

    key = _get_encryption_key()
    fernet = Fernet(key)

    with open(source_path, 'rb') as f:
        data = f.read()

    encrypted = fernet.encrypt(data)
    enc_path = source_path + '.enc'

    with open(enc_path, 'wb') as f:
        f.write(encrypted)

    # Eliminar archivo sin cifrar
    os.remove(source_path)
    logger.info('[BACKUP] Archivo cifrado: %s', enc_path)
    return enc_path


def decrypt_backup(enc_path: str) -> str:
    """
    Descifra un archivo de backup (.enc). Retorna la ruta del archivo descifrado.
    """
    from cryptography.fernet import Fernet

    key = _get_encryption_key()
    fernet = Fernet(key)

    with open(enc_path, 'rb') as f:
        encrypted = f.read()

    decrypted = fernet.decrypt(encrypted)

    # Guardar temporalmente descifrado
    dec_path = enc_path.replace('.enc', '')
    with open(dec_path, 'wb') as f:
        f.write(decrypted)

    logger.info('[BACKUP] Archivo descifrado: %s', dec_path)
    return dec_path
