require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const cors = require('cors');
const bodyParser = require('body-parser');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('cross-fetch');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const allowedOrigins = [
  'https://quits.cc',
  'https://www.quits.cc',
  'https://quits.vercel.app',
  'http://localhost:3000'
];

// Configure CORS
const corsOptions = {
  origin: function (origin, callback) {
    // Log the request origin
    console.log('Request origin:', origin);

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      callback(null, true);
      return;
    }

    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      // Direct match
      if (origin === allowedOrigin) return true;
      
      // Match without www
      const originWithoutWww = origin.replace('www.', '');
      const allowedWithoutWww = allowedOrigin.replace('www.', '');
      return originWithoutWww === allowedWithoutWww;
    });

    if (isAllowed) {
      // Important: Return the actual origin that was received
      callback(null, origin);
    } else {
      console.log('Origin not allowed:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'x-gmail-token', 'x-user-id'],
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Enable pre-flight across-the-board
app.options('*', cors(corsOptions));

// Other middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', cors(corsOptions), (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

// Session configuration with better security
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  name: 'sessionId', // Don't use default connect.sid
  rolling: true, // Refresh session on each request
  unset: 'destroy' // Remove session when browser closes
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Configure Google Strategy with explicit scopes
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
    accessType: 'offline',
    prompt: 'consent'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('Received tokens:', { hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
      // Store tokens and user info
      const user = {
        id: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        accessToken,
        refreshToken,
        scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly'] // Store scopes with user
      };
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

// Auth routes
app.get('/auth/google',
  (req, res, next) => {
    console.log('Starting Google authentication...');
    next();
  },
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
    accessType: 'offline',
    prompt: 'consent'
  })
);

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'https://api.quits.cc/auth/google/callback';
const CLIENT_URL = process.env.CLIENT_URL || 'https://quits.vercel.app';

// Google OAuth callback endpoint
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      throw new Error('No authorization code provided');
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      throw new Error('Failed to exchange authorization code for tokens');
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful');

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }

    const userInfo = await userResponse.json();
    console.log('User info retrieved:', userInfo.email);

    // Create or update user in Supabase
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({
        email: userInfo.email,
        google_id: userInfo.id,
        name: userInfo.name,
        picture: userInfo.picture,
        last_login: new Date().toISOString(),
      })
      .select()
      .single();

    if (userError) {
      console.error('Error upserting user:', userError);
      throw new Error('Failed to create or update user');
    }

    // Create session
    const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({
      email: userInfo.email,
      password: tokens.access_token, // Use access token as password for OAuth users
    });

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      throw new Error('Failed to create session');
    }

    // Store Gmail token in session storage
    sessionStorage.setItem('gmail_access_token', tokens.access_token);

    // Redirect to frontend with success
    res.redirect(`${CLIENT_URL}/scanning?success=true`);
  } catch (error) {
    console.error('Error in Google callback:', error);
    res.redirect(`${CLIENT_URL}/auth/error?message=${encodeURIComponent(error.message)}`);
  }
});

// Add a route to handle the frontend callback
app.post('/auth/google/frontend-callback', (req, res) => {
  console.log('Received frontend callback:', req.body);
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, error: 'No code provided' });
  }


  // Here you would typically exchange the code for tokens
  // For now, we'll just return success
  res.json({ success: true });
});

app.get('/auth/user', (req, res) => {
  console.log('Checking authentication status:', req.isAuthenticated(), req.user);
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: req.user
    });
  } else {
    res.json({
      authenticated: false,
      user: null
    });
  }
});

app.get('/auth/logout', (req, res) => {
  req.logout(() => {
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/login`);
  });
});

// Improved error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    origin: req.headers.origin
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: err.message
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      details: err.message
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Initialize Supabase client with custom fetch
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file.');
}

console.log('Initializing Supabase with URL:', supabaseUrl);

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'Content-Type': 'application/json'
    },
    fetch: fetch
  }
});

// Test Supabase connection on startup
async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    // Instead of querying the subscriptions table, let's do a simpler test
    const { data, error } = await supabase.from('subscriptions').select('count').limit(0);
    if (error) {
      if (error.code === '42P01') {
        console.log('Database table not ready yet, will retry on requests');
        return true; // Don't treat this as an error
      }
      console.error('Error connecting to Supabase:', error);
      return false;
    }
    console.log('Successfully connected to Supabase');
    return true;
  } catch (error) {
    console.error('Error connecting to Supabase:', error);
    return false;
  }
}

// Test connection but don't block server startup
testSupabaseConnection().then(success => {
  if (!success) {
    console.warn('Warning: Could not establish initial Supabase connection. Will retry on requests.');
  }
});

// Improved Supabase connection handling
async function ensureSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('subscriptions').select('count');
    if (error) {
      if (error.code === '42P01') {
        console.log('Database table not ready yet, will retry on requests');
        return true;
      }
      console.error('Database connection error:', error);
      throw new Error(`Database connection error: ${error.message}`);
    }
    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    throw new Error(`Database connection error: ${error.message}`);
  }
}

// Helper function to extract subscription data from email
function extractSubscriptionData(emailBody) {
  const subscriptionPatterns = [
    // Common subscription keywords
    {
      pattern: /subscription|subscribe|membership|plan|netflix|spotify|disney\+|hbo|amazon prime|youtube|premium/i,
      type: 'subscription'
    },
    // Payment patterns
    {
      pattern: /monthly|yearly|annual|payment|recurring|billing/i,
      type: 'recurring'
    },
    // Price patterns for different currencies
    {
      pattern: /(?:USD|EUR|€|\$)\s*(\d+(?:\.\d{2})?)/i,
      type: 'price'
    },
    // Additional subscription indicators
    {
      pattern: /your.+subscription|thank you for subscribing|subscription confirmation|payment processed/i,
      type: 'confirmation'
    }
  ];

  const data = {
    type: null,
    price: null,
    provider: null,
    frequency: 'monthly', // default
    lastDetectedDate: new Date().toISOString()
  };

  // Extract provider from email address and subject
  if (emailBody.from) {
    const fromMatch = emailBody.from.toLowerCase().match(/@([^>]+)/);
    if (fromMatch) {
      const domain = fromMatch[1];
      // Extract company name from domain
      data.provider = domain.split('.')[0];
      
      // Handle special cases
      if (domain.includes('spotify')) data.provider = 'spotify';
      if (domain.includes('netflix')) data.provider = 'netflix';
      if (domain.includes('youtube')) data.provider = 'youtube';
      if (domain.includes('amazon')) data.provider = 'amazon';
      if (domain.includes('hbo')) data.provider = 'hbo';
      if (domain.includes('disney')) data.provider = 'disney+';
    }
  }

  // Also check subject for provider name if not found in email
  if (!data.provider && emailBody.subject) {
    const subjectLower = emailBody.subject.toLowerCase();
    if (subjectLower.includes('spotify')) data.provider = 'spotify';
    if (subjectLower.includes('netflix')) data.provider = 'netflix';
    if (subjectLower.includes('youtube')) data.provider = 'youtube';
    if (subjectLower.includes('amazon prime')) data.provider = 'amazon';
    if (subjectLower.includes('hbo')) data.provider = 'hbo';
    if (subjectLower.includes('disney+')) data.provider = 'disney+';
  }

  // Combine subject and snippet for better pattern matching
  const fullText = `${emailBody.subject} ${emailBody.snippet}`.toLowerCase();

  // Extract subscription type and price
  for (const pattern of subscriptionPatterns) {
    const match = fullText.match(pattern.pattern);
    if (match) {
      if (pattern.type === 'price' && match[1]) {
        data.price = parseFloat(match[1]);
      } else if (!data.type) {
        data.type = pattern.type;
      }
    }
  }

  // Determine frequency
  if (fullText.includes('yearly') || fullText.includes('annual')) {
    data.frequency = 'yearly';
  } else if (fullText.includes('monthly')) {
    data.frequency = 'monthly';
  }

  return data;
}

// Improved email scanning endpoint
app.get('/api/scan-emails', async (req, res) => {
  const authHeader = req.headers.authorization;
  const gmailToken = req.headers['x-gmail-token'];
  const userId = req.headers['x-user-id'];
  
  console.log('Starting email scan', {
    hasAuthHeader: !!authHeader,
    hasGmailToken: !!gmailToken,
    hasUserId: !!userId,
    origin: req.headers.origin
  });
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid or missing authentication token' });
  }

  if (!gmailToken) {
    return res.status(401).json({ error: 'Missing Gmail token' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'Missing user ID' });
  }

  try {
    await ensureSupabaseConnection();

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: gmailToken });
    
    const gmail = google.gmail({ version: 'v1', auth });

    // Test Gmail API access first
    try {
      await gmail.users.getProfile({ userId: 'me' });
    } catch (error) {
      console.error('Gmail API access error:', error);
      if (error.code === 401) {
        return res.status(401).json({ error: 'Gmail token expired or invalid. Please sign in again.' });
      }
      throw error;
    }

    // List emails with pagination
    let messages = [];
    let nextPageToken = null;
    
    do {
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 100,
        pageToken: nextPageToken,
        q: 'in:anywhere (subject:(subscription OR payment OR receipt OR invoice OR billing OR netflix OR spotify OR amazon OR hbo OR disney) OR from:(netflix.com OR spotify.com OR amazon.com OR hbo.com OR youtube.com OR disneyplus.com))'
      });

      if (!response.data.messages) {
        console.log('No messages found');
        break;
      }

      messages = messages.concat(response.data.messages);
      nextPageToken = response.data.nextPageToken;
      
      console.log(`Retrieved ${messages.length} messages so far`);
    } while (nextPageToken && messages.length < 500); // Limit to 500 emails max

    const subscriptions = [];
    const processedEmails = new Set();

    // Process emails in batches
    const batchSize = 10;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const batchPromises = batch.map(message => 
        gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        })
      );

      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        try {
          const details = result.data;
          const headers = details.payload.headers;
          const emailData = {
            id: details.id,
            subject: headers.find(h => h.name === 'Subject')?.value || 'No Subject',
            from: headers.find(h => h.name === 'From')?.value || 'Unknown',
            date: headers.find(h => h.name === 'Date')?.value || 'Unknown',
            snippet: details.snippet || ''
          };

          const subscriptionData = extractSubscriptionData(emailData);
          
          if (subscriptionData.provider && !processedEmails.has(subscriptionData.provider)) {
            processedEmails.add(subscriptionData.provider);
            subscriptions.push({
              ...subscriptionData,
              user_id: userId,
              email_id: details.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error processing email:', error);
          // Continue with next email instead of failing the entire batch
          continue;
        }
      }
    }

    // Store subscriptions in batches
    if (subscriptions.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < subscriptions.length; i += batchSize) {
        const batch = subscriptions.slice(i, i + batchSize);
        const { error } = await supabase
          .from('subscriptions')
          .upsert(batch, {
            onConflict: 'user_id,provider',
            returning: true
          });

        if (error) {
          console.error('Error storing subscription batch:', error);
          throw new Error('Failed to store subscription data');
        }
      }
    }

    return res.json({ 
      success: true, 
      message: 'Subscriptions processed and stored successfully',
      count: subscriptions.length,
      subscriptions
    });
  } catch (error) {
    console.error('Error in email scan:', error);
    return res.status(500).json({ 
      error: 'Failed to scan emails',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Token exchange endpoint
app.post('/auth/google/token', async (req, res) => {
  try {
    const { code, redirect_uri } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    console.log('Exchanging code for tokens with redirect URI:', redirect_uri);

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', error);
      return res.status(400).json({ error: 'Failed to exchange authorization code for tokens' });
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      hasIdToken: !!tokens.id_token
    });

    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error('Failed to get user info');
    }

    const userInfo = await userResponse.json();
    console.log('User info retrieved:', {
      email: userInfo.email,
      name: userInfo.name
    });

    // Set CORS headers
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    }

    // Return tokens and user info
    res.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      id_token: tokens.id_token,
      user: userInfo
    });
  } catch (error) {
    console.error('Error in token exchange:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 