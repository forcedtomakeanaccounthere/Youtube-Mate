const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'YouTube Mate API Documentation',
      version: '1.0.0',
      description: `

Complete API documentation for YouTube Mate - Your ultimate companion for YouTube content management.

## Features Covered

- **Authentication & Authorization** - User registration, login, OAuth, email verification
- **URL Shortening** - Create, manage, and track shortened YouTube URLs
- **Analytics** - Track clicks, views, and user engagement
- **Downloads** - MP3/MP4 downloads with quality options
- **Transcripts** - Generate and manage video transcripts with AI summaries
- **Video Q&A** - RAG-powered AI question answering about videos
- **Playlists** - Collaborative playlist management with real-time updates
- **Group Streaming** - Synchronized watch parties with real-time sync
- **Subscriptions** - Stripe-powered payment and subscription management
- **ReCAPTCHA** - Bot protection for sensitive operations

## Authentication

Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer YOUR_JWT_TOKEN
\`\`\`

You can obtain a token by:
1. Registering and logging in with email/password
2. Using Google OAuth authentication

## Rate Limiting

API requests are rate-limited to prevent abuse. Current limits:
- General endpoints: 100 requests per 15 minutes per IP
- Download endpoints: 10 requests per minute per IP
- Transcript generation: 5 requests per 15 minutes per IP
- Video Q&A: 10 requests per minute per IP

## Error Handling

All endpoints return standardized error responses:

\`\`\`json
{
  "error": "Error message",
  "message": "Detailed error description",
  "code": "ERROR_CODE" // Optional
}
\`\`\`

## Response Formats

Successful responses typically include:

\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
\`\`\`

## Environment

- **Development**: http://localhost:5000
- **Production**: https://youtube-mate-backend.onrender.com

---

**Developer**: Abhishek Anand
**GitHub**: [@forcedtomakeanaccounthere](https://github.com/forcedtomakeanaccounthere)
**Email**: abhishekanandvii@gmail.com
      `,
      contact: {
        name: 'Abhishek Anand',
        email: 'abhishekanandvii@gmail.com',
        url: 'https://github.com/forcedtomakeanaccounthere'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: 'https://youtube-mate-backend.onrender.com',
        description: 'Production server'
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and account management'
      },
      {
        name: 'URL Shortening',
        description: 'Create and manage shortened YouTube URLs with timestamps'
      },
      {
        name: 'Analytics',
        description: 'Track and analyze URL clicks and engagement'
      },
      {
        name: 'Downloads',
        description: 'Download YouTube videos and playlists in various formats'
      },
      {
        name: 'Transcripts',
        description: 'Generate transcripts and AI summaries for YouTube videos'
      },
      {
        name: 'Video Q&A',
        description: 'AI-powered question answering about video content using RAG'
      },
      {
        name: 'Playlists',
        description: 'Collaborative playlist management with sharing and permissions'
      },
      {
        name: 'Playlist Items',
        description: 'Manage videos within playlists'
      },
      {
        name: 'YouTube',
        description: 'Fetch YouTube video and playlist information'
      },
      {
        name: 'Streaming',
        description: 'Group watch parties with synchronized playback'
      },
      {
        name: 'Payments',
        description: 'Stripe subscription and payment management'
      },
      {
        name: 'Redirects',
        description: 'Handle short URL redirects with analytics tracking'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from login/register'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            message: {
              type: 'string',
              description: 'Detailed error description'
            },
            code: {
              type: 'string',
              description: 'Error code'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            name: {
              type: 'string',
              description: 'User full name'
            },
            authProvider: {
              type: 'string',
              enum: ['local', 'google'],
              description: 'Authentication provider'
            },
            avatar: {
              type: 'string',
              description: 'Avatar URL'
            },
            plan: {
              type: 'string',
              enum: ['free', 'pro', 'exclusive'],
              description: 'Subscription plan'
            },
            isEmailVerified: {
              type: 'boolean',
              description: 'Email verification status'
            }
          }
        },
        ShortenedUrl: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'URL ID'
            },
            originalUrl: {
              type: 'string',
              description: 'Original YouTube URL'
            },
            shortUrl: {
              type: 'string',
              description: 'Shortened URL'
            },
            shortCode: {
              type: 'string',
              description: 'Short code for the URL'
            },
            customAlias: {
              type: 'string',
              nullable: true,
              description: 'Custom alias if set'
            },
            videoData: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                thumbnail: { type: 'string' },
                duration: { type: 'string' },
                channel: { type: 'string' }
              }
            },
            clicks: {
              type: 'number',
              description: 'Number of clicks'
            },
            analyticsEnabled: {
              type: 'boolean',
              description: 'Whether analytics tracking is enabled'
            },
            qrCode: {
              type: 'string',
              description: 'QR code data URL'
            },
            timestamp: {
              type: 'object',
              properties: {
                start: { type: 'number' },
                formatted: { type: 'string' }
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true
            }
          }
        },
        Download: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            youtube_url: { type: 'string' },
            video_id: { type: 'string' },
            format: { type: 'string', enum: ['audio', 'video'] },
            quality: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'] },
            progress: { type: 'number' },
            file_path: { type: 'string', nullable: true },
            file_name: { type: 'string', nullable: true },
            file_size: { type: 'number', nullable: true },
            metadata: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                duration: { type: 'string' },
                thumbnail: { type: 'string' }
              }
            },
            created_at: { type: 'string', format: 'date-time' },
            completed_at: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        Transcript: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            youtubeUrl: { type: 'string' },
            videoId: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
            videoInfo: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                duration: { type: 'string' },
                thumbnail: { type: 'string' },
                channel: { type: 'string' }
              }
            },
            content: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  start: { type: 'number' },
                  duration: { type: 'number' },
                  text: { type: 'string' }
                }
              }
            },
            summary: {
              type: 'object',
              properties: {
                brief: { type: 'string' },
                detailed: { type: 'string' },
                keyPoints: { type: 'array', items: { type: 'string' } }
              }
            },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Playlist: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            thumbnail: { type: 'string' },
            videoCount: { type: 'number' },
            isPublic: { type: 'boolean' },
            isCollaborative: { type: 'boolean' },
            owner: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                avatar: { type: 'string' }
              }
            },
            collaborators: { type: 'number' },
            views: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
            lastModified: { type: 'string', format: 'date-time' },
            tags: { type: 'array', items: { type: 'string' } },
            category: { type: 'string' }
          }
        }
      }
    }
  },
  apis: ['./routes/*.js', './server.js', './swagger/*.js', './swagger/*.yaml']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
