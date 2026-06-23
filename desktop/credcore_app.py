"""
CredCore Desktop — Aplicación de Escritorio
Usa pywebview para la interfaz y Django embebido como backend.

Arquitectura:
1. Inicia Django runserver en un puerto local
2. Sirve el frontend estático (React build) via Django/SimpleHTTP
3. Abre una ventana nativa del sistema que carga la app

El usuario final solo ve una ventana nativa — no sabe que es web por dentro.
"""
import os
import sys
import time
import json
import shutil
import socket
import signal
import secrets
import sqlite3
import threading
import subprocess
import webbrowser
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.request import urlopen
from urllib.error import URLError
from urllib.parse import unquote, urlsplit

# ── Configuración ────────────────────────────────────────────────────────────
APP_NAME = "CredCore"
APP_VERSION = "1.3.1"
BACKEND_PORT = 8742
FRONTEND_PORT = 8743

# ── Paths ────────────────────────────────────────────────────────────────────
if getattr(sys, 'frozen', False):
    # Ejecutando como .exe (PyInstaller)
    BASE_DIR = Path(sys._MEIPASS)
    APP_DIR = Path(os.path.dirname(sys.executable))
else:
    # Ejecutando como script
    BASE_DIR = Path(__file__).parent
    APP_DIR = BASE_DIR

BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "electron" / "frontend-dist"
ICON_PATH = BASE_DIR / "credcore.ico"

# Datos del usuario
DATA_DIR = Path(os.environ.get('APPDATA', Path.home())) / "CredCore"
DB_PATH = DATA_DIR / "credcore.sqlite3"
MEDIA_DIR = DATA_DIR / "media"
BACKUPS_DIR = DATA_DIR / "backups"
LOGS_DIR = DATA_DIR / "logs"

# Crear directorios
for d in [DATA_DIR, MEDIA_DIR, BACKUPS_DIR, LOGS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Auto-configurar URL de actualización si no existe (apunta al repo de GitHub)
_UPDATE_URL_FILE = DATA_DIR / "update_url.txt"
if not _UPDATE_URL_FILE.exists():
    try:
        _UPDATE_URL_FILE.write_text(
            "https://raw.githubusercontent.com/rsandoval1212/credcore/main/version.json",
            encoding="utf-8"
        )
    except Exception:
        pass

# Archivos de estado de la instalación (en APPDATA, no en la carpeta del exe
# que es Program Files = solo lectura)
SECRET_KEY_FILE = DATA_DIR / "secret.key"
CREDENTIALS_FILE = DATA_DIR / "CREDENCIALES_INICIALES.txt"
LAST_MIGRATED_VERSION_FILE = DATA_DIR / "last_migrated_version.txt"

# Política de respaldos automáticos
BACKUP_KEEP_DAYS = 30           # eliminar respaldos locales con más de N días
BACKUP_KEEP_MIN = 7             # SIEMPRE conservar al menos los últimos N (aunque sean viejos)

# ── Logging ──────────────────────────────────────────────────────────────────
LOG_FILE = LOGS_DIR / f"credcore_{datetime.now().strftime('%Y%m%d')}.log"

def log(msg):
    timestamp = datetime.now().strftime("%H:%M:%S")
    line = f"[{timestamp}] {msg}"
    try:
        print(line)
    except UnicodeEncodeError:
        print(line.encode('ascii', 'replace').decode())
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except:
        pass

# ── Seguridad: SECRET_KEY persistente por instalación ───────────────────────
def get_or_create_secret_key() -> str:
    """Devuelve el SECRET_KEY de Django para esta instalación.

    Antes se generaba uno nuevo cada arranque (`credcore-desktop-{epoch}`):
    eso (1) desloguea a todos los usuarios al cerrar la app porque los JWT
    quedan inválidos, y (2) lo hace adivinable. Ahora se genera UNA vez con
    `secrets.token_urlsafe(50)` (≈300 bits de entropía) y se guarda en APPDATA
    con permisos restringidos. Si el archivo se borra/corrompe, se regenera.
    """
    try:
        if SECRET_KEY_FILE.exists():
            key = SECRET_KEY_FILE.read_text(encoding="utf-8").strip()
            if len(key) >= 40:
                return key
        key = secrets.token_urlsafe(50)
        SECRET_KEY_FILE.write_text(key, encoding="utf-8")
        try:
            # Restringir lectura al usuario actual (Windows ACL via icacls)
            if sys.platform == "win32":
                subprocess.run(
                    ["icacls", str(SECRET_KEY_FILE), "/inheritance:r",
                     "/grant:r", f"{os.environ.get('USERNAME', '')}:F"],
                    capture_output=True, timeout=10,
                    creationflags=subprocess.CREATE_NO_WINDOW,
                )
        except Exception:
            pass
        log("SECRET_KEY generado y guardado (primera vez)")
        return key
    except Exception as e:
        # Último recurso: clave aleatoria en memoria (no persiste).
        # Mejor desloguear que fallar al arrancar.
        log(f"Error con SECRET_KEY: {e} — usando uno temporal")
        return secrets.token_urlsafe(50)


# ── Seguridad: contraseña inicial de admin (única por instalación) ──────────
def _generate_admin_password() -> str:
    """Contraseña aleatoria de 16 caracteres con letras+dígitos, fácil de leer.

    Evita ambigüedades (0/O, 1/l/I) para que el dueño la pueda copiar bien
    desde CREDENCIALES_INICIALES.txt sin errores de transcripción.
    """
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(16))


def _write_initial_credentials(password: str) -> None:
    """Escribe las credenciales iniciales en un archivo de texto para que el
    dueño/instalador las pueda leer una vez y luego pueda borrar el archivo.
    Solo se crea una vez (cuando se crea el admin por primera vez)."""
    try:
        content = (
            "================================================================\n"
            "  CREDENCIALES INICIALES DE CREDCORE\n"
            "================================================================\n"
            "\n"
            "  Esta instalación creó automáticamente un usuario administrador.\n"
            "  GUARDE estas credenciales en un lugar seguro y luego ELIMINE\n"
            "  este archivo.\n"
            "\n"
            "  ────────────────────────────────────────────────\n"
            "    Correo:     admin@credcore.local\n"
            f"   Contraseña:  {password}\n"
            "  ────────────────────────────────────────────────\n"
            "\n"
            "  IMPORTANTE:\n"
            "  • Cambie la contraseña la primera vez que inicie sesión.\n"
            "  • La contraseña es ÚNICA para esta instalación.\n"
            "  • Si pierde esta contraseña no se puede recuperar — tendría\n"
            "    que reinstalar y se PERDERÍAN los datos.\n"
            "\n"
            f"  Generado: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        )
        CREDENTIALS_FILE.write_text(content, encoding="utf-8")
        log(f"Credenciales iniciales escritas en: {CREDENTIALS_FILE}")
        log("=> El usuario debe leer ese archivo y luego borrarlo.")
    except Exception as e:
        log(f"No se pudo escribir credenciales iniciales: {e}")


# ── Integridad y respaldos automáticos ──────────────────────────────────────
def verify_db_integrity() -> bool:
    """Devuelve True si la BD está íntegra (PRAGMA integrity_check == 'ok').
    Si la BD aún no existe (primera instalación), devuelve True (no hay nada
    que verificar — Django la creará al migrar)."""
    if not DB_PATH.exists():
        return True
    try:
        con = sqlite3.connect(str(DB_PATH), timeout=10)
        try:
            row = con.execute("PRAGMA integrity_check").fetchone()
            result = (row[0] if row else "") == "ok"
        finally:
            con.close()
        if not result:
            log(f"!! INTEGRIDAD DE BD FALLÓ: {row[0] if row else '<sin filas>'}")
        return result
    except Exception as e:
        log(f"!! Error verificando integridad: {e}")
        return False


def _list_local_backups() -> list:
    """Lista respaldos locales ordenados del más reciente al más antiguo."""
    try:
        backups = [p for p in BACKUPS_DIR.iterdir()
                   if p.is_file() and p.name.startswith("credcore_backup_")
                   and (p.suffix in (".sqlite3", ".enc"))]
        backups.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return backups
    except Exception:
        return []


def auto_recover_from_backup() -> bool:
    """Si la BD principal está corrupta, intenta restaurarla desde el respaldo
    local más reciente que pase integrity_check. Mueve la BD dañada a
    `corrupt_<timestamp>.sqlite3` para no perderla."""
    log("Intentando auto-recuperación desde respaldos locales...")
    candidates = [b for b in _list_local_backups() if b.suffix == ".sqlite3"]
    if not candidates:
        log("No hay respaldos locales sin cifrar para restaurar automáticamente.")
        return False

    for backup in candidates:
        try:
            con = sqlite3.connect(str(backup), timeout=10)
            try:
                row = con.execute("PRAGMA integrity_check").fetchone()
            finally:
                con.close()
            if row and row[0] == "ok":
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                corrupt_dest = BACKUPS_DIR / f"corrupt_{ts}.sqlite3"
                if DB_PATH.exists():
                    shutil.move(str(DB_PATH), str(corrupt_dest))
                    log(f"BD dañada movida a: {corrupt_dest}")
                # Limpiar WAL/SHM antiguos que apuntan a la BD anterior
                for suf in ("-wal", "-shm"):
                    p = Path(str(DB_PATH) + suf)
                    if p.exists():
                        try:
                            p.unlink()
                        except Exception:
                            pass
                shutil.copy2(backup, DB_PATH)
                log(f"BD restaurada desde respaldo: {backup.name}")
                return True
        except Exception as e:
            log(f"Respaldo {backup.name} no se pudo verificar: {e}")
            continue

    log("Ningún respaldo local pasó la verificación.")
    return False


def create_backup(prefix: str = "credcore_backup") -> str | None:
    """Crea un respaldo `.sqlite3` de la BD actual con timestamp.
    Antes solo copiaba; ahora además rota respaldos viejos y devuelve la ruta."""
    if not DB_PATH.exists():
        return None
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_prefix = "".join(
        ch for ch in prefix if ch.isalnum() or ch in ("-", "_")
    ).strip("_") or "credcore_backup"
    backup_file = BACKUPS_DIR / f"{safe_prefix}_{timestamp}.sqlite3"
    try:
        # Usar la API de backup de SQLite (consistente incluso con WAL en uso)
        # Si la BD no está abierta por nadie, shutil.copy2 también sirve;
        # pero la API es más segura cuando el servidor podría escribir.
        src = sqlite3.connect(str(DB_PATH), timeout=30)
        try:
            dst = sqlite3.connect(str(backup_file))
            try:
                src.backup(dst)
            finally:
                dst.close()
        finally:
            src.close()
        log(f"Respaldo creado: {backup_file.name} ({backup_file.stat().st_size//1024} KB)")
        _rotate_local_backups()
        _mirror_to_external_folder(backup_file)
        _upload_to_drive(backup_file)
        return str(backup_file)
    except Exception as e:
        log(f"Error creando respaldo: {e}")
        return None


def restore_database_from_backup(backup_path: str | Path) -> bool:
    """Restaura una copia verificada antes de que el backend haya arrancado."""
    backup = Path(backup_path)
    if not backup.exists():
        log(f"No se encontro respaldo para restaurar: {backup}")
        return False
    try:
        con = sqlite3.connect(str(backup), timeout=10)
        try:
            row = con.execute("PRAGMA integrity_check").fetchone()
        finally:
            con.close()
        if not row or row[0] != "ok":
            log(f"El respaldo no paso integrity_check: {backup}")
            return False
        for suffix in ("-wal", "-shm"):
            stale = Path(str(DB_PATH) + suffix)
            if stale.exists():
                stale.unlink()
        shutil.copy2(backup, DB_PATH)
        log(f"Base de datos restaurada desde: {backup.name}")
        return True
    except Exception as e:
        log(f"Error restaurando respaldo {backup}: {e}")
        return False


def _rotate_local_backups() -> None:
    """Elimina respaldos locales con más de BACKUP_KEEP_DAYS, conservando
    SIEMPRE al menos BACKUP_KEEP_MIN del más reciente al más antiguo."""
    try:
        backups = _list_local_backups()
        if len(backups) <= BACKUP_KEEP_MIN:
            return
        cutoff = time.time() - BACKUP_KEEP_DAYS * 86400
        to_keep = set(p.name for p in backups[:BACKUP_KEEP_MIN])
        removed = 0
        for b in backups[BACKUP_KEEP_MIN:]:
            if b.name in to_keep:
                continue
            if b.stat().st_mtime < cutoff:
                try:
                    b.unlink()
                    removed += 1
                except Exception:
                    pass
        if removed:
            log(f"Rotación de respaldos: {removed} archivos viejos eliminados.")
    except Exception as e:
        log(f"Error rotando respaldos: {e}")


def _upload_to_drive(backup_path: Path) -> None:
    """Sube el respaldo a Google Drive (cuenta de servicio del dueño).

    El dueño configura UNA vez:
      - %APPDATA%\\CredCore\\service_account.json  (credencial Google)
      - %APPDATA%\\CredCore\\drive_folder_id.txt   (ID de la carpeta de ESE cliente)

    Si no están configurados o la subida falla, NO interrumpe el respaldo
    local. El log queda registrado para diagnóstico.
    """
    try:
        from drive_uploader import upload_backup  # módulo local, opcional
        ok, msg = upload_backup(str(backup_path))
        log(("Drive: " if ok else "Drive (omitido): ") + msg)
    except ImportError:
        # drive_uploader.py no incluido en este build
        pass
    except Exception as e:
        log(f"Drive: error inesperado: {e}")


def _find_drive_by_label(label: str) -> Path | None:
    """Busca una unidad de Windows (USB o disco) por su ETIQUETA de volumen.

    Por qué etiqueta y no letra: en Windows la USB puede recibir letras
    distintas (D:, E:, F:) según en qué puerto se conecte o qué otras unidades
    estén montadas. La etiqueta (ej: "CREDCORE_USB") es estable mientras el
    dueño no cambie el nombre — usar etiqueta hace que el respaldo siga
    funcionando si el cliente desenchufa y reconecta la USB.
    """
    if sys.platform != "win32" or not label:
        return None
    target = label.strip().upper()
    try:
        import ctypes
        from ctypes import wintypes
        GetVolumeInformationW = ctypes.windll.kernel32.GetVolumeInformationW
        # Itera A: a Z: y devuelve la primera que tenga la etiqueta buscada.
        for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
            root = f"{letter}:\\"
            if not Path(root).exists():
                continue
            vol_name_buf = ctypes.create_unicode_buffer(261)
            fs_name_buf = ctypes.create_unicode_buffer(261)
            ok = GetVolumeInformationW(
                root, vol_name_buf, 261, None, None, None, fs_name_buf, 261
            )
            if ok and vol_name_buf.value.strip().upper() == target:
                return Path(root)
    except Exception as e:
        log(f"Error buscando USB por etiqueta '{label}': {e}")
    return None


def _resolve_external_destination(config_value: str) -> Path | None:
    """Resuelve la configuración del archivo `external_backup_path.txt`.

    Acepta dos sintaxis:
      • Ruta directa:   `D:\\CredCore\\Backups`
      • USB por etiqueta: `usb:CREDCORE_USB` o `usb:CREDCORE_USB\\Subcarpeta`

    La sintaxis USB es la recomendada para clientes con memoria USB siempre
    conectada (sobrevive cambios de letra de unidad).
    """
    config_value = config_value.strip()
    if not config_value:
        return None
    if config_value.lower().startswith("usb:"):
        rest = config_value[4:].lstrip("\\/")
        # rest puede traer subcarpeta: "CREDCORE_USB\Backups" → label="CREDCORE_USB"
        parts = rest.replace("/", "\\").split("\\", 1)
        label = parts[0]
        subpath = parts[1] if len(parts) > 1 else ""
        root = _find_drive_by_label(label)
        if not root:
            log(f"USB con etiqueta '{label}' NO está conectada. Respaldo solo local.")
            return None
        return root / subpath if subpath else root
    return Path(config_value)


def _read_external_destinations() -> list:
    """Lee el archivo de configuración y devuelve la lista de destinos externos.

    `%APPDATA%\\CredCore\\external_backup_path.txt` admite UNA RUTA POR LÍNEA,
    así el cliente puede tener varios respaldos simultáneos (USB local +
    carpeta de Google Drive Desktop, por ejemplo). Líneas vacías o que
    empiezan con # se ignoran (permite comentarios).

    Sintaxis por línea:
      • `usb:LABEL[\\subcarpeta]`    USB detectada por etiqueta de volumen
      • `D:\\ruta\\absoluta`          Carpeta directa (Drive Desktop, red...)
    """
    config = DATA_DIR / "external_backup_path.txt"
    if not config.exists():
        return []
    try:
        raw = config.read_text(encoding="utf-8-sig")
    except Exception:
        return []
    out = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        out.append(line)
    return out


def _mirror_to_external_folder(backup_path: Path) -> None:
    """Copia el respaldo a CADA destino externo configurado, en paralelo.

    Resolución por destino:
      • `usb:CREDCORE_USB`           →  busca USB por etiqueta, copia ahí
      • `D:\\Respaldos\\CredCore`      →  copia a esa carpeta (Drive Desktop...)

    Estructura final: `<destino>/YYYY/MM/<nombre>.sqlite3`. Si un destino
    falla (USB desconectada, carpeta inaccesible) el resto SIGUE — un destino
    caído nunca rompe los demás ni el respaldo local.
    """
    destinos = _read_external_destinations()
    if not destinos:
        return
    now = datetime.now()
    ok_count = 0
    for raw in destinos:
        try:
            external = _resolve_external_destination(raw)
            if external is None:
                continue  # ya se logueó dentro de _resolve_external_destination
            dest_dir = external / f"{now.year:04d}" / f"{now.month:02d}"
            try:
                dest_dir.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                log(f"No se pudo preparar destino {dest_dir}: {e}. ¿USB llena o de solo lectura?")
                continue
            dest = dest_dir / backup_path.name
            shutil.copy2(backup_path, dest)
            log(f"Respaldo copiado a: {dest}")
            ok_count += 1
        except Exception as e:
            log(f"Error copiando a destino '{raw}': {e}")
    if ok_count == 0:
        log(f"Ningún destino externo recibió el respaldo (de {len(destinos)} configurados).")


def check_external_backup_status() -> str:
    """Verifica si los destinos externos están accesibles AHORA.

    Devuelve un mensaje multilinea con el estado de cada destino. Pensado para
    mostrarlo al arrancar la app y que el dueño/cliente sepa de inmediato si
    su USB está conectada o si alguna carpeta de Drive Desktop está OK.
    Sin configuración → devuelve cadena vacía.
    """
    destinos = _read_external_destinations()
    if not destinos:
        return ""
    lines = []
    for raw in destinos:
        try:
            if raw.lower().startswith("usb:"):
                label = raw[4:].split("\\", 1)[0].split("/", 1)[0].strip()
                root = _find_drive_by_label(label)
                if not root:
                    lines.append(f"⚠ USB '{label}' NO conectada")
                    continue
                try:
                    test = root / ".credcore_write_test"
                    test.write_text("ok"); test.unlink()
                    lines.append(f"✓ USB '{label}' conectada ({root})")
                except Exception:
                    lines.append(f"⚠ USB '{label}' detectada pero solo lectura")
            else:
                p = Path(raw)
                if not p.exists():
                    lines.append(f"⚠ Carpeta no existe: {p}")
                else:
                    lines.append(f"✓ Carpeta OK: {p}")
        except Exception as e:
            lines.append(f"⚠ Error en '{raw}': {e}")
    return " | ".join(lines)


def run_startup_protection() -> None:
    """Verificaciones al arrancar: integridad de BD + auto-recuperación si está
    corrupta + respaldo diario. Se ejecuta SIEMPRE antes de migrate/runserver."""
    if not verify_db_integrity():
        log("!! BD corrupta detectada al arrancar.")
        recovered = auto_recover_from_backup()
        if not recovered:
            log("!! La BD no se pudo auto-recuperar. La app seguirá pero podrían faltar datos.")

    # Estado del destino externo (USB, Drive Desktop, red) — informativo
    ext_status = check_external_backup_status()
    if ext_status:
        log(f"Respaldo externo: {ext_status}")

    # Respaldo automático diario: si hoy aún no hay ninguno, crear uno.
    if DB_PATH.exists():
        today = datetime.now().strftime("%Y%m%d")
        existing_today = [b for b in _list_local_backups() if today in b.name]
        if not existing_today:
            log("Creando respaldo automático del día...")
            create_backup()
        else:
            log(f"Ya existe respaldo de hoy ({len(existing_today)} archivos).")


# ── Port check ───────────────────────────────────────────────────────────────
def is_port_free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) != 0

def find_free_port(start=8742):
    for port in range(start, start + 100):
        if is_port_free(port):
            return port
    return start

# ── Backend (Django) ─────────────────────────────────────────────────────────
backend_process = None

def start_backend():
    global backend_process, BACKEND_PORT

    BACKEND_PORT = find_free_port(8742)
    FRONTEND_PORT_ACTUAL = find_free_port(BACKEND_PORT + 1)

    python_exe = sys.executable
    manage_py = str(BACKEND_DIR / "manage.py")

    env = os.environ.copy()
    env.update({
        "DJANGO_SETTINGS_MODULE": "config.settings.development",
        "USE_SQLITE": "True",
        "USE_REDIS": "False",
        "SECRET_KEY": get_or_create_secret_key(),
        "ALLOWED_HOSTS": "localhost,127.0.0.1",
        "CORS_ALLOWED_ORIGINS": f"http://localhost:{FRONTEND_PORT_ACTUAL},http://127.0.0.1:{FRONTEND_PORT_ACTUAL}",
        "DB_PATH": str(DB_PATH),
        "MEDIA_ROOT": str(MEDIA_DIR),
        "AUDIT_LOG_PATH": str(LOGS_DIR / "audit.log"),
        "BACKUPS_DIR": str(BACKUPS_DIR),
        # Para el endpoint de auto-actualización
        "APP_VERSION": APP_VERSION,
        "CREDCORE_APP_DIR": str(BASE_DIR),
    })

    # Antes de migrar, verificar integridad + crear respaldo automático del día.
    # Si la BD está corrupta, intentar auto-recuperar desde el último respaldo
    # íntegro (evita "database disk image is malformed" en producción).
    try:
        run_startup_protection()
    except Exception as e:
        log(f"Protección al arranque falló: {e}")

    # En cada cambio de version se crea un respaldo independiente justo antes
    # de migrar. Si Django falla, se restaura y no se abre una BD a medias.
    previous_version = ""
    try:
        previous_version = LAST_MIGRATED_VERSION_FILE.read_text(
            encoding="utf-8"
        ).strip()
    except Exception:
        pass
    pre_update_backup = None
    if DB_PATH.exists() and previous_version != APP_VERSION:
        log(
            f"Actualizacion detectada: {previous_version or 'version anterior'}"
            f" -> {APP_VERSION}"
        )
        pre_update_backup = create_backup(
            f"credcore_pre_update_v{APP_VERSION.replace('.', '_')}"
        )
        if not pre_update_backup:
            log("ERROR: no se pudo crear el respaldo previo a la actualizacion.")
            return False

    # Migraciones (la primera vez puede tardar varios minutos en PCs lentas)
    log("Ejecutando migraciones...")
    try:
        migration = subprocess.run(
            [python_exe, manage_py, "migrate", "--noinput"],
            cwd=str(BACKEND_DIR), env=env,
            capture_output=True, text=True, timeout=900,
        )
        if migration.returncode != 0:
            details = (migration.stderr or migration.stdout or "").strip()
            log(f"Error en migraciones (codigo {migration.returncode}): {details[-1500:]}")
            if pre_update_backup:
                restore_database_from_backup(pre_update_backup)
            return False
        LAST_MIGRATED_VERSION_FILE.write_text(APP_VERSION, encoding="utf-8")
        log("Migraciones completadas")
    except Exception as e:
        log(f"Error en migraciones: {e}")
        if pre_update_backup:
            restore_database_from_backup(pre_update_backup)
        return False

    # Crear superusuario si no existe — con contraseña ALEATORIA por instalación.
    # (Antes todas las instalaciones compartían la misma clave: riesgo de seguridad.)
    try:
        admin_password = _generate_admin_password()
        env_admin = dict(env, ADMIN_INITIAL_PASSWORD=admin_password)
        result = subprocess.run(
            [python_exe, manage_py, "shell", "-c",
             "import os; from apps.users.models import User; "
             "ex = User.objects.filter(email='admin@credcore.local').exists(); "
             "print('CREATED' if not ex else 'EXISTS'); "
             "ex or User.objects.create_superuser("
             "email='admin@credcore.local', username='admin', "
             "first_name='Admin', last_name='CredCore', "
             "password=os.environ['ADMIN_INITIAL_PASSWORD'])"],
            cwd=str(BACKEND_DIR), env=env_admin,
            capture_output=True, text=True, timeout=60,
        )
        if result and 'CREATED' in (result.stdout or ''):
            _write_initial_credentials(admin_password)
    except Exception as e:
        log(f"Error creando admin: {e}")

    # Seed permisos RBAC
    try:
        subprocess.run(
            [python_exe, manage_py, "shell", "-c",
             "from apps.users.models import Permission; "
             "[Permission.objects.get_or_create(module=m, action=a, "
             "defaults={'codename': f'{m}.{a}'}) "
             "for m, _ in Permission.MODULE_CHOICES "
             "for a, _ in Permission.ACTION_CHOICES] "
             "if Permission.objects.count() == 0 else None"],
            cwd=str(BACKEND_DIR), env=env,
            capture_output=True, text=True, timeout=60,
        )
    except:
        pass

    # Iniciar servidor
    # stdout/stderr van a un archivo de log: con PIPE nadie lee y, al llenarse
    # el buffer (~64KB de logs de peticiones), el servidor se bloquea.
    log(f"Iniciando backend en puerto {BACKEND_PORT}...")
    backend_log_file = open(LOGS_DIR / "backend.log", "a", encoding="utf-8", errors="replace")
    backend_process = subprocess.Popen(
        [python_exe, manage_py, "runserver", f"127.0.0.1:{BACKEND_PORT}", "--noreload"],
        cwd=str(BACKEND_DIR), env=env,
        stdout=backend_log_file, stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == 'win32' else 0,
    )

    # Esperar a que esté listo
    for i in range(30):
        try:
            urlopen(f"http://127.0.0.1:{BACKEND_PORT}/api/v1/health/", timeout=2)
            log("Backend listo [OK]")
            return True
        except:
            time.sleep(1)

    log("Backend tardó en responder, continuando...")
    return True

# ── Frontend Server ──────────────────────────────────────────────────────────
frontend_server = None

class FrontendHandler(SimpleHTTPRequestHandler):
    """Sirve archivos estáticos del frontend y hace proxy al backend."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def do_GET(self):
        # Proxy peticiones al backend Django:
        # - /api/      → endpoints REST
        # - /media/    → archivos subidos por el cliente (logos de empresa,
        #                imágenes en PDFs, etc.). Sin este proxy, el frontend
        #                pide `/media/company/logo.jpg` al servidor estático
        #                y obtiene 404 — el logo nunca aparece.
        # - /static/   → estáticos de Django (admin, swagger en dev)
        if (self.path.startswith('/api/')
                or self.path.startswith('/media/')
                or self.path.startswith('/static/')):
            self._proxy_to_backend()
            return

        # Intentar servir archivo estático
        request_path = unquote(urlsplit(self.path).path)
        file_path = FRONTEND_DIR / request_path.lstrip('/')
        if not file_path.exists() or file_path.is_dir():
            # SPA fallback
            self.path = '/index.html'

        super().do_GET()

    def do_POST(self):
        self._proxy_to_backend()

    def do_PUT(self):
        self._proxy_to_backend()

    def do_PATCH(self):
        self._proxy_to_backend()

    def do_DELETE(self):
        self._proxy_to_backend()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()

    def _proxy_to_backend(self):
        import urllib.request

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length) if content_length > 0 else None

        url = f"http://127.0.0.1:{BACKEND_PORT}{self.path}"

        headers = {}
        for key in ['Content-Type', 'Authorization', 'Accept', 'Cookie']:
            val = self.headers.get(key)
            if val:
                headers[key] = val

        try:
            req = urllib.request.Request(url, data=body, headers=headers, method=self.command)
            with urllib.request.urlopen(req, timeout=120) as resp:
                self.send_response(resp.status)
                for key, val in resp.getheaders():
                    if key.lower() not in ('transfer-encoding', 'connection'):
                        self.send_header(key, val)
                self.end_headers()
                self.wfile.write(resp.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for key, val in e.headers.items():
                if key.lower() not in ('transfer-encoding', 'connection'):
                    self.send_header(key, val)
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def log_message(self, format, *args):
        pass  # Silenciar logs del servidor HTTP


def start_frontend_server():
    global frontend_server, FRONTEND_PORT
    FRONTEND_PORT = find_free_port(BACKEND_PORT + 1)
    frontend_server = HTTPServer(('127.0.0.1', FRONTEND_PORT), FrontendHandler)
    thread = threading.Thread(target=frontend_server.serve_forever, daemon=True)
    thread.start()
    log(f"Frontend sirviendo en http://127.0.0.1:{FRONTEND_PORT}")

# ── Cleanup ──────────────────────────────────────────────────────────────────
def cleanup():
    log("Cerrando CredCore...")
    if backend_process:
        try:
            backend_process.terminate()
            backend_process.wait(timeout=5)
        except:
            try:
                backend_process.kill()
            except:
                pass
    if frontend_server:
        frontend_server.shutdown()
    log("CredCore cerrado [OK]")

# ── Logo como data URI (para HTML embebido) ──────────────────────────────────
_LOGO_URI_CACHE = {}

def get_logo_data_uri():
    """Devuelve el logo oficial de CredCore como data URI para usar en el
    splash y la pantalla de activación."""
    if 'uri' in _LOGO_URI_CACHE:
        return _LOGO_URI_CACHE['uri']
    uri = ""
    try:
        import base64, io
        logo_png = BASE_DIR / "credi.png"
        if logo_png.exists():
            try:
                from PIL import Image
                img = Image.open(logo_png).convert("RGBA")
                w, h = img.size
                nw = 240
                nh = int(h * nw / w)
                img = img.resize((nw, nh), Image.LANCZOS)
                buf = io.BytesIO()
                img.save(buf, format="PNG", optimize=True)
                data = buf.getvalue()
            except Exception:
                # Sin PIL: usar el PNG original directamente
                data = logo_png.read_bytes()
            uri = "data:image/png;base64," + base64.b64encode(data).decode()
    except Exception as e:
        log(f"No se pudo cargar el logo para el splash: {e}")
    _LOGO_URI_CACHE['uri'] = uri
    return uri


# ── Splash Screen HTML ───────────────────────────────────────────────────────
SPLASH_HTML = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    overflow: hidden;
  }
  .container { text-align: center; }
  .logo-box {
    width: 200px; padding: 20px 24px;
    background: #ffffff;
    border-radius: 22px;
    margin: 0 auto 26px;
    box-shadow: 0 8px 32px rgba(59,130,246,0.35);
    animation: pulse 2s ease-in-out infinite;
  }
  .logo-box img { width: 100%; display: block; }
  @keyframes pulse {
    0%, 100% { transform: scale(1); box-shadow: 0 8px 32px rgba(59,130,246,0.35); }
    50% { transform: scale(1.04); box-shadow: 0 12px 48px rgba(59,130,246,0.55); }
  }
  h1 { font-size: 32px; margin-bottom: 8px; letter-spacing: 2px; }
  .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 32px; }
  .progress-container {
    width: 320px; height: 6px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px;
    margin: 0 auto 16px;
    overflow: hidden;
  }
  .progress-bar {
    height: 100%; width: 30%;
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    border-radius: 3px;
    animation: loading 1.5s ease-in-out infinite;
  }
  @keyframes loading {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(433%); }
  }
  .status { color: #64748b; font-size: 13px; }
  .status span { color: #94a3b8; }
  .version { position: fixed; bottom: 16px; right: 20px; color: #475569; font-size: 11px; }
  .dev { position: fixed; bottom: 16px; left: 20px; color: #475569; font-size: 11px; }
</style>
</head>
<body>
  <div class="container">
    <div class="logo-box"><img src="__LOGO_URI__" alt="CredCore"></div>
    <p class="subtitle">Sistema Profesional de Gestion de Creditos</p>
    <div class="progress-container"><div class="progress-bar"></div></div>
    <p class="status" id="status">Iniciando sistema<span>...</span></p>
  </div>
  <div class="version">v""" + APP_VERSION + """</div>
  <div class="dev">Ronny Sandoval</div>
  <script>
    const msgs = [
      'Iniciando sistema...', 'Conectando base de datos...',
      'Ejecutando migraciones...', 'Cargando modulos...',
      'Preparando interfaz...', 'Casi listo...'
    ];
    let i = 0;
    setInterval(() => {
      if (i < msgs.length) document.getElementById('status').textContent = msgs[i++];
    }, 4000);
  </script>
</body>
</html>
"""

# ── Window Icon (Windows) ────────────────────────────────────────────────────
def set_window_icon(window_title, icon_path, retries=30):
    """Establece el ícono de la ventana (barra de título Y barra de tareas).

    Usa WM_SETICON (título/Alt-Tab) y SetClassLongPtr con GCLP_HICON
    (barra de tareas) para asegurar que el ícono de CredCore aparezca en
    todos lados, no el de Python.
    """
    if sys.platform != 'win32' or not os.path.exists(icon_path):
        return
    import ctypes
    from ctypes import wintypes
    WM_SETICON = 0x0080
    ICON_SMALL, ICON_BIG = 0, 1
    IMAGE_ICON = 1
    LR_LOADFROMFILE = 0x00000010
    GCLP_HICON = -14
    GCLP_HICONSM = -34
    user32 = ctypes.windll.user32

    # SetClassLongPtr: usar la versión correcta según arquitectura
    if hasattr(user32, 'SetClassLongPtrW'):
        set_class_long = user32.SetClassLongPtrW
    else:
        set_class_long = user32.SetClassLongW

    for _ in range(retries):
        hwnd = user32.FindWindowW(None, window_title)
        if hwnd:
            try:
                hicon_big = user32.LoadImageW(0, str(icon_path), IMAGE_ICON, 256, 256, LR_LOADFROMFILE)
                hicon_small = user32.LoadImageW(0, str(icon_path), IMAGE_ICON, 32, 32, LR_LOADFROMFILE)
                # Ícono de la ventana (barra de título, Alt-Tab)
                if hicon_big:
                    user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG, hicon_big)
                if hicon_small:
                    user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, hicon_small)
                # Ícono de la CLASE de ventana (barra de tareas)
                try:
                    if hicon_big:
                        set_class_long(hwnd, GCLP_HICON, hicon_big)
                    if hicon_small:
                        set_class_long(hwnd, GCLP_HICONSM, hicon_small)
                except Exception:
                    pass
                log("Icono de ventana y barra de tareas establecido [OK]")
                return
            except Exception as e:
                log(f"Error estableciendo icono: {e}")
                return
        time.sleep(0.5)


# ── Pantalla de Activación (Licencia) ────────────────────────────────────────
ACTIVATION_HTML = """
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, sans-serif;
    background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%);
    color: white; height: 100vh; display: flex; align-items: center;
    justify-content: center; overflow: hidden;
  }
  .card {
    background: rgba(30,41,59,0.7); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px; padding: 32px 36px; width: 480px; text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  .logo-box {
    width: 150px; padding: 14px 16px; background: #ffffff; border-radius: 16px;
    margin: 0 auto 18px; box-shadow: 0 8px 24px rgba(59,130,246,0.35);
  }
  .logo-box img { width: 100%; display: block; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #94a3b8; font-size: 13px; margin-bottom: 22px; }
  .mid-label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .mid {
    background: #0f172a; border: 1px dashed #334155; border-radius: 10px;
    padding: 10px; font-family: Consolas, monospace; font-size: 18px;
    color: #22d3ee; letter-spacing: 2px; margin-bottom: 6px; user-select: all;
  }
  .hint { color: #64748b; font-size: 11px; margin-bottom: 18px; }
  textarea {
    width: 100%; height: 80px; background: #0f172a; border: 1px solid #334155;
    border-radius: 10px; padding: 10px; color: #4ade80; font-family: Consolas, monospace;
    font-size: 11px; resize: none; outline: none;
  }
  textarea:focus { border-color: #3b82f6; }
  .lbl { text-align: left; color: #cbd5e1; font-size: 12px; font-weight: 600; margin: 14px 0 6px; }
  button {
    width: 100%; margin-top: 18px; padding: 12px; border: none; border-radius: 10px;
    background: linear-gradient(135deg,#3b82f6,#1d4ed8); color: white;
    font-size: 15px; font-weight: 600; cursor: pointer; transition: opacity .2s;
  }
  button:hover { opacity: .9; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  .msg { margin-top: 14px; font-size: 13px; min-height: 18px; }
  .msg.error { color: #f87171; }
  .msg.success { color: #4ade80; }
  .copy-btn {
    background: #334155; border: none; color: #cbd5e1; font-size: 11px;
    padding: 4px 10px; border-radius: 6px; cursor: pointer; width: auto; margin: 0 0 18px;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="logo-box"><img src="__LOGO_URI__" alt="CredCore"></div>
    <h1>Activar CredCore</h1>
    <p class="sub">Esta copia requiere una licencia para esta computadora</p>

    <div class="mid-label">ID de esta Máquina</div>
    <div class="mid" id="machineId">Cargando...</div>
    <button class="copy-btn" onclick="copyId()">Copiar ID</button>
    <p class="hint">Envíe este ID al proveedor para obtener su clave de licencia</p>

    <div class="lbl">Clave de Licencia</div>
    <textarea id="key" placeholder="Pegue aquí la clave de licencia..."></textarea>

    <button id="btn" onclick="activate()">Activar Sistema</button>
    <div class="msg" id="msg"></div>
  </div>

  <script>
    let machineId = '';
    function waitApi(cb){ if(window.pywebview && window.pywebview.api){cb()} else {setTimeout(()=>waitApi(cb),100)} }
    waitApi(() => {
      window.pywebview.api.get_machine_id().then(id => {
        machineId = id; document.getElementById('machineId').textContent = id;
      });
    });
    function copyId(){ navigator.clipboard.writeText(machineId); }
    function activate(){
      const key = document.getElementById('key').value.trim();
      const msg = document.getElementById('msg');
      const btn = document.getElementById('btn');
      if(!key){ msg.className='msg error'; msg.textContent='Ingrese la clave de licencia.'; return; }
      btn.disabled = true; btn.textContent = 'Verificando...';
      msg.className='msg'; msg.textContent='';
      window.pywebview.api.activate(key).then(res => {
        if(res.ok){
          msg.className='msg success'; msg.textContent='✓ ' + res.message + ' Iniciando...';
          window.pywebview.api.proceed();
        } else {
          msg.className='msg error'; msg.textContent='✗ ' + res.message;
          btn.disabled = false; btn.textContent = 'Activar Sistema';
        }
      });
    }
  </script>
</body>
</html>
"""


class ActivationAPI:
    """API expuesta a la ventana de activación (JS ↔ Python)."""

    def __init__(self, on_activated):
        self._on_activated = on_activated
        self._started = False

    def get_machine_id(self):
        import licensing
        return licensing.get_machine_id()

    def activate(self, key):
        import licensing
        ok, msg = licensing.activate(key)
        if ok:
            log("Licencia activada correctamente")
        return {"ok": ok, "message": msg}

    def proceed(self):
        if not self._started:
            self._started = True
            self._on_activated()
        return True


class DesktopAPI:
    """API nativa expuesta al frontend (window.pywebview.api).

    Resuelve las descargas: en WebView2 el patrón de navegador
    (blob URL + <a download>) no guarda archivos. Aquí el frontend nos
    envía el archivo en base64 y mostramos un diálogo nativo 'Guardar como'.
    """

    def save_file(self, filename, base64_data):
        import webview
        import base64 as _b64
        try:
            window = webview.active_window()
            if window is None and webview.windows:
                window = webview.windows[-1]

            result = window.create_file_dialog(
                webview.SAVE_DIALOG,
                save_filename=filename or 'archivo',
            )
            if not result:
                return {"ok": False, "cancelled": True}
            path = result if isinstance(result, str) else result[0]

            # Aceptar tanto "data:...;base64,XXX" como "XXX"
            if isinstance(base64_data, str) and ',' in base64_data[:64]:
                base64_data = base64_data.split(',', 1)[1]
            data = _b64.b64decode(base64_data)
            with open(path, 'wb') as f:
                f.write(data)
            log(f"Archivo guardado: {path} ({len(data)} bytes)")
            return {"ok": True, "path": path}
        except Exception as e:
            log(f"Error guardando archivo: {e}")
            return {"ok": False, "error": str(e)}

    def ping(self):
        """Permite al frontend detectar que está en modo escritorio."""
        return {"desktop": True, "version": APP_VERSION}

    def browse_folder(self):
        """Abre el diálogo nativo de Windows para seleccionar una carpeta.

        Usado por la pantalla de Configuración → Respaldos: el usuario hace
        clic en "Examinar" y elige visualmente la carpeta destino (típicamente
        una subcarpeta de su Google Drive Desktop o OneDrive).
        Devuelve la ruta absoluta seleccionada, o cadena vacía si canceló.
        """
        import webview
        try:
            window = webview.active_window() or webview.windows[-1]
            result = window.create_file_dialog(webview.FOLDER_DIALOG)
            if not result:
                return ""
            return result if isinstance(result, str) else result[0]
        except Exception as e:
            log(f"Error abriendo diálogo de carpeta: {e}")
            return ""


def set_app_user_model_id():
    """Establece el AppUserModelID al inicio para que Windows trate a CredCore
    como una app independiente en la barra de tareas (con su propio ícono y
    agrupación), en vez de agruparlo bajo Python."""
    if sys.platform != 'win32':
        return
    try:
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("CredCore.Sistema.Creditos.1.0")
    except Exception:
        pass


# ── Modo administración (manage.py) ─────────────────────────────────────────
def run_django_command():
    """Ejecuta un comando de Django cuando el .exe es invocado como:

        CredCore.exe <ruta>\\manage.py <comando> [argumentos...]

    Imprescindible en el ejecutable congelado: ahí sys.executable ES
    CredCore.exe, de modo que los subprocesos que lanza start_backend()
    re-ejecutan este mismo .exe. Sin este despachador cada subproceso abría
    otra copia completa de la GUI, que a su vez lanzaba más subprocesos:
    explosión infinita de ventanas y congelamiento al activar la licencia.
    """
    backend_dir = str(BACKEND_DIR)
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
    from django.core.management import execute_from_command_line
    # argv[0] (el .exe) se descarta; Django espera argv desde manage.py
    execute_from_command_line(sys.argv[1:])


def consume_pending_activation():
    """Activa la clave que el instalador dejó en pending_activation.key.

    El instalador (Inno Setup) pide la clave durante la instalación y la guarda
    en ProgramData\\CredCore. Aquí la procesamos en el primer arranque para que
    el cliente no tenga que ingresarla dos veces.
    """
    import licensing
    candidates = []
    program_data = os.environ.get('PROGRAMDATA')
    if program_data:
        candidates.append(Path(program_data) / "CredCore" / "pending_activation.key")
    candidates.append(DATA_DIR / "pending_activation.key")

    for key_file in candidates:
        try:
            if not key_file.exists():
                continue
            if not licensing.is_activated():
                key = key_file.read_text(encoding="utf-8", errors="replace").strip()
                if key:
                    ok, msg = licensing.activate(key)
                    log(f"Activación automática (clave del instalador): {msg if not ok else 'OK'}")
            try:
                key_file.unlink()
            except Exception:
                pass  # sin permiso para borrar en ProgramData: no es crítico
        except Exception as e:
            log(f"Error procesando activación pendiente: {e}")


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    import webview
    import atexit
    atexit.register(cleanup)

    # Identidad de la app para la barra de tareas (antes de crear ventanas)
    set_app_user_model_id()

    log(f"=== CredCore Desktop v{APP_VERSION} ===")
    log(f"Data: {DATA_DIR}")
    log(f"DB: {DB_PATH}")

    # Holder para la ventana de arranque (splash o activación) que se cierra
    # cuando la ventana principal está lista.
    boot = {'win': None}

    def _destroy_boot():
        try:
            if boot['win']:
                boot['win'].destroy()
        except Exception:
            pass

    def on_loaded():
        """Se ejecuta en background: inicia backend y cuando está listo, abre la app."""
        try:
            if not start_backend():
                log("ERROR: No se pudo iniciar el backend")
                _destroy_boot()
                return

            start_frontend_server()

            log("Abriendo ventana principal...")

            # Crear la ventana principal (con API nativa para descargas)
            main_win = webview.create_window(
                title=f"{APP_NAME} -- Sistema de Gestion de Creditos",
                url=f"http://127.0.0.1:{FRONTEND_PORT}",
                width=1400,
                height=900,
                min_size=(1024, 700),
                text_select=True,
                confirm_close=True,
                zoomable=True,
                js_api=DesktopAPI(),
            )

            # Inyectar zoom con Ctrl+Rueda del mouse después de cargar
            def inject_zoom(window):
                """Inyecta soporte de zoom con Ctrl+Rueda y Ctrl+/Ctrl-"""
                time.sleep(2)
                try:
                    window.evaluate_js("""
                    (function() {
                        if (window.__zoomInjected) return;
                        window.__zoomInjected = true;
                        let zoomLevel = 100;
                        const MIN_ZOOM = 50;
                        const MAX_ZOOM = 200;
                        const STEP = 10;

                        function applyZoom(level) {
                            zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, level));
                            document.body.style.zoom = (zoomLevel / 100).toString();
                            // Show zoom indicator briefly
                            let indicator = document.getElementById('__zoom-indicator');
                            if (!indicator) {
                                indicator = document.createElement('div');
                                indicator.id = '__zoom-indicator';
                                indicator.style.cssText = 'position:fixed;bottom:20px;right:20px;background:rgba(0,0,0,0.8);color:white;padding:8px 16px;border-radius:8px;font-size:14px;font-family:sans-serif;z-index:99999;transition:opacity 0.3s;pointer-events:none;';
                                document.body.appendChild(indicator);
                            }
                            indicator.textContent = 'Zoom: ' + zoomLevel + '%';
                            indicator.style.opacity = '1';
                            clearTimeout(indicator.__timer);
                            indicator.__timer = setTimeout(() => { indicator.style.opacity = '0'; }, 1500);
                        }

                        // Ctrl + Mouse Wheel
                        window.addEventListener('wheel', function(e) {
                            if (e.ctrlKey) {
                                e.preventDefault();
                                e.stopPropagation();
                                if (e.deltaY < 0) applyZoom(zoomLevel + STEP);
                                else applyZoom(zoomLevel - STEP);
                            }
                        }, { passive: false, capture: true });

                        // Ctrl+Plus / Ctrl+Minus / Ctrl+0
                        window.addEventListener('keydown', function(e) {
                            if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
                                e.preventDefault(); applyZoom(zoomLevel + STEP);
                            } else if (e.ctrlKey && e.key === '-') {
                                e.preventDefault(); applyZoom(zoomLevel - STEP);
                            } else if (e.ctrlKey && e.key === '0') {
                                e.preventDefault(); applyZoom(100);
                            }
                        }, true);
                    })();
                    """)
                    log("Zoom habilitado (Ctrl+Rueda, Ctrl+/-, Ctrl+0)")
                except Exception as e:
                    log(f"Error inyectando zoom: {e}")

            threading.Thread(target=inject_zoom, args=(main_win,), daemon=True).start()

            # Establecer ícono de la ventana (logo CredCore en vez del de Python)
            main_title = f"{APP_NAME} -- Sistema de Gestion de Creditos"
            threading.Thread(target=set_window_icon, args=(main_title, ICON_PATH), daemon=True).start()

            # Cerrar splash / activación
            time.sleep(1)
            _destroy_boot()

        except Exception as e:
            log(f"Error en carga: {e}")
            _destroy_boot()

    def start_loading():
        threading.Thread(target=on_loaded, daemon=True).start()

    # Logo oficial para las pantallas de arranque
    logo_uri = get_logo_data_uri()

    # ── Verificación de Licencia / Activación ────────────────────────────────
    consume_pending_activation()
    import licensing
    if licensing.is_activated():
        info = licensing.get_license_info()
        log(f"Licencia activa: {info.get('customer', 'N/A')} (máquina {info.get('machine', '')})")
        # Mostrar splash y arrancar normalmente
        boot['win'] = webview.create_window(
            title='CredCore - Cargando...',
            html=SPLASH_HTML.replace('__LOGO_URI__', logo_uri),
            width=500, height=420,
            resizable=False, frameless=True, on_top=True,
        )
        start_loading()
    else:
        log("Sin licencia activa — mostrando pantalla de activación")
        act_api = ActivationAPI(start_loading)
        boot['win'] = webview.create_window(
            title='CredCore - Activación de Licencia',
            html=ACTIVATION_HTML.replace('__LOGO_URI__', logo_uri),
            width=540, height=680,
            resizable=False,
            js_api=act_api,
        )
        # Aplicar ícono también a la ventana de activación
        threading.Thread(
            target=set_window_icon,
            args=('CredCore - Activación de Licencia', ICON_PATH),
            daemon=True,
        ).start()

    # Iniciar GUI (bloquea hasta que se cierren todas las ventanas)
    _start_kwargs = dict(debug=False, gui='edgechromium')
    if os.path.exists(ICON_PATH):
        _start_kwargs['icon'] = str(ICON_PATH)
    try:
        webview.start(**_start_kwargs)
    except (TypeError, Exception):
        # Algunas versiones/backends no soportan 'icon' en start()
        webview.start(debug=False, gui='edgechromium')

    cleanup()


if __name__ == "__main__":
    import multiprocessing
    multiprocessing.freeze_support()

    # Despachador: si el .exe congelado se invoca con "manage.py ..." es un
    # subproceso del backend — ejecutar el comando Django, NUNCA la GUI.
    if (
        getattr(sys, 'frozen', False)
        and len(sys.argv) > 1
        and sys.argv[1].lower().endswith('manage.py')
    ):
        run_django_command()
        sys.exit(0)

    main()
