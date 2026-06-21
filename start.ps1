# Inicia o backend (FastAPI) e o frontend (Vite) em janelas separadas

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\tupa-back'; python main.py"

# Frontend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\tupa-front'; npm run dev"

Write-Host "Backend iniciando em http://localhost:8000"
Write-Host "Frontend iniciando em http://localhost:8080"
