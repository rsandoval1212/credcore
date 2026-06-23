"""
CredCore Desktop — Subida automática de respaldos a Google Drive
================================================================

Diseño (multi-cliente, dueño-administra-todo):
- TÚ (dueño del software) creas UNA cuenta de servicio en Google Cloud.
- TÚ tienes UNA carpeta principal en tu Drive: `CredCore-Backups/`.
- Para cada cliente: TÚ creas una subcarpeta `CredCore-Backups/<Cliente>/`
  y la compartes con la cuenta de servicio (botón "Compartir" → pegar el
  email de la cuenta).
- En la instalación del cliente:
    * `service_account.json`  → credenciales de TU cuenta de servicio
                                 (mismo archivo para todos los clientes).
    * `drive_folder_id.txt`   → ID de la carpeta de ESE cliente.
- El sistema sube los respaldos cifrados a esa carpeta.
- TÚ ves todo desde tu Drive. El cliente no tiene acceso a Drive — solo ve
  "respaldo subido" en el log de la app.

Si las credenciales o el ID no están configurados, la función `upload_backup`
no hace nada (solo registra el motivo). El respaldo local nunca depende de Drive.

Cómo crear la cuenta de servicio (ejecutar UNA vez):
    1. https://console.cloud.google.com → Crear proyecto (gratis).
    2. APIs y servicios → Biblioteca → habilitar "Google Drive API".
    3. APIs y servicios → Credenciales → Crear → Cuenta de servicio.
    4. Detalles → Claves → Agregar clave → JSON → descargar.
    5. Renombrar a `service_account.json` y empaquetarlo con el instalador
       (o copiarlo a `%APPDATA%\\CredCore\\` en cada cliente).
    6. En el Drive del DUEÑO: crear carpeta principal y subcarpetas por cliente;
       compartir cada subcarpeta con el email "...@...iam.gserviceaccount.com"
       de la cuenta de servicio (rol: Editor).
    7. Copiar el ID de la URL de la carpeta del cliente y pegarlo en
       `%APPDATA%\\CredCore\\drive_folder_id.txt`.
"""
import os
import json
import datetime as _dt
from pathlib import Path


def _network_time_offset_seconds() -> float:
    """Mide cuánto está desfasado el reloj local respecto a un servidor real.

    Devuelve `(hora_real - hora_local)` en segundos. Si no puede obtenerlo,
    devuelve 0 (no aplica ajuste). Útil para PCs cliente con relojes mal
    sincronizados: Google rechaza JWTs con >5 min de desfase. Este offset se
    aplica al token sin tocar el reloj del sistema.

    Pide hora a Google (en lugar de NTP) porque Drive y NTP usan puertos
    distintos; si Drive funciona, esta llamada también funciona.
    """
    try:
        import urllib.request
        req = urllib.request.Request("https://www.google.com", method="HEAD")
        with urllib.request.urlopen(req, timeout=4) as resp:
            date_hdr = resp.headers.get("Date")
        if not date_hdr:
            return 0.0
        # Formato RFC 1123: "Fri, 13 Jun 2026 13:40:17 GMT"
        from email.utils import parsedate_to_datetime
        real = parsedate_to_datetime(date_hdr)
        local = _dt.datetime.now(_dt.timezone.utc)
        return (real - local).total_seconds()
    except Exception:
        return 0.0


def _data_dir() -> Path:
    return Path(os.environ.get("APPDATA", str(Path.home()))) / "CredCore"


def _service_account_path() -> Path | None:
    """Localiza el JSON de la cuenta de servicio.

    Prioridad: APPDATA\\CredCore\\service_account.json → junto al exe.
    Permite que el instalador lo coloque automáticamente o que el dueño lo
    copie manualmente a APPDATA en la PC del cliente.
    """
    candidates = [
        _data_dir() / "service_account.json",
        Path(os.path.dirname(os.path.abspath(__file__))) / "service_account.json",
    ]
    for p in candidates:
        if p.exists():
            return p
    return None


def _folder_id() -> str | None:
    """Lee el ID de la carpeta del cliente en Drive. None si no está configurado.

    Tolerante a BOM y caracteres invisibles: si el archivo se guardó con un
    editor que agrega BOM (UTF-8-SIG), zero-width space u otros, los limpiamos.
    Google rechaza el ID al menor caracter extra.
    """
    f = _data_dir() / "drive_folder_id.txt"
    if not f.exists():
        return None
    try:
        # utf-8-sig descarta BOM automáticamente
        fid = f.read_text(encoding="utf-8-sig").strip()
        # Quitar otros caracteres invisibles comunes (zero-width, NBSP, etc.)
        for ch in ("﻿", "​", "‌", "‍", " ", "\r", "\n", "\t"):
            fid = fid.replace(ch, "")
        # Aceptar tanto el ID puro como una URL completa de Drive
        if "drive.google.com" in fid and "/folders/" in fid:
            fid = fid.split("/folders/")[1].split("?")[0].split("/")[0]
        return fid or None
    except Exception:
        return None


def is_configured() -> tuple[bool, str]:
    """Devuelve (configurado, mensaje). Útil para mostrar estado al dueño."""
    sa = _service_account_path()
    fid = _folder_id()
    if not sa:
        return False, "Falta service_account.json (no se enviarán respaldos a Drive)"
    if not fid:
        return False, "Falta drive_folder_id.txt con el ID de carpeta del cliente"
    return True, f"Configurado: carpeta {fid[:12]}..."


def upload_backup(local_path: str | os.PathLike) -> tuple[bool, str]:
    """Sube un respaldo a la carpeta de Drive del cliente.

    Devuelve (ok, mensaje). NUNCA lanza excepción — la app debe seguir
    funcionando aunque Drive falle, porque el respaldo local SÍ existe.
    """
    local = Path(local_path)
    if not local.exists():
        return False, f"Archivo no existe: {local}"

    sa = _service_account_path()
    fid = _folder_id()
    if not sa:
        return False, "Cuenta de servicio no configurada — omitiendo subida a Drive"
    if not fid:
        return False, "ID de carpeta de Drive no configurado — omitiendo subida"

    try:
        # Importes locales: las librerías de Google son OPCIONALES.
        # Si no están instaladas/empaquetadas, la app sigue sin Drive.
        from google.oauth2 import service_account  # type: ignore
        from googleapiclient.discovery import build  # type: ignore
        from googleapiclient.http import MediaFileUpload  # type: ignore
    except ImportError:
        return False, ("Librerías de Google Drive no instaladas. "
                       "Instalar: google-api-python-client google-auth")

    # Robustez contra relojes mal sincronizados (PCs cliente con reloj
    # adelantado/atrasado): google-auth firma el JWT usando `_helpers.utcnow()`.
    # Si el reloj local está mal por >5 min, Google rechaza el token.
    # Detectamos el desfase con un HEAD a google.com y parcheamos utcnow()
    # SOLO durante esta subida (restauramos al salir, no afecta nada más).
    offset_seconds = _network_time_offset_seconds()
    patched = False
    try:
        if abs(offset_seconds) > 60:  # solo si el desfase es importante
            try:
                from google.auth import _helpers as _gauth_helpers  # type: ignore
                _orig_utcnow = _gauth_helpers.utcnow
                _delta = _dt.timedelta(seconds=offset_seconds)
                def _utcnow_patched(_orig=_orig_utcnow, _d=_delta):
                    return _orig() + _d
                _gauth_helpers.utcnow = _utcnow_patched
                patched = True
            except Exception:
                pass

        try:
            creds = service_account.Credentials.from_service_account_file(
                str(sa), scopes=["https://www.googleapis.com/auth/drive.file"]
            )
            service = build("drive", "v3", credentials=creds, cache_discovery=False)
            media = MediaFileUpload(str(local), resumable=False)
            metadata = {"name": local.name, "parents": [fid]}
            # supportsAllDrives=True: las cuentas de servicio no tienen su
            # propio "Mi unidad", así que el archivo se crea bajo la carpeta
            # del USUARIO (el dueño que la compartió). Sin esto: 403 "Service
            # Accounts do not have storage quota".
            f = service.files().create(
                body=metadata, media_body=media,
                fields="id,name,size",
                supportsAllDrives=True,
            ).execute()
            suffix = f" (reloj ajustado {int(offset_seconds)}s)" if patched else ""
            return True, f"Subido a Drive: {f.get('name')} (id={f.get('id')}){suffix}"
        except Exception as e:
            msg = str(e)
            if len(msg) > 200:
                msg = msg[:200] + "..."
            return False, f"Error subiendo a Drive: {msg}"
    finally:
        if patched:
            try:
                _gauth_helpers.utcnow = _orig_utcnow  # type: ignore[name-defined]
            except Exception:
                pass


if __name__ == "__main__":
    # Diagnóstico: muestra el estado de configuración y, si hay argumento, sube.
    ok, msg = is_configured()
    print(f"Configuracion: {msg}")
    import sys
    if len(sys.argv) > 1:
        ok, msg = upload_backup(sys.argv[1])
        print(f"Resultado subida: {msg}")
