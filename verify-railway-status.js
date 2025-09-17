#!/usr/bin/env node

// Script para verificar status do Railway usando API GraphQL
const https = require('https');

const TOKEN = '98cf6cc6-aa53-4a78-b993-a9b048137f45';
const PROJECT_ID = '799c5228-83f4-4c93-ba9e-9794f1f169be';
const SERVICE_ID = 'f2b3dfb0-c206-4405-9317-53dffad8bf4c';
const ENV_ID = 'b6eb9d54-a8be-4bef-a582-a1297567a074';

console.log('🔍 Verificando status do Railway...');
console.log(`📋 Project ID: ${PROJECT_ID}`);
console.log(`🔧 Service ID: ${SERVICE_ID}`);
console.log(`🌍 Environment ID: ${ENV_ID}`);

// Query para verificar o projeto
const query = `
  query GetProject($projectId: String!) {
    project(id: $projectId) {
      id
      name
      services {
        edges {
          node {
            id
            name
            deployments(first: 3) {
              edges {
                node {
                  id
                  status
                  createdAt
                  url
                }
              }
            }
          }
        }
      }
      environments {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  }
`;

const data = JSON.stringify({
  query: query,
  variables: { projectId: PROJECT_ID }
});

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

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(responseData);

      if (result.errors) {
        console.error('❌ GraphQL Errors:', result.errors);
        return;
      }

      const project = result.data?.project;
      if (!project) {
        console.error('❌ Projeto não encontrado ou sem acesso');
        return;
      }

      console.log('\n✅ Projeto encontrado:');
      console.log(`   Nome: ${project.name}`);

      console.log('\n📊 Ambientes:');
      project.environments.edges.forEach(env => {
        const isActive = env.node.id === ENV_ID;
        console.log(`   ${isActive ? '👉' : '  '} ${env.node.name} (${env.node.id})`);
      });

      console.log('\n🚀 Serviços:');
      project.services.edges.forEach(service => {
        const isOur = service.node.id === SERVICE_ID;
        console.log(`   ${isOur ? '👉' : '  '} ${service.node.name} (${service.node.id})`);

        if (service.node.deployments.edges.length > 0) {
          console.log('      📋 Últimos deployments:');
          service.node.deployments.edges.forEach(deploy => {
            const date = new Date(deploy.node.createdAt).toLocaleString('pt-BR');
            console.log(`         ${deploy.node.status} - ${date}`);
            if (deploy.node.url) {
              console.log(`         🔗 URL: ${deploy.node.url}`);
            }
          });
        }
      });

    } catch (error) {
      console.error('❌ Erro ao parsear resposta:', error.message);
      console.log('Resposta bruta:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Erro na requisição:', error.message);
});

req.write(data);
req.end();