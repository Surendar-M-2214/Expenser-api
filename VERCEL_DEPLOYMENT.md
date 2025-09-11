# Vercel Deployment Guide for Expenser Backend

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm i -g vercel`
3. **Environment Variables**: Set up your environment variables in Vercel dashboard

## Environment Variables Setup

You need to configure the following environment variables in your Vercel project:

### Required Variables:

```bash
# Database Configuration
DATABASE_URL=your_neon_database_connection_string_here

# Server Configuration
NODE_ENV=production

# Rate Limiting Configuration
ADMIN_TOKEN=your_secure_admin_token_here
INTERNAL_SERVICE_SECRET=your_internal_service_secret_here

# Rate limiting whitelist (comma-separated IPs)
RATE_LIMIT_WHITELIST=127.0.0.1,::1

# Rate limiting endpoint whitelist (comma-separated endpoints)
RATE_LIMIT_ENDPOINT_WHITELIST=/health,/metrics

# Rate limiting blacklist (comma-separated IPs)
RATE_LIMIT_BLACKLIST=

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.vercel.app,https://your-mobile-app-domain.com

# Logging
LOG_LEVEL=info

# Upstash Redis Configuration (for rate limiting)
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
```

## Deployment Steps

### Option 1: Deploy via Vercel CLI

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```

4. **Follow the prompts**:
   - Link to existing project or create new one
   - Set up environment variables when prompted

### Option 2: Deploy via Vercel Dashboard

1. **Push your code to GitHub/GitLab/Bitbucket**

2. **Connect to Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your repository
   - Select the `backend` folder as the root directory

3. **Configure Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add all the required environment variables listed above

4. **Deploy**:
   - Click "Deploy"

## Project Structure

The deployment uses the following structure:
```
backend/
├── api/
│   └── index.js          # Vercel API handler
├── src/                  # Your application source code
├── vercel.json          # Vercel configuration
└── package.json         # Updated with build/start scripts
```

## Important Notes

1. **Database**: Make sure your Neon database is accessible from Vercel's servers
2. **Rate Limiting**: Upstash Redis is used for rate limiting - ensure your Redis instance is accessible
3. **CORS**: Update the CORS_ORIGIN to include your frontend domains
4. **Environment Variables**: All sensitive data should be stored as environment variables in Vercel

## Testing Your Deployment

After deployment, test your API endpoints:

1. **Health Check**: `GET https://your-app.vercel.app/`
2. **API Endpoints**: `GET https://your-app.vercel.app/api/users`

## Troubleshooting

1. **Database Connection Issues**: Check your DATABASE_URL and ensure it's accessible from Vercel
2. **Rate Limiting Issues**: Verify your Upstash Redis credentials
3. **CORS Issues**: Update CORS_ORIGIN with your frontend domains
4. **Build Failures**: Check the Vercel build logs for specific error messages

## Custom Domain (Optional)

To use a custom domain:
1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed by Vercel
