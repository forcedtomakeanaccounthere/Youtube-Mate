#!/bin/bash
# Production yt-dlp installation script for Render deployment

echo "🔧 Setting up yt-dlp for production..."

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Install yt-dlp
echo "📥 Installing yt-dlp..."
pip install --upgrade pip
pip install yt-dlp

# Verify installation
echo "✅ Verifying yt-dlp installation..."
yt-dlp --version

echo "🎉 yt-dlp setup completed!"
