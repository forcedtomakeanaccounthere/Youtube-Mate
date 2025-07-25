# YouTube Mate - URL Shortener

A powerful URL shortener specifically designed for YouTube videos with features like custom timestamps, QR codes, analytics, and bulk processing.

## Features

- ✨ **YouTube URL Shortening**: Shorten any YouTube URL with custom aliases
- ⏰ **Custom Timestamps**: Add start times to videos for precise sharing
- 📊 **Analytics**: Track clicks and engagement (optional)
- 🔗 **QR Codes**: Generate QR codes for easy mobile sharing
- 📱 **Bulk Processing**: Shorten multiple URLs at once
- 🎯 **Custom Domains**: Multiple domain options for branding
- 📅 **Expiry Dates**: Set expiration dates for temporary links
- 🎨 **Beautiful UI**: Modern, responsive design with dark mode

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (running locally or remote)
- npm or yarn

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
- Rate Limiting
- QR Code Generation

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn/ui Components
- React Hooks

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