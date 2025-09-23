const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
require('dotenv').config({ path: '../.env' });

const db = new sqlite3.Database('./cache/customers.db');

// Configuração de APIs
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const POSITIONSTACK_API_KEY = process.env.POSITIONSTACK_API_KEY;

// Função para geocodificar com Google Maps
async function geocodeWithGoogle(address, cep) {
  try {
    const query = cep ? `${cep}, Brasil` : `${address}, Brasil`;
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
      params: {
        address: query,
        key: GOOGLE_API_KEY,
        region: 'br',
        language: 'pt-BR'
      },
      timeout: 5000
    });

    if (response.data.results && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
        provider: 'google',
        precision: 'high'
      };
    }
  } catch (error) {
    console.error('Google Maps error:', error.message);
  }
  return null;
}

// Função para geocodificar com PositionStack
async function geocodeWithPositionStack(address, cep) {
  try {
    const query = cep ? `${cep}, Brasil` : `${address}, Brasil`;
    const response = await axios.get('http://api.positionstack.com/v1/forward', {
      params: {
        access_key: POSITIONSTACK_API_KEY,
        query: query,
        country: 'BR',
        limit: 1
      },
      timeout: 5000
    });

    if (response.data.data && response.data.data.length > 0) {
      const result = response.data.data[0];
      return {
        lat: result.latitude,
        lng: result.longitude,
        provider: 'positionstack',
        precision: 'high'
      };
    }
  } catch (error) {
    console.error('PositionStack error:', error.message);
  }
  return null;
}

// Função para geocodificar com serviços brasileiros gratuitos
async function geocodeWithBrazilianServices(cep) {
  if (!cep) return null;

  const services = [
    {
      name: 'viacep',
      url: `https://viacep.com.br/ws/${cep}/json/`,
      parser: (data) => {
        if (data.erro) return null;
        // ViaCEP não retorna coordenadas, apenas endereço
        return null;
      }
    },
    {
      name: 'opencep',
      url: `https://opencep.com/v1/${cep}`,
      parser: (data) => {
        if (data.lat && data.lng) {
          return { lat: parseFloat(data.lat), lng: parseFloat(data.lng), provider: 'opencep', precision: 'medium' };
        }
        return null;
      }
    },
    {
      name: 'awesomeapi',
      url: `https://cep.awesomeapi.com.br/json/${cep}`,
      parser: (data) => {
        if (data.lat && data.lng) {
          return { lat: parseFloat(data.lat), lng: parseFloat(data.lng), provider: 'awesomeapi', precision: 'medium' };
        }
        return null;
      }
    }
  ];

  for (const service of services) {
    try {
      const response = await axios.get(service.url, { timeout: 3000 });
      const result = service.parser(response.data);
      if (result) return result;
    } catch (error) {
      continue;
    }
  }

  return null;
}

// Função para estimar coordenadas baseadas na cidade
async function estimateCoordinates(city, state) {
  const cityCoordinates = {
    'fortaleza': { lat: -3.7327, lng: -38.5270 },
    'caucaia': { lat: -3.7361, lng: -38.6530 },
    'maracanau': { lat: -3.8767, lng: -38.6256 },
    'eusebio': { lat: -3.8901, lng: -38.4506 },
    'aquiraz': { lat: -3.9014, lng: -38.3906 },
    'pacatuba': { lat: -3.9840, lng: -38.6200 },
    'horizonte': { lat: -4.0969, lng: -38.4953 },
    'sao goncalo do amarante': { lat: -3.6078, lng: -38.9689 },
    'itaitinga': { lat: -3.9694, lng: -38.5281 },
    'maranguape': { lat: -3.8908, lng: -38.6850 },
    'pacajus': { lat: -4.1725, lng: -38.4606 },
    'cascavel': { lat: -4.1331, lng: -38.2422 }
  };

  const normalizedCity = city?.toLowerCase().trim();
  if (cityCoordinates[normalizedCity]) {
    // Adiciona pequena variação aleatória para não sobrepor pins
    const variation = 0.005;
    return {
      lat: cityCoordinates[normalizedCity].lat + (Math.random() - 0.5) * variation,
      lng: cityCoordinates[normalizedCity].lng + (Math.random() - 0.5) * variation,
      provider: 'estimated',
      precision: 'low'
    };
  }

  // Coordenadas padrão para Ceará
  return {
    lat: -3.7327 + (Math.random() - 0.5) * 0.1,
    lng: -38.5270 + (Math.random() - 0.5) * 0.1,
    provider: 'default',
    precision: 'very_low'
  };
}

// Função principal de geocodificação
async function geocodeAddress(customer) {
  const { address, cep, city, state } = customer;
  
  // Tenta com Google Maps primeiro
  if (GOOGLE_API_KEY) {
    const googleResult = await geocodeWithGoogle(address, cep);
    if (googleResult) return googleResult;
  }

  // Tenta com PositionStack
  if (POSITIONSTACK_API_KEY) {
    const positionStackResult = await geocodeWithPositionStack(address, cep);
    if (positionStackResult) return positionStackResult;
  }

  // Tenta serviços brasileiros gratuitos
  if (cep) {
    const brazilianResult = await geocodeWithBrazilianServices(cep);
    if (brazilianResult) return brazilianResult;
  }

  // Estima baseado na cidade
  return await estimateCoordinates(city, state);
}

// Processa lote de clientes
async function processBatch(customers) {
  const promises = customers.map(async (customer) => {
    try {
      const coords = await geocodeAddress(customer);
      
      return new Promise((resolve) => {
        db.run(
          `UPDATE customers 
           SET latitude = ?, longitude = ?, geocoding_status = ?, geocoding_provider = ?, geocoding_precision = ?, geocoded_at = ?
           WHERE id = ?`,
          [coords.lat, coords.lng, 'success', coords.provider, coords.precision, new Date().toISOString(), customer.id],
          (err) => {
            if (err) {
              console.error(`Erro ao atualizar cliente ${customer.id}:`, err);
              resolve({ id: customer.id, status: 'error' });
            } else {
              console.log(`✓ Cliente ${customer.id} geocodificado (${coords.provider})`);
              resolve({ id: customer.id, status: 'success', provider: coords.provider });
            }
          }
        );
      });
    } catch (error) {
      console.error(`Erro ao geocodificar cliente ${customer.id}:`, error.message);
      return { id: customer.id, status: 'error' };
    }
  });

  return Promise.all(promises);
}

// Função principal
async function geocodeAll() {
  console.log('🚀 Iniciando geocodificação rápida em paralelo...\n');

  return new Promise((resolve, reject) => {
    // Busca todos os clientes que precisam de geocodificação
    db.all(
      `SELECT id, full_address as address, cep, city, state 
       FROM customers 
       WHERE (latitude IS NULL OR longitude IS NULL OR geocoding_status != 'success')
       ORDER BY id`,
      async (err, customers) => {
        if (err) {
          console.error('Erro ao buscar clientes:', err);
          reject(err);
          return;
        }

        console.log(`📍 Total de clientes para geocodificar: ${customers.length}\n`);

        if (customers.length === 0) {
          console.log('✅ Todos os clientes já estão geocodificados!');
          resolve();
          return;
        }

        // Processa em lotes de 50 clientes por vez
        const batchSize = 50;
        const batches = [];
        
        for (let i = 0; i < customers.length; i += batchSize) {
          batches.push(customers.slice(i, i + batchSize));
        }

        console.log(`📦 Processando em ${batches.length} lotes de até ${batchSize} clientes\n`);

        let totalProcessed = 0;
        const stats = {
          success: 0,
          error: 0,
          providers: {}
        };

        // Processa os lotes sequencialmente
        for (let i = 0; i < batches.length; i++) {
          console.log(`\n🔄 Processando lote ${i + 1}/${batches.length}...`);
          
          const results = await processBatch(batches[i]);
          
          results.forEach(result => {
            totalProcessed++;
            if (result.status === 'success') {
              stats.success++;
              stats.providers[result.provider] = (stats.providers[result.provider] || 0) + 1;
            } else {
              stats.error++;
            }
          });

          // Mostra progresso
          const progress = ((totalProcessed / customers.length) * 100).toFixed(1);
          console.log(`📊 Progresso: ${totalProcessed}/${customers.length} (${progress}%)`);
          console.log(`   ✅ Sucesso: ${stats.success} | ❌ Erro: ${stats.error}`);
        }

        // Mostra estatísticas finais
        console.log('\n' + '='.repeat(50));
        console.log('📈 ESTATÍSTICAS FINAIS:');
        console.log('='.repeat(50));
        console.log(`✅ Geocodificados com sucesso: ${stats.success}`);
        console.log(`❌ Erros: ${stats.error}`);
        console.log('\n📍 Por provedor:');
        Object.entries(stats.providers).forEach(([provider, count]) => {
          console.log(`   ${provider}: ${count}`);
        });

        // Mostra total geral
        db.get(
          `SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN latitude IS NOT NULL AND longitude IS NOT NULL THEN 1 END) as geocoded,
            COUNT(CASE WHEN geocoding_precision = 'high' THEN 1 END) as high_precision,
            COUNT(CASE WHEN geocoding_precision = 'medium' THEN 1 END) as medium_precision,
            COUNT(CASE WHEN geocoding_precision = 'low' THEN 1 END) as low_precision,
            COUNT(CASE WHEN geocoding_precision = 'very_low' THEN 1 END) as very_low_precision
          FROM customers`,
          (err, row) => {
            if (!err && row) {
              console.log('\n' + '='.repeat(50));
              console.log('📊 RESUMO GERAL DO BANCO:');
              console.log('='.repeat(50));
              console.log(`Total de clientes: ${row.total}`);
              console.log(`Geocodificados: ${row.geocoded} (${((row.geocoded/row.total)*100).toFixed(1)}%)`);
              console.log('\nPrecisão:');
              console.log(`  🎯 Alta: ${row.high_precision}`);
              console.log(`  🔵 Média: ${row.medium_precision}`);
              console.log(`  🟡 Baixa: ${row.low_precision}`);
              console.log(`  ⚪ Muito baixa: ${row.very_low_precision}`);
            }
            
            console.log('\n✅ Geocodificação concluída!');
            db.close();
            resolve();
          }
        );
      }
    );
  });
}

// Executa
geocodeAll().catch(console.error);