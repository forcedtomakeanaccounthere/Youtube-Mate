# YouTube Mate - Deployment Guide

## 🚀 Production Deployment

### Prerequisites
- Node.js 18+ 
- Python 3.8+
- MongoDB Atlas account
- Cloudinary account
- Stripe account (for payments)
- Email service (Gmail/SendGrid)

### Environment Variables

#### Backend (.env)
```env
# Server Configuration
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://your-frontend-url.vercel.app
BACKEND_URL=https://your-backend-url.onrender.com

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-here
JWT_EXPIRES_IN=7d
SESSION_SECRET=your-session-secret-here

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_live_your-key
STRIPE_SECRET_KEY=sk_live_your-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret

# YouTube Data API
YOUTUBE_API_KEY=your-youtube-api-key

# yt-dlp Configuration
YT_DLP_PATH=/opt/render/project/src/venv/bin/yt-dlp
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend-url.onrender.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your-key
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

### Backend Deployment (Render)

1. **Create Render Account**: Sign up at render.com

2. **Create New Web Service**:
   - Connect your GitHub repository
   - Select backend folder as root directory
   - Build Command: `./install-ytdlp.sh && npm install`
   - Start Command: `npm start`
   - Environment: Node
   - Instance Type: Choose based on usage

3. **Configure Environment Variables**:
   - Add all backend environment variables in Render dashboard
   - Ensure `YT_DLP_PATH=/opt/render/project/src/venv/bin/yt-dlp`

4. **Domain Configuration**:
   - Note your Render URL: `https://your-app.onrender.com`
   - Update CORS configuration if needed

### Frontend Deployment (Vercel)

1. **Create Vercel Account**: Sign up at vercel.com

2. **Deploy Frontend**:
   - Connect GitHub repository
   - Select frontend folder as root directory
   - Framework: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Environment Variables**:
   - Add frontend environment variables in Vercel dashboard
   - Update `NEXT_PUBLIC_BACKEND_URL` with your Render URL

4. **Domain Configuration**:
   - Note your Vercel URL: `https://your-app.vercel.app`
   - Update backend CORS and `FRONTEND_URL`

### Database Setup (MongoDB Atlas)

1. **Create Cluster**: Set up MongoDB Atlas cluster
2. **Network Access**: Add `0.0.0.0/0` to IP whitelist
3. **Database User**: Create user with read/write permissions
4. **Connection String**: Update `MONGODB_URI` in backend

### Post-Deployment Steps

1. **Test Core Features**:
   ```bash
   # Test video download
   curl -X POST https://your-backend-url.onrender.com/api/downloads \
        -H "Content-Type: application/json" \
        -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "quality": "720p", "format": "mp4"}'

   # Test playlist processing
   curl -X GET "https://your-backend-url.onrender.com/api/playlists/info?url=PLAYLIST_URL"
   ```

2. **Monitor Logs**:
   - Check Render logs for backend issues
   - Check Vercel logs for frontend issues
   - Monitor MongoDB Atlas metrics

3. **Performance Optimization**:
   - Enable compression in Express
   - Configure CDN for static assets
   - Set up monitoring alerts

### Troubleshooting

#### Common Issues:

1. **yt-dlp Not Found**:
   - Ensure `install-ytdlp.sh` runs during build
   - Check `YT_DLP_PATH` environment variable
   - Verify Python virtual environment

2. **CORS Errors**:
   - Update `FRONTEND_URL` in backend
   - Check CORS configuration in server.js

3. **Database Connection**:
   - Verify MongoDB URI format
   - Check network access settings
   - Ensure proper credentials

4. **YouTube Bot Detection**:
   - Upload fresh `www.youtube.com_cookies.txt`
   - Monitor cookie expiration
   - Consider rotating cookies

### Security Checklist

- [ ] All environment variables set
- [ ] JWT secrets are strong and unique
- [ ] Database access restricted
- [ ] HTTPS enabled on all endpoints
- [ ] Rate limiting configured
- [ ] Input validation implemented
- [ ] CORS properly configured
- [ ] Sensitive data not in logs

### Monitoring

- Set up uptime monitoring (UptimeRobot, Pingdom)
- Configure error tracking (Sentry)
- Monitor database performance
- Track API usage and limits

## 📱 Mobile Responsiveness

The application is fully responsive and works on:
- Desktop browsers
- Mobile browsers
- Tablet devices

## 🔄 Updates and Maintenance

1. **Regular Updates**:
   - Update yt-dlp monthly
   - Monitor YouTube API changes
   - Update dependencies regularly

2. **Backup Strategy**:
   - Regular database backups
   - Environment variables backup
   - Cookie file backup

3. **Performance Monitoring**:
   - Monitor download success rates
   - Track API response times
   - Monitor storage usage

---

**Note**: This deployment guide assumes you're using Render for backend and Vercel for frontend. Adjust accordingly for other platforms like Railway, Heroku, or AWS.
