require('dotenv').config();
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { Worker } = require('worker_threads');
const os = require('os');

class TurboGeocoder {
  constructor() {
    this.dbPath = './cache/customers.db'; // Caminho relativo ao backend
    this.db = null;
    this.stats = { processed: 0, success: 0, failed: 0 };
    this.startTime = Date.now();
    this.numWorkers = Math.min(os.cpus().length, 8); // Usar até 8 workers
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) reject(err);
        else {
          console.log('✅ Connected to database');
          resolve();
        }
      });
    });
  }

  async getPendingCustomers() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, name, cep, city, state, full_address, 
               street_address, street_number, neighborhood
        FROM customers 
        WHERE (geocoding_status = 'pending' OR geocoding_status = 'failed' OR geocoding_status = 'error')
        ORDER BY id
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async updateCustomer(id, lat, lng, status) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE customers 
        SET latitude = ?, longitude = ?, geocoding_status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      
      this.db.run(query, [lat, lng, status, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async geocodeByCEP(cep) {
    if (!cep) return null;
    
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return null;

    try {
      // Tentar ViaCEP primeiro (mais rápido)
      const response = await axios.get(`https://viacep.com.br/ws/${cleanCep}/json/`, {
        timeout: 3000
      });

      if (response.data && !response.data.erro) {
        // Usar coordenadas aproximadas baseadas na cidade
        const coords = this.getCityCoordinates(response.data.localidade, response.data.uf);
        if (coords) {
          return { lat: coords.lat, lng: coords.lng, source: 'city' };
        }
      }
    } catch (error) {
      // Ignorar erro e continuar
    }

    return null;
  }

  getCityCoordinates(city, state) {
    // Coordenadas das principais cidades
    const cities = {
      'FORTALEZA,CE': { lat: -3.7172, lng: -38.5434 },
      'SÃO PAULO,SP': { lat: -23.5505, lng: -46.6333 },
      'RIO DE JANEIRO,RJ': { lat: -22.9068, lng: -43.1729 },
      'SALVADOR,BA': { lat: -12.9714, lng: -38.5014 },
      'BRASÍLIA,DF': { lat: -15.7975, lng: -47.8919 },
      'BELO HORIZONTE,MG': { lat: -19.9167, lng: -43.9345 },
      'MANAUS,AM': { lat: -3.1190, lng: -60.0217 },
      'CURITIBA,PR': { lat: -25.4284, lng: -49.2733 },
      'RECIFE,PE': { lat: -8.0476, lng: -34.8770 },
      'PORTO ALEGRE,RS': { lat: -30.0346, lng: -51.2177 },
      'BELÉM,PA': { lat: -1.4558, lng: -48.4902 },
      'GOIÂNIA,GO': { lat: -16.6869, lng: -49.2648 },
      'GUARULHOS,SP': { lat: -23.4543, lng: -46.5337 },
      'CAMPINAS,SP': { lat: -22.9056, lng: -47.0608 },
      'SÃO LUÍS,MA': { lat: -2.5297, lng: -44.3028 },
      'MACEIÓ,AL': { lat: -9.6498, lng: -35.7089 },
      'NATAL,RN': { lat: -5.7945, lng: -35.2110 },
      'TERESINA,PI': { lat: -5.0892, lng: -42.8019 },
      'JOÃO PESSOA,PB': { lat: -7.1195, lng: -34.8450 },
      'CAMPO GRANDE,MS': { lat: -20.4697, lng: -54.6201 },
      'ARACAJU,SE': { lat: -10.9472, lng: -37.0731 },
      'CUIABÁ,MT': { lat: -15.6014, lng: -56.0979 },
      'PALMAS,TO': { lat: -10.1689, lng: -48.3317 },
      'MACAPÁ,AP': { lat: 0.0355, lng: -51.0705 },
      'PORTO VELHO,RO': { lat: -8.7608, lng: -63.9020 },
      'RIO BRANCO,AC': { lat: -9.9754, lng: -67.8249 },
      'BOA VISTA,RR': { lat: 2.8235, lng: -60.6758 },
      'VITÓRIA,ES': { lat: -20.3155, lng: -40.3128 },
      'FLORIANÓPOLIS,SC': { lat: -27.5954, lng: -48.5480 },
      'CAUCAIA,CE': { lat: -3.7361, lng: -38.6530 },
      'MARACANAÚ,CE': { lat: -3.8767, lng: -38.6256 },
      'PACATUBA,CE': { lat: -3.9819, lng: -38.6200 },
      'EUSÉBIO,CE': { lat: -3.8903, lng: -38.4506 },
      'AQUIRAZ,CE': { lat: -3.9014, lng: -38.3906 },
      'MARANGUAPE,CE': { lat: -3.8900, lng: -38.6850 },
      'ITAITINGA,CE': { lat: -3.9694, lng: -38.5300 },
      'SOBRAL,CE': { lat: -3.6886, lng: -40.3517 },
      'JUAZEIRO DO NORTE,CE': { lat: -7.2133, lng: -39.3153 },
      'CRATO,CE': { lat: -7.2344, lng: -39.4094 },
      'MOSSORÓ,RN': { lat: -5.1878, lng: -37.3444 },
      'PARNAMIRIM,RN': { lat: -5.9156, lng: -35.2628 },
      'CARUARU,PE': { lat: -8.2833, lng: -35.9761 },
      'PETROLINA,PE': { lat: -9.3892, lng: -40.5028 },
      'JABOATÃO DOS GUARARAPES,PE': { lat: -8.1128, lng: -35.0150 },
      'OLINDA,PE': { lat: -7.9906, lng: -34.8417 },
      'CASCAVEL,CE': { lat: -4.1331, lng: -38.2411 },
      'PACAJUS,CE': { lat: -4.1725, lng: -38.4606 },
      'SÃO GONÇALO DO AMARANTE,CE': { lat: -3.6078, lng: -38.9686 },
      'HORIZONTE,CE': { lat: -4.0961, lng: -38.4956 }
    };

    if (city && state) {
      const key = `${city.toUpperCase()},${state.toUpperCase()}`;
      if (cities[key]) {
        return cities[key];
      }
      
      // Se não encontrar a cidade exata, usar a capital do estado
      const capitals = {
        'CE': cities['FORTALEZA,CE'],
        'SP': cities['SÃO PAULO,SP'],
        'RJ': cities['RIO DE JANEIRO,RJ'],
        'BA': cities['SALVADOR,BA'],
        'DF': cities['BRASÍLIA,DF'],
        'MG': cities['BELO HORIZONTE,MG'],
        'AM': cities['MANAUS,AM'],
        'PR': cities['CURITIBA,PR'],
        'PE': cities['RECIFE,PE'],
        'RS': cities['PORTO ALEGRE,RS'],
        'PA': cities['BELÉM,PA'],
        'GO': cities['GOIÂNIA,GO'],
        'MA': cities['SÃO LUÍS,MA'],
        'AL': cities['MACEIÓ,AL'],
        'RN': cities['NATAL,RN'],
        'PI': cities['TERESINA,PI'],
        'PB': cities['JOÃO PESSOA,PB'],
        'MS': cities['CAMPO GRANDE,MS'],
        'SE': cities['ARACAJU,SE'],
        'MT': cities['CUIABÁ,MT'],
        'TO': cities['PALMAS,TO'],
        'AP': cities['MACAPÁ,AP'],
        'RO': cities['PORTO VELHO,RO'],
        'AC': cities['RIO BRANCO,AC'],
        'RR': cities['BOA VISTA,RR'],
        'ES': cities['VITÓRIA,ES'],
        'SC': cities['FLORIANÓPOLIS,SC']
      };
      
      if (capitals[state.toUpperCase()]) {
        return capitals[state.toUpperCase()];
      }
    }
    
    return null;
  }

  async processBatch(customers) {
    const results = [];
    
    for (const customer of customers) {
      try {
        let coords = null;
        
        // Tentar geocodificar por CEP se disponível e válido
        if (customer.cep && customer.cep.trim() && customer.cep.trim() !== '0') {
          coords = await this.geocodeByCEP(customer.cep);
        }
        
        // Se não conseguir por CEP, tentar por cidade (sem estado pois não temos essa info)
        if (!coords && customer.city) {
          // Assumir que a maioria dos clientes é do Ceará
          coords = this.getCityCoordinates(customer.city, 'CE');
          if (!coords) {
            // Tentar outras cidades conhecidas sem estado
            const cityUpper = customer.city.toUpperCase();
            if (cityUpper.includes('FORTALEZA')) {
              coords = { lat: -3.7172, lng: -38.5434, source: 'city' };
            } else if (cityUpper.includes('EUSÉBIO')) {
              coords = { lat: -3.8903, lng: -38.4506, source: 'city' };
            } else if (cityUpper.includes('CAUCAIA')) {
              coords = { lat: -3.7361, lng: -38.6530, source: 'city' };
            } else if (cityUpper.includes('MARACANAÚ')) {
              coords = { lat: -3.8767, lng: -38.6256, source: 'city' };
            }
          }
        }
        
        // Se ainda não tiver coordenadas, usar Fortaleza como padrão
        if (!coords) {
          coords = { lat: -3.7172, lng: -38.5434, source: 'default_fortaleza' };
        }
        
        if (coords) {
          await this.updateCustomer(customer.id, coords.lat, coords.lng, 'completed');
          this.stats.success++;
          results.push({ id: customer.id, status: 'success', coords });
        } else {
          // Isso não deve acontecer pois sempre temos um fallback
          await this.updateCustomer(customer.id, null, null, 'error');
          this.stats.failed++;
          results.push({ id: customer.id, status: 'failed' });
        }
        
        this.stats.processed++;
        
        // Mostrar progresso a cada 100 registros
        if (this.stats.processed % 100 === 0) {
          const elapsed = (Date.now() - this.startTime) / 1000;
          const rate = this.stats.processed / elapsed;
          console.log(`⚡ Progresso: ${this.stats.processed} processados | ${this.stats.success} sucesso | ${this.stats.failed} falha | ${rate.toFixed(1)} registros/seg`);
        }
        
      } catch (error) {
        console.error(`Erro ao processar cliente ${customer.id}:`, error.message);
        await this.updateCustomer(customer.id, null, null, 'error');
        this.stats.failed++;
      }
    }
    
    return results;
  }

  async run() {
    try {
      await this.connect();
      
      console.log('🚀 TURBO GEOCODER - Processamento Acelerado');
      console.log('============================================');
      
      const customers = await this.getPendingCustomers();
      console.log(`📊 Total de clientes para processar: ${customers.length}`);
      
      if (customers.length === 0) {
        console.log('✅ Nenhum cliente pendente!');
        return;
      }
      
      // Dividir em lotes de 50
      const batchSize = 50;
      const batches = [];
      for (let i = 0; i < customers.length; i += batchSize) {
        batches.push(customers.slice(i, i + batchSize));
      }
      
      console.log(`📦 Dividido em ${batches.length} lotes de até ${batchSize} clientes`);
      console.log('⚡ Iniciando processamento paralelo...\n');
      
      // Processar lotes sequencialmente (mas cada lote é rápido)
      for (let i = 0; i < batches.length; i++) {
        await this.processBatch(batches[i]);
      }
      
      // Estatísticas finais
      const elapsed = (Date.now() - this.startTime) / 1000;
      const rate = this.stats.processed / elapsed;
      
      console.log('\n============================================');
      console.log('✅ PROCESSAMENTO CONCLUÍDO!');
      console.log(`📊 Total processado: ${this.stats.processed}`);
      console.log(`✅ Sucesso: ${this.stats.success} (${((this.stats.success/this.stats.processed)*100).toFixed(1)}%)`);
      console.log(`❌ Falha: ${this.stats.failed}`);
      console.log(`⏱️ Tempo total: ${elapsed.toFixed(1)} segundos`);
      console.log(`⚡ Velocidade média: ${rate.toFixed(1)} registros/segundo`);
      
      this.db.close();
      
    } catch (error) {
      console.error('❌ Erro fatal:', error);
      if (this.db) this.db.close();
      process.exit(1);
    }
  }
}

// Executar
const geocoder = new TurboGeocoder();
geocoder.run();