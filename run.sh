#!/usr/bin/env bash
# run.sh — Start Sign Language Translator on Linux/macOS

echo "[SignBridge] Starting Sign Language Translator..."

# Activate virtual environment if present
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "[SignBridge] Virtual environment activated."
fi

# Set environment variables
export FLASK_ENV=development
export FLASK_DEBUG=1

# Run the app
python app.py