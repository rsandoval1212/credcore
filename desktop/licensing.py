"""
CredCore — Sistema de Licencias / Activación
============================================

Protección anti-piratería basada en firma criptográfica Ed25519.

- La app embebe ÚNICAMENTE la clave PÚBLICA (no se pueden falsificar licencias
  aunque alguien desarme el ejecutable).
- El vendedor genera licencias con `license_generator.py` (que tiene la clave
  PRIVADA, y NUNCA se distribuye al cliente).
- Cada licencia está vinculada al ID de hardware de la máquina: una clave
  generada para una PC no funciona en otra.

Flujo:
1. Primer arranque → la app muestra el ID de Máquina.
2. El vendedor introduce ese ID en su generador → obtiene una clave.
3. El cliente/vendedor pega la clave en la pantalla de activación.
4. La app verifica la firma + que el ID coincida → activa y guarda license.dat.
"""
import os
import sys
import json
import base64
import hashlib
import subprocess
from functools import lru_cache
from pathlib import Path
from datetime import datetime

# ── Clave PÚBLICA embebida (la privada vive solo en el generador) ─────────────
PUBLIC_KEY_B64 = "NRg0Vrf0NQPbOmWyFJ/AujzZ1f62FCB0YsfJdOn9kBM="

# ── Ubicación del archivo de activación ───────────────────────────────────────
DATA_DIR = Path(os.environ.get('APPDATA', Path.home())) / "CredCore"
LICENSE_FILE = DATA_DIR / "license.dat"


# ── ID de Máquina (huella de hardware estable) ────────────────────────────────
@lru_cache(maxsize=1)
def get_machine_id() -> str:
    """Genera un ID corto y estable basado en el hardware de la máquina.

    Usa principalmente el MachineGuid de Windows (registro — instantáneo y
    estable). Solo recurre a WMIC si el registro no está disponible, para no
    ralentizar el arranque. El resultado se cachea por proceso.
    """
    source = None

    # 1) MachineGuid del registro de Windows (rápido, sin subprocesos)
    try:
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Cryptography",
            0,
            winreg.KEY_READ | winreg.KEY_WOW64_64KEY,
        )
        guid, _ = winreg.QueryValueEx(key, "MachineGuid")
        winreg.CloseKey(key)
        if guid:
            source = str(guid)
    except Exception:
        pass

    # 2) Fallback: UUID del producto (placa base) via WMIC (lento, solo si falla el registro)
    if not source:
        try:
            out = subprocess.run(
                ["wmic", "csproduct", "get", "uuid"],
                capture_output=True, text=True, timeout=8,
                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
            )
            lines = [l.strip() for l in out.stdout.splitlines() if l.strip()]
            if len(lines) >= 2 and lines[1].upper() not in ('', 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF'):
                source = lines[1]
        except Exception:
            pass

    # 3) Último recurso: nombre de la máquina
    if not source:
        source = os.environ.get('COMPUTERNAME', 'UNKNOWN')

    digest = hashlib.sha256(source.encode()).hexdigest().upper()
    # ID legible: 16 hex en bloques de 4 → XXXX-XXXX-XXXX-XXXX
    short = digest[:16]
    return f"{short[0:4]}-{short[4:8]}-{short[8:12]}-{short[12:16]}"


# ── Verificación de la firma de una licencia ──────────────────────────────────
def _verify_signature(payload_bytes: bytes, signature: bytes) -> bool:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    from cryptography.exceptions import InvalidSignature
    try:
        pub = Ed25519PublicKey.from_public_bytes(base64.b64decode(PUBLIC_KEY_B64))
        pub.verify(signature, payload_bytes)
        return True
    except (InvalidSignature, Exception):
        return False


def verify_license_key(key: str):
    """Verifica una clave de licencia.

    Devuelve (valido: bool, info: dict, mensaje: str).
    info contiene {machine, customer, issued} si es válida.
    """
    if not key or not key.strip():
        return False, {}, "Clave vacía."

    key = key.strip().replace("\n", "").replace(" ", "")

    try:
        # Formato: <payload_b64>.<signature_b64>
        payload_b64, sig_b64 = key.split(".", 1)
        payload_bytes = base64.urlsafe_b64decode(payload_b64 + "===")
        signature = base64.urlsafe_b64decode(sig_b64 + "===")
    except Exception:
        return False, {}, "Formato de clave inválido."

    # Verificar firma
    if not _verify_signature(payload_bytes, signature):
        return False, {}, "Clave inválida o manipulada."

    # Decodificar payload
    try:
        info = json.loads(payload_bytes.decode())
    except Exception:
        return False, {}, "Contenido de la clave dañado."

    # Verificar vínculo con esta máquina
    this_machine = get_machine_id()
    if info.get("machine") != this_machine:
        return False, info, "Esta clave es para otra computadora."

    # Verificar vencimiento (opcional — licencias sin "expires" son perpetuas)
    # Formato esperado: ISO 8601 (YYYY-MM-DD o YYYY-MM-DDTHH:MM:SS).
    # Las licencias antiguas no traen "expires" → siguen siendo válidas.
    exp = info.get("expires")
    if exp:
        try:
            from datetime import datetime as _dt
            # Aceptar fecha pura o fecha+hora
            exp_dt = _dt.fromisoformat(exp.replace("Z", "+00:00")) if "T" in exp else _dt.fromisoformat(exp)
            if _dt.now() > exp_dt:
                return False, info, f"La licencia venció el {exp_dt.strftime('%d/%m/%Y')}. Renueve con su proveedor."
        except Exception:
            return False, info, "La fecha de vencimiento de la licencia es inválida."

    return True, info, "Licencia válida."


# ── Estado de activación ──────────────────────────────────────────────────────
def is_activated() -> bool:
    """Verifica si la app está activada en esta máquina (re-valida la firma)."""
    if not LICENSE_FILE.exists():
        return False
    try:
        data = json.loads(LICENSE_FILE.read_text(encoding="utf-8"))
        key = data.get("key", "")
    except Exception:
        return False
    valid, _info, _msg = verify_license_key(key)
    return valid


def activate(key: str):
    """Verifica e instala la licencia. Devuelve (ok: bool, mensaje: str)."""
    valid, info, msg = verify_license_key(key)
    if not valid:
        return False, msg
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        LICENSE_FILE.write_text(json.dumps({
            "key": key.strip().replace("\n", "").replace(" ", ""),
            "customer": info.get("customer", ""),
            "issued": info.get("issued", ""),
            "expires": info.get("expires", ""),  # vacío = licencia perpetua
            "machine": info.get("machine", ""),
            "activated_at": datetime.now().isoformat(),
        }, indent=2), encoding="utf-8")
        msg_extra = ""
        if info.get("expires"):
            msg_extra = f" Vence: {info['expires']}."
        return True, f"Activado correctamente para {info.get('customer', 'cliente')}.{msg_extra}"
    except Exception as e:
        return False, f"Error guardando la activación: {e}"


def get_license_info() -> dict:
    """Devuelve la info de la licencia activa (o {} si no hay)."""
    if not LICENSE_FILE.exists():
        return {}
    try:
        return json.loads(LICENSE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


if __name__ == "__main__":
    # Utilidad CLI: mostrar el ID de máquina y estado
    print("ID de Máquina:", get_machine_id())
    print("Activada:", is_activated())
    info = get_license_info()
    if info:
        print("Cliente:", info.get("customer"))
        print("Emitida:", info.get("issued"))
