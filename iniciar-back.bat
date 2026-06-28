@echo off
echo Iniciando backend Tupa...
cd /d "%~dp0tupa-back"
python -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
