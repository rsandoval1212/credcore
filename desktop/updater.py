"""
CredCore Desktop — Verificador de actualizaciones
=================================================

Consulta un JSON remoto del DUEÑO del software para saber si hay una versión
más reciente. Diseño:

- El JSON vive en una URL estable controlada por el dueño (recomendado:
  GitHub Gist público o GitHub Pages — gratis y simple de actualizar).
- Formato del JSON:
  {
    "version": "1.0.1",                  ← versión más reciente disponible
    "download_url": "https://...setup.exe",   ← URL del instalador
    "notes": "Corrige X, agrega Y",      ← qué incluye la actualización (texto)
    "mandatory": false                   ← (opcional) si se debe forzar
  }
- La app la consulta al arrancar. Si la versión remota > versión local,
  muestra un banner con el botón "Descargar actualización".
- NUNCA descarga ni ejecuta nada automáticamente: el cliente da clic, abre el
  navegador, baja el setup firmado y lo corre con sus permisos. Es la opción
  más segura (no necesita admin elevation desde la app).

Configuración:
- `%APPDATA%\\CredCore\\update_url.txt`  →  URL del JSON remoto.
- Si el archivo no existe, simplemente no verifica.
"""
import os
import json
import urllib.request
from pathlib import Path


def _data_dir() -> Path:
    return Path(os.environ.get("APPDATA", str(Path.home()))) / "CredCore"


def _get_update_url() -> str | None:
    f = _data_dir() / "update_url.txt"
    if not f.exists():
        return None
    try:
        url = f.read_text(encoding="utf-8-sig").strip()
        # Tolerar caracteres invisibles que se cuelan en editores
        for ch in ("​", "﻿", "\r", "\n", "\t"):
            url = url.replace(ch, "")
        return url or None
    except Exception:
        return None


def _parse_version(v: str) -> tuple:
    """Convierte '1.0.10' → (1, 0, 10) para comparar versiones correctamente.

    Comparar como string da resultados incorrectos: "1.0.10" < "1.0.2" en
    orden alfabético, lo cual es absurdo para versiones.
    """
    try:
        parts = v.strip().lstrip("vV").split(".")
        return tuple(int(p) for p in parts[:3])
    except Exception:
        return (0, 0, 0)


def check_for_update(current_version: str, timeout: int = 4) -> dict | None:
    """Verifica si hay actualización disponible.

    Devuelve dict {version, download_url, notes, mandatory} si hay una versión
    más reciente, o None en cualquier otro caso (sin URL configurada, sin
    internet, JSON malformado, ya en última versión). NUNCA lanza excepción —
    no debe interferir con el arranque de la app.
    """
    url = _get_update_url()
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CredCore-Updater"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            # utf-8-sig descarta el BOM automáticamente. GitHub Raw a veces
            # sirve archivos con BOM (lo agrega git o el editor que los creó)
            # y `json.loads` no acepta BOM al inicio.
            raw = resp.read().decode("utf-8-sig").lstrip("﻿").strip()
            data = json.loads(raw)
    except Exception:
        return None

    remote = (data.get("version") or "").strip()
    download = (data.get("download_url") or "").strip()
    if not remote or not download:
        return None

    if _parse_version(remote) <= _parse_version(current_version):
        return None  # ya tiene la última o más nueva

    return {
        "version": remote,
        "download_url": download,
        "notes": data.get("notes", ""),
        "mandatory": bool(data.get("mandatory", False)),
    }


if __name__ == "__main__":
    # Diagnóstico: muestra estado y simula con una versión vieja.
    import sys
    cur = sys.argv[1] if len(sys.argv) > 1 else "1.0.0"
    print(f"URL configurada: {_get_update_url() or '(ninguna)'}")
    print(f"Versión actual:  {cur}")
    info = check_for_update(cur)
    if info:
        print(f"Hay actualización: v{info['version']}")
        print(f"  URL:   {info['download_url']}")
        print(f"  Notas: {info['notes']}")
        print(f"  Forzosa: {info['mandatory']}")
    else:
        print("Sin actualización disponible (o sin URL configurada).")
