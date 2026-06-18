"""Copia de respaldos a destinos externos (USB, Drive Desktop, OneDrive, red).

Módulo compartido: lo usa tanto el respaldo automático del exe al arrancar
(`credcore_app.py`) como el respaldo manual de la UI (`BackupRunView`).
Sin esto, hacer clic en "Crear Copia de Seguridad" creaba un respaldo local
pero NO lo enviaba al destino externo configurado.

Lee `%APPDATA%\\CredCore\\external_backup_path.txt`. Una ruta por línea:
  • `usb:LABEL[\\subcarpeta]`  →  USB detectada por etiqueta de volumen
  • Ruta absoluta             →  carpeta directa (Drive Desktop, OneDrive...)
"""
import os
import sys
import shutil
from pathlib import Path
from datetime import datetime


def _data_dir() -> Path:
    """Carpeta de configuración (`%APPDATA%\\CredCore`) — la misma para Django y exe.

    Django recibe `BACKUPS_DIR` por env desde el exe; su padre es el data dir.
    """
    backups_env = os.environ.get('BACKUPS_DIR', '').strip()
    if backups_env:
        return Path(backups_env).parent
    return Path(os.environ.get('APPDATA', str(Path.home()))) / "CredCore"


def _find_drive_by_label(label: str) -> Path | None:
    """Busca una unidad por etiqueta de volumen (no por letra que cambia)."""
    if sys.platform != "win32" or not label:
        return None
    target = label.strip().upper()
    try:
        import ctypes
        GetVolumeInformationW = ctypes.windll.kernel32.GetVolumeInformationW
        for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
            root = f"{letter}:\\"
            if not Path(root).exists():
                continue
            vol = ctypes.create_unicode_buffer(261)
            fs = ctypes.create_unicode_buffer(261)
            if GetVolumeInformationW(root, vol, 261, None, None, None, fs, 261):
                if vol.value.strip().upper() == target:
                    return Path(root)
    except Exception:
        pass
    return None


def _resolve_destination(line: str) -> Path | None:
    """Convierte una línea del archivo de config en la ruta destino actual."""
    line = line.strip()
    if not line:
        return None
    if line.lower().startswith("usb:"):
        rest = line[4:].lstrip("\\/")
        parts = rest.replace("/", "\\").split("\\", 1)
        label = parts[0]
        subpath = parts[1] if len(parts) > 1 else ""
        root = _find_drive_by_label(label)
        if not root:
            return None  # USB no conectada
        return root / subpath if subpath else root
    return Path(line)


def _read_destinations() -> list[str]:
    """Lee las líneas válidas (no vacías ni comentadas) del archivo de config."""
    config = _data_dir() / "external_backup_path.txt"
    if not config.exists():
        return []
    try:
        raw = config.read_text(encoding="utf-8-sig")
    except Exception:
        return []
    out = []
    for line in raw.splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            out.append(line)
    return out


def mirror_backup_to_destinations(backup_path) -> dict:
    """Copia el archivo de respaldo a TODOS los destinos externos configurados.

    Estructura final: `<destino>/YYYY/MM/<nombre>`. Un destino que falle
    (USB desconectada, carpeta inaccesible) NUNCA detiene a los demás.

    Devuelve dict con conteo y detalle por destino, útil para logging y para
    devolver al frontend en la respuesta del POST "crear respaldo manual".
    """
    backup_path = Path(backup_path)
    destinations = _read_destinations()
    if not destinations:
        return {'configured': 0, 'ok': 0, 'failed': 0, 'results': []}

    if not backup_path.exists():
        return {
            'configured': len(destinations), 'ok': 0, 'failed': len(destinations),
            'results': [{'destination': d, 'ok': False,
                         'message': f"archivo origen no existe: {backup_path}"}
                        for d in destinations],
        }

    now = datetime.now()
    results = []
    ok_count = 0
    for raw in destinations:
        try:
            external = _resolve_destination(raw)
            if external is None:
                results.append({'destination': raw, 'ok': False,
                                'message': "destino no accesible (¿USB desconectada?)"})
                continue
            dest_dir = external / f"{now.year:04d}" / f"{now.month:02d}"
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / backup_path.name
            shutil.copy2(backup_path, dest)
            results.append({'destination': raw, 'ok': True,
                            'path': str(dest), 'message': f"copiado a {dest}"})
            ok_count += 1
        except Exception as e:
            results.append({'destination': raw, 'ok': False,
                            'message': f"error: {e}"})

    return {
        'configured': len(destinations),
        'ok': ok_count,
        'failed': len(destinations) - ok_count,
        'results': results,
    }
