#!/bin/bash

# Production deployment script for YouTube Mate Backend
# This script sets up the production environment on Render

echo "🚀 Starting YouTube Mate Backend Deployment..."

# Install Python and create virtual environment
echo "📦 Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install yt-dlp
echo "📥 Installing yt-dlp..."
pip install --upgrade pip
pip install yt-dlp

# Verify yt-dlp installation
echo "✅ Verifying yt-dlp installation..."
yt-dlp --version

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install --production

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p downloads
mkdir -p temp

# Set permissions
echo "🔐 Setting permissions..."
chmod +x venv/bin/yt-dlp
chmod 755 downloads
chmod 755 temp

echo "✅ Deployment setup complete!"
echo "yt-dlp path: $(which yt-dlp)"
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Test yt-dlp
echo "🧪 Testing yt-dlp..."
yt-dlp --simulate --no-warnings "https://www.youtube.com/watch?v=dQw4w9WgXcQ" && echo "✅ yt-dlp test passed" || echo "❌ yt-dlp test failed"

echo "🎉 Ready to start the application with 'npm start'"
