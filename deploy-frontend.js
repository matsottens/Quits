const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting frontend deployment...');

// Frontend root directory (current directory)
const frontendDir = __dirname;

// Check if package.json exists in frontend directory
if (!fs.existsSync(path.join(frontendDir, 'package.json'))) {
  console.error('Error: package.json not found in frontend directory');
  process.exit(1);
}

// Check if vercel.json exists
if (!fs.existsSync(path.join(frontendDir, 'vercel.json'))) {
  console.error('Error: vercel.json not found in frontend directory');
  process.exit(1);
}

// Make sure we're in the frontend directory
process.chdir(frontendDir);

try {
  // Install dependencies
  console.log('\nInstalling dependencies...');
  execSync('npm install', { stdio: 'inherit' });
  
  // Build the project
  console.log('\nBuilding the project...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Deploy to Vercel
  console.log('\nDeploying frontend to Vercel...');
  execSync('npx vercel --prod', { stdio: 'inherit' });
  
  console.log('\nFrontend deployment completed successfully!');
  console.log('Your frontend should now be available at: https://www.quits.cc');
} catch (error) {
  console.error('Deployment failed:', error.message);
  process.exit(1);
} 