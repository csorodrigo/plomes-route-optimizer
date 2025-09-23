#!/usr/bin/env node

// EMERGENCY DEPLOYMENT SCRIPT - Recreate Railway project
const https = require('https');
const fs = require('fs');

const TOKEN = '98cf6cc6-aa53-4a78-b993-a9b048137f45';

console.log('🚨 EMERGENCY RAILWAY DEPLOYMENT SCRIPT');
console.log('====================================');
console.log('Creating new Railway project for PLOMES-ROTA-CEP...');

// Step 1: Create new project
const createProjectMutation = `
  mutation CreateProject($input: ProjectCreateInput!) {
    projectCreate(input: $input) {
      id
      name
      slug
    }
  }
`;

const projectInput = {
  name: 'plomes-rota-cep-emergency',
  description: 'Emergency deployment of Portuguese route optimizer',
  isPublic: false
};

function makeRequest(query, variables) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });

    const options = {
      hostname: 'api.railway.app',
      port: 443,
      path: '/graphql',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.errors) {
            reject(new Error(JSON.stringify(result.errors)));
          } else {
            resolve(result.data);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function createEmergencyDeployment() {
  try {
    console.log('🏗️ Creating new Railway project...');

    const projectResult = await makeRequest(createProjectMutation, { input: projectInput });

    if (projectResult.projectCreate) {
      const project = projectResult.projectCreate;
      console.log(`✅ Project created: ${project.name} (${project.id})`);

      // Update local configuration
      const newConfig = {
        project: project.id,
        environment: null, // Will be set later
        service: null // Will be set later
      };

      // Create .railway directory if it doesn't exist
      if (!fs.existsSync('.railway')) {
        fs.mkdirSync('.railway');
      }

      // Update config
      fs.writeFileSync('.railway/config.yaml',
        `project: ${project.id}\n# Emergency deployment created at ${new Date().toISOString()}\n`
      );

      console.log('✅ Local configuration updated');
      console.log('🚀 Ready for service deployment');
      console.log(`📋 Project ID: ${project.id}`);
      console.log('');
      console.log('Next steps:');
      console.log('1. Run: railway link');
      console.log('2. Run: railway up');
      console.log('3. Configure environment variables');

      return project;

    } else {
      throw new Error('Failed to create project');
    }

  } catch (error) {
    console.error('❌ Emergency deployment failed:', error.message);
    console.log('');
    console.log('Alternative solutions:');
    console.log('1. Use Vercel: vercel --prod');
    console.log('2. Use Netlify: netlify deploy --prod');
    console.log('3. Use GitHub Pages with Actions');
    console.log('4. Use Heroku: git push heroku main');

    throw error;
  }
}

createEmergencyDeployment().catch(console.error);