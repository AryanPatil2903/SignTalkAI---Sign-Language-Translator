@echo off
echo Starting SignBridge...
if exist "venv\Scripts\activate.bat" call venv\Scripts\activate.bat
set FLASK_ENV=development
python app.py
pause