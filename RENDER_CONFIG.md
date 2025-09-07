# Render Configuration for YouTube Mate Backend

## Build Settings for Render

**Repository**: Your GitHub repository
**Branch**: main
**Root Directory**: `backend`
**Environment**: Node
**Build Command**: `cd .. && ./install-ytdlp.sh && cd backend && npm install`
**Start Command**: `npm start`

## Alternative Build Command (if above doesn't work):
```bash
# Option 1: Install yt-dlp directly in build command
pip install yt-dlp && npm install

# Option 2: Use the install script from backend directory
cd .. && chmod +x install-ytdlp.sh && ./install-ytdlp.sh && cd backend && npm install
```

## Environment Variables to Set in Render Dashboard:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://abhishekanandvii:Anil%401234@cluster0.u6dosaa.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
FRONTEND_URL=https://your-frontend-url.vercel.app
BACKEND_URL=https://youtube-mate-backend.onrender.com
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_EXPIRES_IN=7d
SESSION_SECRET=your-session-secret-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
STRIPE_PUBLISHABLE_KEY=pk_test_your-key
STRIPE_SECRET_KEY=sk_test_51S0LDLDlX8qx480wcC60sXhCT2sYJz1pBOyxImxBW9boIgV1TT1fSXOK5EF6DoWleKeuX6YuaIysI5DZOaSYV1if00SqBRyXJ2
STRIPE_WEBHOOK_SECRET=whsec_pbi99yYOXZB4I1t9NuM7SjUvRZAzZI0E
YOUTUBE_API_KEY=your-youtube-api-key
YT_DLP_PATH=/opt/render/project/src/backend/venv/bin/yt-dlp
```

## Simple Build Command (Recommended):
Instead of using the shell script, use this simpler approach:

**Build Command**: `pip install yt-dlp && npm install`
**Start Command**: `npm start`

This will install yt-dlp globally and then install npm dependencies.
