const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting backend API deployment...');

// Directory paths
const backendDir = path.join(__dirname, 'quits-backend', 'api');

// Verify backend directory exists
if (!fs.existsSync(backendDir)) {
  console.error(`Error: Backend directory not found at ${backendDir}`);
  process.exit(1);
}

// Deploy to Vercel
try {
  console.log('\nDeploying backend to Vercel...');
  
  // Change to backend directory
  process.chdir(backendDir);
  
  // Run deployment
  execSync('npx vercel --prod', { stdio: 'inherit' });
  
  console.log('\nBackend deployment completed successfully!');
  console.log('Your API should now be available at: https://api.quits.cc');
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
} 