const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting full deployment process (backend + frontend)...');

// Deploy backend first
try {
  console.log('\n======== DEPLOYING BACKEND API ========\n');
  execSync('node deploy-backend.js', { stdio: 'inherit' });
} catch (error) {
  console.error('Backend deployment failed:', error.message);
  console.log('Skipping frontend deployment due to backend failure.');
  process.exit(1);
}

// Deploy frontend after backend is successful
try {
  console.log('\n======== DEPLOYING FRONTEND ========\n');
  execSync('node deploy-frontend.js', { stdio: 'inherit' });
} catch (error) {
  console.error('Frontend deployment failed:', error.message);
  process.exit(1);
}

console.log('\n======== DEPLOYMENT COMPLETE ========\n');
console.log('Backend API: https://api.quits.cc');
console.log('Frontend: https://www.quits.cc');
console.log('\nIf you need to configure custom domains, use the Vercel dashboard.');
console.log('Remember to set up environment variables in the Vercel project settings!'); 