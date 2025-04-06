# Quits Application Deployment Guide

This guide details how to deploy the Quits application, which consists of a separate frontend and backend.

## Architecture Overview

The Quits application uses a split architecture:

- **Frontend**: React application using Vite for build optimizations
- **Backend API**: Node.js/Express server providing the API endpoints
- **Database**: Supabase for authentication and data storage

## Prerequisites

- Node.js 16.x or higher
- npm or yarn
- A Vercel account
- A Supabase account and project

## Environment Variables

### Backend API Environment Variables

Configure these in the Vercel project for the backend:

```
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_KEY=your-supabase-service-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://www.quits.cc/auth/google/callback
NODE_ENV=production
```

### Frontend Environment Variables

Configure these in the Vercel project for the frontend:

```
VITE_SUPABASE_URL=https://your-supabase-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_API_URL=https://api.quits.cc
VITE_GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_REDIRECT_URI=https://www.quits.cc/auth/google/callback
```

## Deployment Methods

### Automated Deployment (Recommended)

1. Install dependencies:
   ```
   npm install
   ```

2. Deploy everything (backend and frontend):
   ```
   npm run deploy
   ```

Or you can deploy them separately:

- Backend API only:
  ```
  npm run deploy:backend
  ```

- Frontend only:
  ```
  npm run deploy:frontend
  ```

### Manual Deployment

#### Backend API Deployment

1. Navigate to the API directory:
   ```
   cd quits-backend/api
   ```

2. Deploy to Vercel:
   ```
   npx vercel --prod
   ```

3. Set up your environment variables in the Vercel project settings.

4. Configure a custom domain (api.quits.cc) in the Vercel project settings.

#### Frontend Deployment

1. Build the frontend:
   ```
   npm run build
   ```

2. Deploy to Vercel:
   ```
   npx vercel --prod
   ```

3. Set up your environment variables in the Vercel project settings.

4. Configure a custom domain (www.quits.cc) in the Vercel project settings.

## CORS Configuration

The backend is configured to accept requests from:
- https://www.quits.cc
- http://localhost:3000 (for local development)

If you need to add more origins, update the CORS configuration in:
- `quits-backend/api/src/index.js`
- `quits-backend/api/vercel.json`

## Custom Domain Setup

1. Add your domains to Vercel:
   - Frontend: www.quits.cc
   - Backend: api.quits.cc

2. Configure DNS settings with your domain provider according to Vercel's instructions.

3. Verify the domain in Vercel.

## Troubleshooting

### CORS Issues

If experiencing CORS issues:

1. Check the browser's network tab for specific CORS errors
2. Verify that the frontend origin is allowed in the backend CORS configuration
3. Test using the `/api/cors-test` endpoint to diagnose CORS configuration

### Gmail API Authentication Issues

If the Gmail API integration isn't working:

1. Verify the Google OAuth credentials are correctly set up
2. Check that the redirect URIs match in both Google Console and application config
3. Ensure the required scopes are enabled in the Google Cloud Console

### Vercel Deployment Issues

If deployment fails:

1. Check the Vercel deployment logs for specific errors
2. Verify all required environment variables are set
3. Check that the backend server is starting correctly

## Monitoring

- View Vercel deployment logs and analytics in the Vercel dashboard
- Set up logging and monitoring tools as needed

---

For additional support, check the application documentation or contact the development team. 