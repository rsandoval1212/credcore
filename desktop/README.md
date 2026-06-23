# Empaquetado desktop de CredCore

Esta carpeta contiene los archivos necesarios para empaquetar CredCore como un `.exe` instalable de Windows.

## Archivos

| Archivo | Qué hace |
|---|---|
| `credcore_app.py` | Launcher: arranca Django embebido + pywebview |
| `CredCore.spec` | Configuración PyInstaller |
| `licensing.py` | Verificación de licencias Ed25519 (clave pública) |
| `updater.py` | Verificador de updates contra `version.json` |
| `drive_uploader.py` | Subida opcional de backups a Google Drive |
| `build.bat` | Compila el `.exe` con PyInstaller |
| `build-installer.bat` | Compila el instalador con Inno Setup |
| `installer/*.iss` | Scripts Inno Setup |
| `electron/resources/license.txt` | Contrato de licencia mostrado en el instalador |
| `credi.png` / `credcore.ico` | Recursos visuales |

## ⚠️ NO en git (mantener fuera)

- `license_generator.py` — contiene la CLAVE PRIVADA. Está en `C:\Users\sando\Desktop\CredCore V-3-1v\2-HERRAMIENTAS-PRIVADAS\` y respaldos.

## Cómo compilar

Requisitos:
- Python 3.13 con `pyinstaller`, `cryptography`, etc instalados
- Inno Setup 6 en `%LOCALAPPDATA%\Programs\Inno Setup 6\`

Pasos:

```powershell
# 1. Build del frontend
cd ..\frontend
npm run build

# 2. Sincronizar dist a Music\electron\frontend-dist (donde el .spec lo busca)
robocopy ..\frontend\dist ..\..\..\..\..\Music\CredicCore-Desktop\electron\frontend-dist /MIR

# 3. Compilar el .exe con PyInstaller
cd ..\..\..\..\..\Music\CredicCore-Desktop
python -m PyInstaller CredCore.spec --noconfirm --clean

# 4. Crear el instalador
build-installer.bat
```

## Estado actual (TODO)

Hoy estos archivos están duplicados en `C:\Users\sando\Music\CredicCore-Desktop\` (el árbol de build).

**Próximo paso**: que el build se haga desde aquí directamente, eliminando la duplicación. Por ahora se mantienen en sincro manual.
