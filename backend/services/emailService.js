const nodemailer = require("nodemailer")

// Global transporter variable
let transporter = null

// Initialize email transporter (call this after environment variables are loaded)
const initializeEmailService = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error("❌ Missing required email environment variables")
    return false
  }

  // Create transporter with Gmail configuration
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL for port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false // Accept self-signed certificates
    },
    connectionTimeout: 10000, // 10 second connection timeout
    greetingTimeout: 10000,
    socketTimeout: 15000,
    debug: false, // Disable debug mode
    logger: false // Disable logging
  })

  // Verify transporter configuration
  transporter.verify(function (error, success) {
    if (error) {
      console.error("❌ Email transporter error:", error)
    } else {
      console.log("✅ Email server is ready to send messages")
    }
  })

  return true
}

// Email template wrapper with improved branding and spacing
const createEmailTemplate = (content, title) => {
  const logoUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/8.png`
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #374151;
                background-color: #f8fafc;
                margin: 0;
                padding: 0;
            }
            
            .email-container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #f8fafc;
                padding: 40px 20px;
            }
            
            .header {
                text-align: center;
                margin-bottom: 25px;
                padding: 30px 0;
            }
            
            .logo-container {
                display: inline-block;
                margin-bottom: 20px;
            }
            
            .logo-wrapper {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 20px;
            }
            
            .logo-image {
                width: 50px;
                height: 50px;
                border-radius: 15px;
                box-shadow: 0 10px 25px rgba(249, 115, 22, 0.35);
            }
            
            .brand-text {
                font-size: 32px;
                font-weight: 800;
                color: #f97316;
                text-decoration: none;
                letter-spacing: -0.025em;
            }
            
            .content-card {
                background: #ffffff;
                border-radius: 16px;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                padding: 50px 40px;
                margin-bottom: 40px;
            }
            
            .btn {
                display: inline-block;
                background: linear-gradient(135deg, #f97316 0%, #dc2626 100%);
                color: white !important;
                text-decoration: none;
                padding: 18px 36px;
                border-radius: 12px;
                font-weight: 700;
                font-size: 16px;
                text-align: center;
                box-shadow: 0 4px 14px 0 rgba(249, 115, 22, 0.39);
                transition: all 0.3s ease;
                border: none;
                cursor: pointer;
            }
            
            .btn:hover {
                box-shadow: 0 6px 20px rgba(249, 115, 22, 0.5);
                transform: translateY(-2px);
            }
            
            .link-box {
                background-color: #fef2f2;
                border: 1px solid #fecaca;
                border-radius: 8px;
                padding: 16px;
                margin: 20px 0;
                word-break: break-all;
                font-size: 13px;
                color: #f97316;
                text-decoration: none;
            }
            
            .notice-box {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
            }
            
            .warning-box {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
            }
            
            .error-box {
                background: #fef2f2;
                border: 1px solid #fca5a5;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
            }
            
            .success-box {
                background: #f0f9ff;
                border: 1px solid #7dd3fc;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
            }
            
            .footer {
                text-align: center;
                padding: 25px 35px;
                color: #6b7280;
                font-size: 14px;
                line-height: 1.6;
            }
            
            .footer-divider {
                height: 1px;
                background-color: #e5e7eb;
                margin: 0 30px 20px 30px;
            }
            
            .feature-item {
                margin-bottom: 20px;
            }
            
            .feature-title {
                color: #f97316;
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 4px;
            }
            
            .feature-desc {
                color: #6b7280;
                font-size: 14px;
                line-height: 1.5;
            }
            
            @media only screen and (max-width: 600px) {
                .email-container {
                    padding: 20px 10px;
                }
                
                .content-card {
                    padding: 30px 20px;
                }
                
                .logo-wrapper {
                    flex-direction: column;
                    gap: 12px;
                }
                
                .brand-text {
                    font-size: 28px;
                }
                
                .btn {
                    padding: 16px 28px;
                    font-size: 15px;
                }
            }
        </style>
    </head>
    <body>
        <div class="email-container">
            <!-- Header with Logo -->
            <div class="header">
                <div class="logo-container">
                    <div class="logo-wrapper">
                        <img src="https://res.cloudinary.com/dddkvuatb/image/upload/v1755374999/8_stqdwy.png" alt="YouTube Mate Logo" class="logo-image" />
                        <span class="brand-text">YouTube Mate</span>
                    </div>
                </div>
            </div>
            
            <!-- Main Content Card -->
            <div class="content-card">
                ${content}
            </div>
            
            <!-- Footer -->
            <div class="footer">
                <div class="footer-divider"></div>
                <p>
                    This email was sent by <strong style="color: #f97316;">YouTube Mate</strong><br/>
                    <span style="font-size: 13px; color: #9ca3af;">Your all-in-one YouTube companion for downloads, transcripts, and more!</span>
                </p>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 15px;">
                    © 2025 YouTube Mate. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
  `
}

// Improved email verification template with better spacing
const createVerificationEmail = (name, verificationLink) => {
  const content = `
    <!-- Welcome Header -->
    <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-size: 40px; font-weight: 800; color: #1f2937; margin-bottom: 20px; line-height: 1.2;">
            Welcome to YouTube Mate!
        </h1>
        <div style="font-size: 32px; margin-bottom: 30px;">🎉</div>
    </div>
    
    <!-- Personal Greeting -->
    <div style="text-align: center; margin-bottom: 40px;">
        <p style="font-size: 20px; color: #4b5563; line-height: 1.4; margin-bottom: 30px;">
            Hi <strong style="color: #1f2937;">${name}</strong>,
        </p>
        <p style="font-size: 16px; color: #6b7280; line-height: 1.6; margin: 0;">
            Thanks for joining YouTube Mate! We're excited to have you on board. 
            To get started and access all our amazing features, please verify your email address by clicking the button below.
        </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 40px 0;">
        <a href="${verificationLink}" class="btn" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); color: white; text-decoration: none; padding: 18px 36px; border-radius: 12px; font-weight: 700; font-size: 16px;">
            Verify My Email
        </a>
    </div>

    <!-- Alternative Link Instructions -->
    <div style="text-align: center; margin: 40px 0 20px 0;">
        <p style="font-size: 14px; color: #9ca3af; line-height: 1.5; margin: 0;">
            If the button doesn't work, copy and paste this link into your browser:
        </p>
    </div>

    <!-- Link Box -->
    <div style="text-align: center; margin: 20px 0 40px 0;">
        <div class="link-box" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; word-break: break-all; font-size: 13px; color: #f97316;">
            <a href="${verificationLink}" style="color: #f97316; text-decoration: none;">${verificationLink}</a>
        </div>
    </div>

    <!-- Security Notice -->
    <div class="warning-box" style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 12px; padding: 20px; text-align: center;">
        <p style="font-size: 14px; color: #ea580c; line-height: 1.5; margin: 0;">
            <strong>⏰ Important:</strong> This verification link will expire in 24 hours for security reasons.
        </p>
    </div>
  `

  return createEmailTemplate(content, "Verify Your Email - YouTube Mate")
}

// Improved password reset template
const createPasswordResetEmail = (name, resetLink) => {
  const content = `
    <!-- Reset Header -->
    <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-size: 40px; font-weight: 800; color: #1f2937; margin-bottom: 20px; line-height: 1.2;">
            Password Reset Request
        </h1>
        <div style="font-size: 32px; margin-bottom: 30px;">🔐</div>
    </div>
    
    <!-- Personal Greeting -->
    <div style="text-align: center; margin-bottom: 30px;">
        <p style="font-size: 20px; color: #4b5563; line-height: 1.4; margin-bottom: 30px;">
            Hi <strong style="color: #1f2937;">${name}</strong>,
        </p>
        <p style="font-size: 16px; color: #6b7280; line-height: 1.6; margin: 0;">
            We received a request to reset your password for your YouTube Mate account. 
            Click the button below to create a new password.
        </p>
    </div>

    <!-- Safety Notice -->
    <div class="notice-box" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; margin: 30px 0;">
        <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin: 0;">
            <strong>🛡️ Security Note:</strong> If you didn't request this password reset, you can safely ignore this email. Your account remains secure.
        </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 40px 0;">
        <a href="${resetLink}" class="btn" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); color: white; text-decoration: none; padding: 18px 36px; border-radius: 12px; font-weight: 700; font-size: 16px;">
            🔄 Reset My Password
        </a>
    </div>

    <!-- Alternative Link Instructions -->
    <div style="text-align: center; margin: 40px 0 20px 0;">
        <p style="font-size: 14px; color: #9ca3af; line-height: 1.5; margin: 0;">
            If the button doesn't work, copy and paste this link into your browser:
        </p>
    </div>

    <!-- Link Box -->
    <div style="text-align: center; margin: 20px 0 40px 0;">
        <div class="link-box" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; word-break: break-all; font-size: 13px; color: #f97316;">
            <a href="${resetLink}" style="color: #f97316; text-decoration: none;">${resetLink}</a>
        </div>
    </div>

    <!-- Warning Notice -->
    <div class="error-box" style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
        <p style="font-size: 14px; color: #dc2626; line-height: 1.5; margin: 0;">
            <strong>⚠️ Security Notice:</strong> This reset link will expire in 1 hour for your protection.
        </p>
    </div>

    <!-- Support Contact -->
    <div style="text-align: center;">
        <p style="font-size: 14px; color: #9ca3af; line-height: 1.5; margin: 0;">
            Need help? Contact our support team at 
            <a href="mailto:support@youtubemate.com" style="color: #f97316; text-decoration: none; font-weight: 600;">support@youtubemate.com</a>
        </p>
    </div>
  `

  return createEmailTemplate(content, "Reset Your Password - YouTube Mate")
}

// Improved welcome email template
const createWelcomeEmail = (name) => {
  const content = `
    <!-- Welcome Header -->
    <div style="text-align: center; margin-bottom: 40px;">
        <h1 style="font-size: 40px; font-weight: 800; color: #1f2937; margin-bottom: 20px; line-height: 1.2;">
            Welcome Aboard!
        </h1>
        <div style="font-size: 32px; margin-bottom: 30px;">🚀</div>
    </div>
    
    <!-- Personal Greeting -->
    <div style="text-align: center; margin-bottom: 40px;">
        <p style="font-size: 20px; color: #4b5563; line-height: 1.4; margin-bottom: 30px;">
            Hi <strong style="color: #1f2937;">${name}</strong>,
        </p>
        <p style="font-size: 16px; color: #6b7280; line-height: 1.6; margin: 0;">
            Your email has been successfully verified! 🎉 You now have full access to all YouTube Mate features.
        </p>
    </div>

    <!-- Features Header -->
    <div style="text-align: center; margin: 40px 0 30px 0;">
        <h2 style="font-size: 18px; color: #374151; line-height: 1.4; font-weight: 700; margin: 0;">
            Here's what you can do now:
        </h2>
    </div>

    <!-- Features Grid -->
    <div class="notice-box" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 25px 20px;">
        
        <div class="feature-item" style="margin-bottom: 20px;">
            <div class="feature-title" style="color: #f97316; font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                🎬 Download Videos & Audio
            </div>
            <div class="feature-desc" style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                Save your favorite YouTube content in multiple formats and quality options
            </div>
        </div>

        <div class="feature-item" style="margin-bottom: 20px;">
            <div class="feature-title" style="color: #f97316; font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                📝 Generate Transcripts
            </div>
            <div class="feature-desc" style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                Get accurate AI-powered transcriptions with timestamps and speaker identification
            </div>
        </div>

        <div class="feature-item" style="margin-bottom: 20px;">
            <div class="feature-title" style="color: #f97316; font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                📋 Create Playlists
            </div>
            <div class="feature-desc" style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                Organize your content collections and share them with friends and colleagues
            </div>
        </div>

        <div class="feature-item" style="margin-bottom: 20px;">
            <div class="feature-title" style="color: #f97316; font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                🔗 Shorten URLs
            </div>
            <div class="feature-desc" style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                Create clean, branded links with detailed click analytics and tracking
            </div>
        </div>

        <div class="feature-item" style="margin-bottom: 0;">
            <div class="feature-title" style="color: #f97316; font-size: 16px; font-weight: 600; margin-bottom: 4px;">
                📊 View Analytics
            </div>
            <div class="feature-desc" style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                Track your downloads, usage patterns, and detailed performance metrics
            </div>
        </div>

    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 40px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}" class="btn" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #dc2626 100%); color: white; text-decoration: none; padding: 18px 36px; border-radius: 12px; font-weight: 700; font-size: 16px;">
            🎯  Start Using YouTube Mate
        </a>
    </div>

    <!-- Pro Tip -->
    <div class="success-box" style="background: #f0f9ff; border: 1px solid #7dd3fc; border-radius: 12px; padding: 20px; text-align: center;">
        <p style="font-size: 14px; color: #0369a1; line-height: 1.6; margin: 0;">
            <strong>💡 Pro Tip:</strong> Bookmark our site for quick access and explore all features. Need help? Our comprehensive documentation and support team are here to assist you!
        </p>
    </div>
  `

  return createEmailTemplate(content, "Welcome to YouTube Mate!")
}

// Send email function
const sendEmail = async (to, subject, htmlContent) => {
  try {
    if (!transporter) {
      console.error("❌ Email service not initialized")
      return { success: false, error: "Email service not initialized" }
    }

    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || 'YouTube Mate'} <${process.env.EMAIL_FROM}>`,
      to,
      subject,
      html: htmlContent,
    }

    const result = await transporter.sendMail(mailOptions)
    return { success: true, messageId: result.messageId }
  } catch (error) {
    console.error("❌ Email sending failed:", error)
    return { success: false, error: error.message }
  }
}

// Wrapper functions for different email types
const sendVerificationEmail = async (email, name, verificationToken) => {
  const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`
  const htmlContent = createVerificationEmail(name, verificationLink)
  return await sendEmail(email, "Verify Your Email - YouTube Mate", htmlContent)
}

const sendPasswordResetEmail = async (email, name, resetToken) => {
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`
  const htmlContent = createPasswordResetEmail(name, resetLink)
  return await sendEmail(email, "Reset Your Password - YouTube Mate", htmlContent)
}

const sendWelcomeEmail = async (email, name) => {
  const htmlContent = createWelcomeEmail(name)
  return await sendEmail(email, "Welcome to YouTube Mate! 🎉", htmlContent)
}

const sendCollaborationInvite = async (email, inviteData) => {
  const { playlistName, inviterName, role, acceptUrl } = inviteData
  const htmlContent = createCollaborationInviteEmail(playlistName, inviterName, role, acceptUrl)
  return await sendEmail(email, `Collaboration Invite: ${playlistName} - YouTube Mate`, htmlContent)
}

// Create collaboration invite email template
const createCollaborationInviteEmail = (playlistName, inviterName, role, acceptUrl) => {
  const content = `
    <div style="margin-bottom: 32px;">
      <h1 style="color: #1f2937; font-size: 28px; margin-bottom: 16px; text-align: center;">
        🎬 Collaboration Invite
      </h1>
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
        You've been invited to collaborate on a YouTube playlist!
      </p>
    </div>

    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 24px; border-radius: 12px; margin-bottom: 32px;">
      <h2 style="color: white; font-size: 20px; margin-bottom: 8px; text-align: center;">
        ${playlistName}
      </h2>
      <p style="color: rgba(255, 255, 255, 0.9); font-size: 14px; text-align: center; margin: 0;">
        Invited by ${inviterName}
      </p>
    </div>

    <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
      <h3 style="color: #1f2937; font-size: 16px; margin-bottom: 12px;">Your Role:</h3>
      <p style="color: #4b5563; font-size: 14px; margin: 0;">
        <strong>${role.charAt(0).toUpperCase() + role.slice(1)}</strong> - 
        ${role === 'viewer' ? 'You can view the playlist' : 
          role === 'editor' ? 'You can add and remove videos' : 
          'You can manage collaborators and playlist settings'}
      </p>
    </div>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${acceptUrl}" style="background: #ef4444; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px;">
        Accept Invitation
      </a>
    </div>

    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="color: #92400e; font-size: 14px; margin: 0;">
        <strong>Note:</strong> This invitation will expire in 7 days. Click the button above to accept and start collaborating!
      </p>
    </div>
  `
  
  return createEmailTemplate(content, 'Collaboration Invite')
}

// Send subscription upgrade email
const sendSubscriptionUpgradeEmail = async (email, name, planName, features) => {
  const subject = `🎉 Welcome to YouTube Mate ${planName}!`
  
  const content = `
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 24px; border-radius: 12px; margin-bottom: 32px;">
      <h2 style="color: white; font-size: 24px; margin-bottom: 8px; text-align: center;">
        🎉 Subscription Upgraded!
      </h2>
      <p style="color: rgba(255, 255, 255, 0.9); font-size: 16px; text-align: center; margin: 0;">
        Welcome to ${planName}
      </p>
    </div>

    <p style="color: #1f2937; font-size: 16px; margin-bottom: 24px;">
      Hi ${name},
    </p>

    <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
      🚀 Congratulations! Your YouTube Mate subscription has been successfully upgraded to <strong>${planName}</strong>. 
      You now have access to premium features that will enhance your YouTube experience.
    </p>

    <div style="background: #f0fdf4; border: 1px solid #10b981; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #065f46; font-size: 16px; margin-bottom: 16px;">🎯 Your New Features:</h3>
      <ul style="color: #065f46; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
        ${features.map(feature => `<li style="margin-bottom: 8px;">${feature}</li>`).join('')}
      </ul>
    </div>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" style="background: #10b981; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; margin-right: 12px;">
        Start Using Features
      </a>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/subscription" style="background: transparent; color: #10b981; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block; font-size: 16px; border: 2px solid #10b981;">
        View Subscription
      </a>
    </div>

    <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="color: #1e40af; font-size: 14px; margin: 0;">
        <strong>💡 Pro Tip:</strong> Your subscription will automatically renew monthly. You can manage your subscription anytime from your account settings.
      </p>
    </div>

    <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
      Thank you for choosing YouTube Mate! If you have any questions or need help getting started with your new features, 
      don't hesitate to reach out to our support team.
    </p>
  `
  
  const emailHtml = createEmailTemplate(content, 'Subscription Upgraded')
  
  return sendEmail(email, subject, emailHtml)
}

module.exports = {
  initializeEmailService,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendCollaborationInvite,
  sendSubscriptionUpgradeEmail,
}