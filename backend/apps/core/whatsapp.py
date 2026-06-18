"""Utilidades de WhatsApp (links wa.me con mensaje pre-cargado).

El sistema no envía mensajes de forma autónoma: genera una URL `wa.me` con el
texto listo; el operador la abre y presiona enviar. El envío 100% automático
requeriría la API de WhatsApp Business (Meta), de pago. Este módulo centraliza
el formateo del número dominicano y la construcción de la URL.
"""
import urllib.parse


def format_wa_phone(phone: str) -> str:
    """Convierte un teléfono dominicano al formato internacional para wa.me."""
    digits = ''.join(c for c in (phone or '') if c.isdigit())
    if not digits:
        return ''
    # Ya en formato +1 (11 dígitos empezando con 1)
    if len(digits) == 11 and digits.startswith('1'):
        return digits
    # 10 dígitos (809/829/849-XXX-XXXX) → anteponer 1
    if len(digits) == 10:
        return '1' + digits
    # 7 dígitos → asumir área 809
    if len(digits) == 7:
        return '1809' + digits
    return digits


def build_wa_url(phone: str, message: str) -> str:
    """URL wa.me con el mensaje pre-cargado. Devuelve '' si no hay número válido."""
    wa_phone = format_wa_phone(phone)
    if not wa_phone:
        return ''
    return f"https://wa.me/{wa_phone}?text={urllib.parse.quote(message)}"
