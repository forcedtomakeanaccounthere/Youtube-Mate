#!/bin/bash
# Script to prepare cookies file for production deployment

echo "🍪 Preparing cookies for production deployment..."

# Check if cookies file exists locally
if [ ! -f "backend/www.youtube.com_cookies.txt" ]; then
    echo "❌ Cookies file not found at backend/www.youtube.com_cookies.txt"
    echo "   Please export cookies from your browser first"
    exit 1
fi

# Create base64 encoded version for environment variable
echo "📦 Creating base64 encoded cookies..."
COOKIES_BASE64=$(base64 -w 0 backend/www.youtube.com_cookies.txt)

echo "✅ Cookies prepared successfully!"
echo ""
echo "🔧 Add this environment variable to your Render dashboard:"
echo "   Variable Name: YOUTUBE_COOKIES_BASE64"
echo "   Variable Value: $COOKIES_BASE64"
echo ""
echo "💡 The backend will automatically decode and use these cookies in production."
