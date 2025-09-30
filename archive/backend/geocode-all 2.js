const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');
const path = require('path');

// Abrir conexão com o banco
const dbPath = path.join(__dirname, 'cache', 'customers.db');
const db = new sqlite3.Database(dbPath);

// Função para geocodificar usando múltiplos serviços
async function geocodeByCep(cep) {
    const cleanCep = cep.replace(/\D/g, '');
    
    // Tentar ViaCEP primeiro
    try {
        const response = await axios.get(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (response.data && !response.data.erro) {
            // Usar coordenadas aproximadas baseadas na cidade
            const coords = getCityCoordinates(response.data.localidade, response.data.uf);
            if (coords) {
                return coords;
            }
        }
    } catch (error) {
        console.log(`ViaCEP error for ${cep}: ${error.message}`);
    }
    
    // Tentar BrasilAPI
    try {
        const response = await axios.get(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
        if (response.data) {
            const coords = getCityCoordinates(response.data.city, response.data.state);
            if (coords) {
                return coords;
            }
        }
    } catch (error) {
        console.log(`BrasilAPI error for ${cep}: ${error.message}`);
    }
    
    return null;
}

// Coordenadas aproximadas das principais cidades
function getCityCoordinates(city, state) {
    const cities = {
        'Fortaleza,CE': { lat: -3.7172, lng: -38.5434 },
        'São Paulo,SP': { lat: -23.5505, lng: -46.6333 },
        'Rio de Janeiro,RJ': { lat: -22.9068, lng: -43.1729 },
        'Brasília,DF': { lat: -15.7801, lng: -47.9292 },
        'Salvador,BA': { lat: -12.9714, lng: -38.5014 },
        'Belo Horizonte,MG': { lat: -19.9191, lng: -43.9387 },
        'Curitiba,PR': { lat: -25.4284, lng: -49.2733 },
        'Recife,PE': { lat: -8.0476, lng: -34.8770 },
        'Porto Alegre,RS': { lat: -30.0346, lng: -51.2177 },
        'Manaus,AM': { lat: -3.1019, lng: -60.0250 },
        'Belém,PA': { lat: -1.4558, lng: -48.4902 },
        'Goiânia,GO': { lat: -16.6869, lng: -49.2648 },
        'Guarulhos,SP': { lat: -23.4538, lng: -46.5333 },
        'Campinas,SP': { lat: -22.9056, lng: -47.0608 },
        'São Luís,MA': { lat: -2.5297, lng: -44.3028 },
        'São Gonçalo,RJ': { lat: -22.8268, lng: -43.0539 },
        'Maceió,AL': { lat: -9.6658, lng: -35.7353 },
        'Duque de Caxias,RJ': { lat: -22.7858, lng: -43.3119 },
        'Natal,RN': { lat: -5.7945, lng: -35.2110 },
        'Campo Grande,MS': { lat: -20.4697, lng: -54.6201 },
        'Teresina,PI': { lat: -5.0892, lng: -42.8019 },
        'São Bernardo do Campo,SP': { lat: -23.6940, lng: -46.5653 },
        'João Pessoa,PB': { lat: -7.1195, lng: -34.8450 },
        'Nova Iguaçu,RJ': { lat: -22.7556, lng: -43.4603 },
        'Santo André,SP': { lat: -23.6737, lng: -46.5432 },
        'Osasco,SP': { lat: -23.5329, lng: -46.7917 },
        'São José dos Campos,SP': { lat: -23.1791, lng: -45.8872 },
        'Jaboatão dos Guararapes,PE': { lat: -8.1130, lng: -35.0148 },
        'Ribeirão Preto,SP': { lat: -21.1767, lng: -47.8103 },
        'Uberlândia,MG': { lat: -18.9186, lng: -48.2772 },
        'Sorocaba,SP': { lat: -23.5015, lng: -47.4526 },
        'Contagem,MG': { lat: -19.9321, lng: -44.0539 },
        'Aracaju,SE': { lat: -10.9472, lng: -37.0731 },
        'Feira de Santana,BA': { lat: -12.2666, lng: -38.9663 },
        'Cuiabá,MT': { lat: -15.5989, lng: -56.0949 },
        'Joinville,SC': { lat: -26.3044, lng: -48.8456 },
        'Aparecida de Goiânia,GO': { lat: -16.8234, lng: -49.2437 },
        'Londrina,PR': { lat: -23.3045, lng: -51.1696 },
        'Juiz de Fora,MG': { lat: -21.7642, lng: -43.3503 },
        'Ananindeua,PA': { lat: -1.3655, lng: -48.3721 },
        'Niterói,RJ': { lat: -22.8833, lng: -43.1036 },
        'Porto Velho,RO': { lat: -8.7619, lng: -63.9039 },
        'Florianópolis,SC': { lat: -27.5954, lng: -48.5480 },
        'Santos,SP': { lat: -23.9608, lng: -46.3336 },
        'Diadema,SP': { lat: -23.6863, lng: -46.6204 },
        'Vila Velha,ES': { lat: -20.3297, lng: -40.2925 },
        'Serra,ES': { lat: -20.1209, lng: -40.3077 },
        'Caxias do Sul,RS': { lat: -29.1678, lng: -51.1794 },
        'São José do Rio Preto,SP': { lat: -20.8112, lng: -49.3755 },
        'Macapá,AP': { lat: 0.0356, lng: -51.0705 },
        'Vitória,ES': { lat: -20.3155, lng: -40.3128 },
        'Caucaia,CE': { lat: -3.7361, lng: -38.6531 },
        'Maracanaú,CE': { lat: -3.8767, lng: -38.6256 },
        'Eusébio,CE': { lat: -3.8901, lng: -38.4511 },
        'Aquiraz,CE': { lat: -3.9010, lng: -38.3911 }
    };
    
    const key = `${city},${state}`;
    if (cities[key]) {
        return cities[key];
    }
    
    // Se não encontrar a cidade exata, usar a capital do estado
    const stateCapitals = {
        'CE': { lat: -3.7172, lng: -38.5434 }, // Fortaleza
        'SP': { lat: -23.5505, lng: -46.6333 }, // São Paulo
        'RJ': { lat: -22.9068, lng: -43.1729 }, // Rio de Janeiro
        'MG': { lat: -19.9191, lng: -43.9387 }, // Belo Horizonte
        'BA': { lat: -12.9714, lng: -38.5014 }, // Salvador
        'PR': { lat: -25.4284, lng: -49.2733 }, // Curitiba
        'RS': { lat: -30.0346, lng: -51.2177 }, // Porto Alegre
        'PE': { lat: -8.0476, lng: -34.8770 },  // Recife
        'SC': { lat: -27.5954, lng: -48.5480 }, // Florianópolis
        'GO': { lat: -16.6869, lng: -49.2648 }, // Goiânia
        'PB': { lat: -7.1195, lng: -34.8450 },  // João Pessoa
        'MA': { lat: -2.5297, lng: -44.3028 },  // São Luís
        'PA': { lat: -1.4558, lng: -48.4902 },  // Belém
        'ES': { lat: -20.3155, lng: -40.3128 }, // Vitória
        'RN': { lat: -5.7945, lng: -35.2110 },  // Natal
        'AL': { lat: -9.6658, lng: -35.7353 },  // Maceió
        'PI': { lat: -5.0892, lng: -42.8019 },  // Teresina
        'DF': { lat: -15.7801, lng: -47.9292 }, // Brasília
        'SE': { lat: -10.9472, lng: -37.0731 }, // Aracaju
        'MT': { lat: -15.5989, lng: -56.0949 }, // Cuiabá
        'MS': { lat: -20.4697, lng: -54.6201 }, // Campo Grande
        'RO': { lat: -8.7619, lng: -63.9039 },  // Porto Velho
        'AC': { lat: -9.9781, lng: -67.8117 },  // Rio Branco
        'AM': { lat: -3.1019, lng: -60.0250 },  // Manaus
        'RR': { lat: 2.8235, lng: -60.6758 },   // Boa Vista
        'AP': { lat: 0.0356, lng: -51.0705 },   // Macapá
        'TO': { lat: -10.2491, lng: -48.3243 }  // Palmas
    };
    
    return stateCapitals[state] || null;
}

async function geocodeAllCustomers() {
    console.log('🚀 Starting batch geocoding...');
    
    // Buscar clientes sem coordenadas
    const query = `
        SELECT id, name, cep, city, state 
        FROM customers 
        WHERE (latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0)
        AND cep IS NOT NULL AND cep != ''
        LIMIT 5000
    `;
    
    db.all(query, async (err, rows) => {
        if (err) {
            console.error('Error fetching customers:', err);
            return;
        }
        
        console.log(`Found ${rows.length} customers to geocode`);
        
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < rows.length; i++) {
            const customer = rows[i];
            
            // Progress indicator
            if (i % 100 === 0) {
                console.log(`Progress: ${i}/${rows.length} (${successCount} geocoded, ${errorCount} errors)`);
            }
            
            try {
                // Tentar geocodificar
                const coords = await geocodeByCep(customer.cep);
                
                if (coords) {
                    // Atualizar banco com coordenadas
                    await new Promise((resolve, reject) => {
                        db.run(
                            `UPDATE customers 
                             SET latitude = ?, longitude = ?, geocoding_status = 'completed', geocoded_at = datetime('now')
                             WHERE id = ?`,
                            [coords.lat, coords.lng, customer.id],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    });
                    successCount++;
                } else {
                    // Marcar como falha
                    await new Promise((resolve, reject) => {
                        db.run(
                            `UPDATE customers 
                             SET geocoding_status = 'failed', geocoded_at = datetime('now')
                             WHERE id = ?`,
                            [customer.id],
                            (err) => {
                                if (err) reject(err);
                                else resolve();
                            }
                        );
                    });
                    errorCount++;
                }
                
                // Pequeno delay para não sobrecarregar APIs
                await new Promise(resolve => setTimeout(resolve, 50));
                
            } catch (error) {
                console.error(`Error geocoding customer ${customer.id}:`, error.message);
                errorCount++;
            }
        }
        
        console.log('\n✅ Geocoding completed!');
        console.log(`Successfully geocoded: ${successCount}`);
        console.log(`Failed: ${errorCount}`);
        console.log(`Total processed: ${rows.length}`);
        
        // Fechar banco
        db.close();
        process.exit(0);
    });
}

// Executar
geocodeAllCustomers().catch(console.error);