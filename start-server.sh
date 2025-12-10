#!/bin/bash

# Simple HTTP Server Runner
# Запускає локальний HTTP-сервер для тестування WebAuthn

echo "🚀 Запуск локального HTTP-сервера..."
echo "📱 WebAuthn вимагає HTTPS або localhost для роботи"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "✅ Використовується Python 3"
    echo "🌐 Сервер буде доступний на: http://localhost:8000"
    echo "🔑 Натисніть Ctrl+C для зупинки сервера"
    echo ""
    python3 -m http.server 8000
# Check if Python 2 is available
elif command -v python &> /dev/null; then
    echo "✅ Використовується Python 2"
    echo "🌐 Сервер буде доступний на: http://localhost:8000"
    echo "🔑 Натисніть Ctrl+C для зупинки сервера"
    echo ""
    python -m SimpleHTTPServer 8000
else
    echo "❌ Python не знайдено!"
    echo "📥 Встановіть Python або використайте інший спосіб:"
    echo ""
    echo "Варіант 1: Node.js http-server"
    echo "  npm install -g http-server"
    echo "  http-server -p 8000"
    echo ""
    echo "Варіант 2: VS Code Live Server extension"
    echo "  Встановіть розширення Live Server у VS Code"
    echo ""
    exit 1
fi
