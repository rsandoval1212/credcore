@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  Programar actualización automática de mora — CredCore
REM  Ejecuta este archivo UNA SOLA VEZ como Administrador
REM  Creará una tarea programada que corre cada día a las 00:05 AM
REM ─────────────────────────────────────────────────────────────────────────────

SET PYTHON=%~dp0credcore\backend\venv\Scripts\python.exe
SET MANAGE=%~dp0credcore\backend\manage.py
SET TASK_NAME=CredCore_UpdateMora

echo Programando tarea diaria de mora para CredCore...

schtasks /Create /TN "%TASK_NAME%" ^
  /TR "\"%PYTHON%\" \"%MANAGE%\" update_overdue" ^
  /SC DAILY /ST 00:05 ^
  /RU SYSTEM /F

IF %ERRORLEVEL% EQU 0 (
    echo.
    echo  OK: Tarea programada exitosamente.
    echo  Nombre: %TASK_NAME%
    echo  Horario: Todos los dias a las 00:05 AM
    echo.
    echo  Para verificar: schtasks /Query /TN "%TASK_NAME%"
    echo  Para eliminar:  schtasks /Delete /TN "%TASK_NAME%" /F
) ELSE (
    echo.
    echo  ERROR: Ejecuta este archivo como Administrador.
)

pause
