# YouTube Mate - Complete YouTube Management Platform

A comprehensive YouTube management platform featuring URL shortening, video/audio downloading, transcription, collaborative playlists, and advanced analytics.

## Features

- 🎥 **Video/Audio Downloads**: Download YouTube videos and audio in multiple formats and qualities
- 📝 **Transcription Service**: AI-powered transcription with timestamp support
- 📂 **Collaborative Playlists**: Create and share playlists with team members
- ✨ **URL Shortening**: Shorten YouTube URLs with custom aliases and timestamps
- 📊 **Advanced Analytics**: Comprehensive tracking and insights
- 🔗 **QR Codes**: Generate QR codes for easy mobile sharing
- 📱 **Bulk Processing**: Process multiple URLs and downloads simultaneously
- 🎯 **Custom Domains**: Multiple domain options for branding
- 📅 **Expiry Management**: Set expiration dates for temporary links
- 🎨 **Modern UI**: Beautiful, responsive design with dark mode
- 🔐 **Authentication**: Secure user accounts with Google OAuth
- 💳 **Subscription Management**: Stripe integration for premium features

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- Python (v3.8 or higher) 
- MongoDB (Atlas recommended for production)
- npm or yarn
- YouTube Data API key
- Cloudinary account (for file storage)
- Stripe account (for payments)

### Option 1: Automated Setup (Windows)

1. Double-click `start-dev.bat` to start both frontend and backend automatically

### Option 2: Manual Setup

#### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create .env file (copy from .env.example)
cp .env.example .env

# Edit .env file with your MongoDB connection string
# Default: MONGODB_URI=mongodb://localhost:27017/youtube-mate

# Start the backend server
npm run dev
```

#### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start the frontend development server
npm run dev
```

### Accessing the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

## Environment Variables

### Backend (.env)

```bash
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/youtube-mate

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URL for CORS
FRONTEND_URL=http://localhost:3000

# JWT Secret (change in production)
JWT_SECRET=your-super-secret-jwt-key

# Optional: YouTube API Key for enhanced metadata
YOUTUBE_API_KEY=your-youtube-api-key

# Domain Configuration
DEFAULT_DOMAIN=ytmate.co

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Endpoints

### URLs

- `POST /api/urls/shorten` - Create a shortened URL
- `POST /api/urls/bulk-shorten` - Bulk shorten multiple URLs
- `GET /api/urls/my-urls` - Get user's URLs (requires auth)

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Analytics

- `GET /api/analytics/url/:shortCode` - Get URL analytics
- `GET /api/analytics/dashboard` - Get user dashboard data

## Project Structure

```
youtube-mate/
├── backend/                 # Express.js API server
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Custom middleware
│   ├── models/            # MongoDB models
│   ├── routes/            # API routes
│   ├── utils/             # Utility functions
│   └── server.js          # Main server file
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/           # App router pages
│   │   ├── components/    # Reusable components
│   │   ├── hooks/         # Custom hooks
│   │   └── lib/           # Utility libraries
│   └── public/            # Static assets
├── start-dev.bat          # Windows startup script
└── start-dev.sh           # Unix/Linux startup script
```

## Key Features Explained

### URL Shortening

The application accepts YouTube URLs in various formats:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://youtube.com/embed/VIDEO_ID`

### Custom Timestamps

You can add start times to videos using the timestamp feature:
- Hours, minutes, and seconds input
- Validates against video duration
- Formats as `?t=XXXs` parameter

### Analytics

Track engagement with optional analytics:
- Click counting
- Geographical data (IP-based)
- Referrer tracking
- Time-based statistics

### Bulk Processing

Upload multiple URLs at once:
- Line-separated input
- Individual status tracking
- Batch processing with error handling

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running
   - Check connection string in .env
   - Verify MongoDB service status

2. **Port Already in Use**
   - Check if ports 3000 or 5000 are occupied
   - Kill existing processes or use different ports

3. **YouTube Metadata Not Loading**
   - Check internet connection
   - Verify YouTube URL format
   - Some videos may have restricted metadata

4. **CORS Errors**
   - Ensure frontend URL matches FRONTEND_URL in backend .env
   - Check if both servers are running

### Getting Help

- Check the console logs for detailed error messages
- Ensure all dependencies are installed
- Verify environment variables are set correctly

## Development

### Tech Stack

**Backend:**
- Node.js + Express.js
- MongoDB + Mongoose
- JWT Authentication
- yt-dlp Integration
- AI Transcription
- Stripe Payments
- Rate Limiting
- QR Code Generation

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn/ui Components
- React Hooks

## 🚀 Production Deployment

### Quick Deploy

1. **Backend (Render)**:
   - Connect GitHub repository
   - Set build command: `./install-ytdlp.sh && npm install`
   - Set start command: `npm start`
   - Add environment variables from `.env.example`

2. **Frontend (Vercel)**:
   - Connect GitHub repository
   - Select frontend folder
   - Framework: Next.js
   - Add environment variables

3. **Database (MongoDB Atlas)**:
   - Create cluster
   - Add connection string to backend environment

### Detailed Setup

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive deployment instructions including:
- Environment variable configuration
- Platform-specific setup
- Security checklist
- Monitoring setup
- Troubleshooting guide

### Environment Variables

**Backend (.env)**:
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
FRONTEND_URL=https://your-frontend.vercel.app
BACKEND_URL=https://your-backend.onrender.com
JWT_SECRET=your-secret
YOUTUBE_API_KEY=your-api-key
STRIPE_SECRET_KEY=sk_live_...
# ... see DEPLOYMENT.md for complete list
```

**Frontend (.env.local)**:
```env
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

## 📊 Features Overview

### Core Features
- ✅ YouTube video/audio downloads (multiple formats)
- ✅ AI-powered transcription with timestamps
- ✅ Collaborative playlist management
- ✅ URL shortening with custom domains
- ✅ Advanced analytics and tracking
- ✅ User authentication (Google OAuth)
- ✅ Subscription management (Stripe)

### Technical Features
- ✅ Bot detection bypass with cookie authentication
- ✅ Rate limiting and security measures
- ✅ Cloud storage integration (Cloudinary)
- ✅ Database persistence for all operations
- ✅ Responsive design for all devices
- ✅ Error handling and logging

## 🔧 Troubleshooting

### Common Issues

1. **"spawn yt-dlp ENOENT"**: Ensure yt-dlp is installed in virtual environment
2. **YouTube bot detection**: Update cookies file or use fresh cookies
3. **CORS errors**: Check FRONTEND_URL and BACKEND_URL environment variables
4. **Database connection**: Verify MongoDB URI and network access
5. **Rate limiting**: Adjust rate limiter settings for your usage

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Support

For issues and questions, please check the troubleshooting section above or create an issue in the repository.