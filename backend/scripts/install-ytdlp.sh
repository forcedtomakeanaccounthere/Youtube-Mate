#!/bin/bash
# Production yt-dlp installation script for Render deployment
set -e

echo "🔧 Setting up yt-dlp for production..."

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ] && python3 -m venv .venv 2>/dev/null; then
    echo "📦 Creating Python virtual environment..."
fi

if [ -x ".venv/bin/python" ] && .venv/bin/python -m pip --version >/dev/null 2>&1; then
    echo "📥 Installing yt-dlp in the backend virtual environment..."
    .venv/bin/python -m pip install --upgrade pip
    .venv/bin/python -m pip install --upgrade yt-dlp
else
    if python3 -m pip --version >/dev/null 2>&1; then
        echo "⚠️ Python venv support is unavailable; installing yt-dlp for the Render user..."
        python3 -m pip install --user --upgrade yt-dlp
    else
        echo "⚠️ Python pip is unavailable; yt-dlp installation was skipped."
    fi
fi

# Verify installation
echo "✅ Verifying yt-dlp installation..."
if [ -x ".venv/bin/yt-dlp" ]; then
    .venv/bin/yt-dlp --version
elif [ -x "$HOME/.local/bin/yt-dlp" ]; then
    "$HOME/.local/bin/yt-dlp" --version
elif command -v yt-dlp >/dev/null 2>&1; then
    yt-dlp --version
else
    echo "⚠️ yt-dlp is not available; downloads will be disabled until it is installed."
fi

echo "🎉 yt-dlp setup completed!"
