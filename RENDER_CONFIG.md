# 🚀 Render Configuration for YouTube Mate Backend

## 🔧 UPDATED Build Settings (Use These!)

**Repository**: Your GitHub repository  
**Branch**: main  
**Root Directory**: `backend`  
**Environment**: Node  
**Build Command**: `pip install yt-dlp && npm install`  
**Start Command**: `npm start`  

## 🍪 CRITICAL: Environment Variables for Render

Copy ALL of these to your Render dashboard:

```env
NODE_ENV=production
PORT=10000

# Database
MONGODB_URI=mongodb-atlas-url

# URLs
FRONTEND_URL=https://youtube-mate-mu.vercel.app
BACKEND_URL=https://youtube-mate-backend.onrender.com

# yt-dlp Configuration
YT_DLP_PATH=yt-dlp
YTDL_NO_UPDATE=1

# 🍪 COOKIES (CRITICAL - Add this!)
YOUTUBE_COOKIES_BASE64=<run prepare-cookies.ps1 to get this value>

# Authentication
JWT_SECRET=jwt-secret-key
JWT_EXPIRES_IN=7d
SESSION_SECRET=session-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Configuration
EMAIL_HOST=secret
EMAIL_PORT=secret
EMAIL_USER=secret
EMAIL_PASS=secret
EMAIL_FROM=secret
EMAIL_FROM_NAME=YouTube Mate

# Cloudinary
CLOUDINARY_CLOUD_NAME=cloude-name-secret
CLOUDINARY_API_KEY=api-key-secret
CLOUDINARY_API_SECRET=api-secret

# Stripe
STRIPE_SECRET_KEY=stripe-secret
STRIPE_WEBHOOK_SECRET=stripe-webhook-secret
STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key

# YouTube API
YOUTUBE_API_KEY=your-youtube-api-key
```

## 🍪 Setup Cookies (MOST IMPORTANT!)

1. **Run this command** in your project directory:
   ```powershell
   .\prepare-cookies.ps1
   ```

2. **Copy the base64 output** to Render environment variable:
   - Variable Name: `YOUTUBE_COOKIES_BASE64`
   - Variable Value: `<the long base64 string>`

## ✅ Deployment Checklist

- [ ] Build command: `pip install yt-dlp && npm install`
- [ ] Root directory: `backend`
- [ ] All environment variables added
- [ ] **YOUTUBE_COOKIES_BASE64 added** (most critical!)
- [ ] Frontend and backend URLs updated
- [ ] Deploy triggered
**Start Command**: `npm start`

This will install yt-dlp globally and then install npm dependencies.
