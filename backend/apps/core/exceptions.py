from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        original = response.data

        # Extraer el mensaje principal para facilitar el acceso desde el frontend
        detail = None
        if isinstance(original, dict):
            # DRF puede poner el mensaje en 'detail' directamente
            detail = original.get('detail')
            if detail and hasattr(detail, 'string'):
                detail = str(detail)
        elif isinstance(original, list) and original:
            detail = str(original[0])
        elif isinstance(original, str):
            detail = original

        response.data = {
            'success': False,
            'detail': detail,        # mensaje principal (string o None)
            'errors': original,      # errores completos por campo
            'status_code': response.status_code,
        }

    return response
