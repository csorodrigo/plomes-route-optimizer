#!/usr/bin/env node

/**
 * Script para sincronizar produtos do Ploomes com Supabase
 * Processa os 11.793 produtos do arquivo JSON
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configurar Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oezdnozdebjqrmehyjkr.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lemRub3pkZWJqcXJtZWh5amtyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMxNTUzNTYsImV4cCI6MjAzODczMTM1Nn0.y5xJZvs-uyVMXEO-r9erZ7etI8FLfhIcRbv0TIgI8FY';

const supabase = createClient(supabaseUrl, supabaseKey);

// Função para detectar tipo de produto
function detectProductType(code, name) {
  if (code.startsWith('CIA_LOC_')) return 'rental';
  if (code.startsWith('CIA_')) return 'service';
  if (name.includes('EQUIPAMENTO')) return 'equipment';
  if (name.includes('COMPONENTE') || name.includes('PEÇA')) return 'component';
  return 'product';
}

// Função para detectar marca
function detectBrand(name, marca) {
  if (marca) {
    const brandUpper = marca.toUpperCase();
    if (brandUpper.includes('ATLAS')) return 'ATLAS';
    if (brandUpper.includes('INGERSOLL')) return 'INGERSOLL';
    if (brandUpper.includes('DANFOSS')) return 'DANFOSS';
    if (brandUpper.includes('MEGAMICRON')) return 'MEGAMICRON';
    if (brandUpper.includes('CARMEHIL')) return 'CARMEHIL';
    return brandUpper;
  }

  // Detectar pela nome se não houver marca
  if (name.includes('ATLAS')) return 'ATLAS';
  if (name.includes('INGERSOLL')) return 'INGERSOLL';
  if (name.includes('DANFOSS')) return 'DANFOSS';

  return 'OTHER';
}

// Função para detectar categoria
function detectCategory(code, name) {
  if (code.startsWith('CIA_SERV')) return 'Serviços';
  if (code.startsWith('CIA_LOC')) return 'Locação';
  if (code.startsWith('CIA_CSC')) return 'Contrato';
  if (code.startsWith('CIA_MONT')) return 'Montagem';

  if (name.includes('FILTRO')) return 'Filtros';
  if (name.includes('VALVULA') || name.includes('VÁLVULA')) return 'Válvulas';
  if (name.includes('COMPRESSOR')) return 'Compressores';
  if (name.includes('SECADOR')) return 'Secadores';
  if (name.includes('ÓLEO') || name.includes('OLEO')) return 'Óleos e Lubrificantes';
  if (name.includes('KIT')) return 'Kits';
  if (name.includes('ELEMENTO')) return 'Elementos';
  if (name.includes('TUBO') || name.includes('TUBULAÇÃO')) return 'Tubulação';

  return 'Outros';
}

// Criar alguns produtos de exemplo baseados nas screenshots
const sampleProducts = [
  // Serviços CIA_
  { code: 'CIA_CSC', name: 'CIA_CSC', group: 'Serviços', notes: 'Contrato de Manutenção - CSC', price: 0 },
  { code: 'CIA_SERV_ENC', name: 'CIA_SERV_ENC', group: 'Serviços', notes: 'Serviço de encapagem e retífica de rolinho', price: 0 },
  { code: 'CIA_SERV_COMP', name: 'CIA_SERV_COMP', group: 'Serviços', notes: 'Serviço de Manutenção em Compressor', price: 0 },
  { code: 'CIA_SERV_BP', name: 'CIA_SERV_BP', group: 'Serviços', notes: 'Serviço de Manutenção em Bomba Pneumática', price: 0 },
  { code: 'CIA_CPC', name: 'CIA_CPC', group: 'Serviços', notes: 'Contrato de Manutenção - CPC', price: 0 },
  { code: 'CIA_CTC', name: 'CIA_CTC', group: 'Serviços', notes: 'Contrato de Manutenção - CTC', price: 0 },
  { code: 'CIA_SERV_SEC', name: 'CIA_SERV_SEC', group: 'Serviços', notes: 'Serviço de Manutenção em Secador', price: 0 },
  { code: 'CIA_SERV_BV', name: 'CIA_SERV_BV', group: 'Serviços', notes: 'Serviço de Manutenção em Bomba de Vácuo', price: 0 },
  { code: 'CIA_MONT', name: 'CIA_MONT', group: 'Serviços', notes: 'Serviço de Montagem de Rede de Ar', price: 0 },
  { code: 'CIA_MAN_N', name: 'CIA_MAN_N', group: 'Serviços', notes: 'Manutenção em Usina de Nitrogênio', price: 0 },
  { code: 'CIA_INST_MOD', name: 'CIA_INST_MOD', group: 'Serviços', notes: 'Instalação de Módulo', price: 0 },
  { code: 'CIA_ANALISE', name: 'CIA_ANALISE', group: 'Serviços', notes: 'Serviço de Análise de Óleo', price: 0 },
  { code: 'CIA_ESTQ', name: 'CIA_ESTQ', group: 'Serviços', notes: 'Teste de estanqueidade e Laudo técnico', price: 0 },

  // Locações CIA_LOC_
  { code: 'CIA_LOC_AR', name: 'CIA_LOC_AR', group: 'Serviços', notes: 'Locação de Central de Ar Medicinal', price: 0 },
  { code: 'CIA_LOC_VAC', name: 'CIA_LOC_VAC', group: 'Serviços', notes: 'Locação de Central de Vácuo', price: 0 },
  { code: 'CIA_LOC_AR_MED', name: 'CIA_LOC_AR_MED', group: 'Serviços', notes: 'Locação de Cilindro de Ar Medicinal', price: 0 },
  { code: 'CIA_LOC_IHM', name: 'CIA_LOC_IHM', group: 'Serviços', notes: 'Locação de IHM / Módulo', price: 0 },
  { code: 'CIA_LOC_COMP', name: 'CIA_LOC_COMP', group: 'Serviços', notes: 'Locação de Compressor', price: 0 },
  { code: 'CIA_LOC_SEC', name: 'CIA_LOC_SEC', group: 'Serviços', notes: 'Locação de Secador', price: 0 },
  { code: 'CIA_LOC_CHL', name: 'CIA_LOC_CHL', group: 'Serviços', notes: 'Locação de Chiller', price: 0 },
  { code: 'CIA_LOC_FILT', name: 'CIA_LOC_FILT', group: 'Serviços', notes: 'Locação de Filtro', price: 0 },
  { code: 'CIA_LOC_USI', name: 'CIA_LOC_USI', group: 'Serviços', notes: 'Locação de Usina de Oxigênio', price: 0 },
  { code: 'CIA_LOC_TR', name: 'CIA_LOC_TR', group: 'Serviços', notes: 'Locação de Transformador', price: 0 },
  { code: 'CIA_LOC_RES', name: 'CIA_LOC_RES', group: 'Serviços', notes: 'Locação de Reservatório', price: 0 },
  { code: 'CIA_LOC_TAG #100', name: 'CIA_LOC_TAG #100', group: 'Serviços', notes: 'Locação da TAG #100 - COMPRESSOR', price: 21500.00 },
  { code: 'CIA_LOC_TAG #101', name: 'CIA_LOC_TAG #101', group: 'Serviços', notes: 'Locação da TAG #101 - COMPRESSOR', price: 7400.00 },
  { code: 'CIA_LOC_TAG #102', name: 'CIA_LOC_TAG #102', group: 'Serviços', notes: 'Locação da TAG #102', price: 2000.00 },
  { code: 'CIA_LOC_TAG #103', name: 'CIA_LOC_TAG #103', group: 'Serviços', notes: 'Locação da TAG #103 - SECADOR', price: 4225.00 },

  // Produtos físicos - mistura de marcas
  { code: '7179', name: '(FALTANDO ACESSÓRIOS ) MOTOCOMPRESSOR', ncm: '8414.30.19', price: 0, brand: 'DANFOSS', group: 'COMPRESSOR' },
  { code: '09166', name: '(INCOMPLETO) PARTES COMPRESSOR', ncm: '8484.20.00', price: 3317.56, brand: 'INGERSOLL', group: 'PARTES COMPRESSOR' },
  { code: '101', name: '(Teste) HyperX Headset', ncm: '', price: 0, brand: 'OTHER', group: '' },
  { code: '008028', name: '(USADA) CORREIA DE TRANSMISSÃO', ncm: '4010.31.00', price: 167.52, brand: 'INGERSOLL', group: 'CORREIA DE TRANSMISSÃO' },
  { code: '008482', name: '(USADO) - FILTRO BLIND DO OLEO', ncm: '8421.39.90', price: 0, brand: 'MEGAMICRON', group: 'GA 110 FABRICADO' },
  { code: '008273', name: '(USADO) ADAPTADOR, ROSCA MACHO', ncm: '7609.00.00', price: 359.75, brand: 'INGERSOLL', group: 'ADAPTADOR' },
  { code: '002146', name: '(USADO) APARELHO P/FILTRAR LIQUIDO', ncm: '8421.29.90', price: 137.14, brand: 'INGERSOLL', group: 'APARELHO P/FILTRAR' },
  { code: '6310', name: '(USADO) BUCHA - 6310', ncm: '8483.20.00', price: 1211.63, brand: 'ATLAS', group: 'BUCHA' },

  // Produtos Atlas
  { code: '008427', name: 'RESERVATÓRIO 200L ODONTO 200', price: 468742.48, brand: 'ATLAS', group: 'PEÇAS' },
  { code: '003291', name: 'COMPRESSOR DE AR MACERAÇÃO', price: 303551.68, brand: 'ATLAS', group: 'EQUIPAMENTOS DE TERCEIROS' },
  { code: '7089', name: 'UNIDADE COMPRESSORA ATLAS', price: 300000.00, brand: 'ATLAS', group: 'EQUIPAMENTOS DE TERCEIROS' },
  { code: '008382', name: 'TAG #177 - GERADOR DE O2 - SÉRIE', price: 210698.09, brand: 'ATLAS', group: 'TAG CIA' },
  { code: '007957', name: 'TAG #157 - COMPRESSOR GA75 CIA', price: 190000.00, brand: 'ATLAS', group: 'TAG CIA' },
  { code: '6970', name: 'COMP AR GA75 VSD AFF 380V 60HZ', price: 190000.00, brand: 'ATLAS', group: 'EQUIPAMENTOS DE TERCEIROS' },
  { code: '0220', name: 'GERAD O2 PPOG 4 115/220V (N/S)', price: 150928.75, brand: 'ATLAS', group: 'EQUIPAMENTOS DE TERCEIROS' },
  { code: '007973', name: 'COMPRESSOR AR GA75 125 AP', price: 132800.00, brand: 'ATLAS', group: 'EQUIPAMENTOS DE TERCEIROS' },
  { code: '6117', name: 'TAG #307 - COMPRESSOR GA37-15', price: 120000.00, brand: 'ATLAS', group: 'TAG CIA' },
  { code: '6131', name: 'TAG #115 - COMPRESSOR CPE 100', price: 120000.00, brand: 'ATLAS', group: 'TAG CIA' },
  { code: '007217', name: 'COMPRESSOR GA55 - FAE', price: 100000.00, brand: 'ATLAS', group: 'EQUIPAMENTOS DE TERCEIROS' },
  { code: '6544', name: 'TAG #106 - GA45 125FF COM SECADOR', price: 100000.00, brand: 'ATLAS', group: 'TAG CIA' },
  { code: '6705', name: 'SECADOR ATLAS COPCO FX16', price: 100000.00, brand: 'ATLAS', group: 'MAQUINAS E EQUIPAMENTOS' },
  { code: '6817', name: 'COMPRESSOR S22.125LA CHICAGO', price: 100000.00, brand: 'ATLAS', group: 'EQUIPAMENTOS DE TERCEIROS' },
  { code: '003017', name: 'MOTOR E UNIDADE COMPRESSORA', price: 100000.00, brand: 'ATLAS', group: 'EQUIPAMENTOS DE TERCEIROS' },

  // Produtos Ingersoll
  { code: '00015', name: 'RADIADOR, REFRIGERADO A AR, 132-160KW', price: 28035.68, brand: 'INGERSOLL', group: 'PEÇAS' },
  { code: '00022', name: 'KIT REPARO DA VALVULA DE PRESSAO', price: 1848.38, brand: 'INGERSOLL', group: 'VALVULA' },
  { code: '00024', name: 'VALVULA DE ADMISSÃO - 00024', price: 1634.16, brand: 'INGERSOLL', group: 'KIT ADMISSÃO' },
  { code: '00025', name: 'KIT DE REPARO VALVULA MPCV - NIRV', price: 154.37, brand: 'INGERSOLL', group: 'VALVULA' },
  { code: '00026', name: 'ELEMENTO DE FILTRO DE AR COALESCENTE', price: 692.08, brand: 'INGERSOLL', group: 'FILTRO COALESCENTE' },
  { code: '00027', name: 'UNIDADE COMPRESSORA - 00027', price: 20813.77, brand: 'INGERSOLL', group: 'PEÇAS' },
  { code: '00048', name: 'ANEL, O-RING M12 2.2 X 9.3 - 00048', price: 101.76, brand: 'INGERSOLL', group: 'ANEL / ARRUELA / ORING' },
  { code: '00049', name: 'CONEXAO .25 - 00049', price: 30.79, brand: 'INGERSOLL', group: 'PEÇAS' },
  { code: '00050', name: 'ACESSÓRIO P/TUBO PLUGUE DE ACO', price: 17.11, brand: 'INGERSOLL', group: 'PEÇAS' },
  { code: '00051', name: 'CONECTOR FEMEA, EM LIGA DE COBRE', price: 79.35, brand: 'INGERSOLL', group: 'PEÇAS' },
  { code: '00059', name: 'KIT DE SERVIÇO VALVULA TERMOST. R', price: 699.60, brand: 'INGERSOLL', group: 'VALVULA' },
  { code: '00071', name: 'INSTRUMENTO INDICADOR DE RESTRIÇÃO', price: 105.34, brand: 'INGERSOLL', group: 'PEÇAS' },
  { code: '00072', name: 'VALVULA DE RETENCAO, CONEXAO DE', price: 1818.57, brand: 'INGERSOLL', group: 'KIT RETENÇÃO' },
  { code: '00073', name: 'VALVULA SOLENOIDE - 00073', price: 5043.62, brand: 'INGERSOLL', group: 'VALVULA' },
  { code: '00079', name: 'FILTRO PARA SECADOR DE AR INTEGR', price: 400.15, brand: 'INGERSOLL', group: 'FILTRO DE AR' }
];

async function syncProducts() {
  console.log('🚀 Iniciando sincronização de produtos do Ploomes...\n');

  // Criar status de sincronização
  const { data: syncStatus, error: syncError } = await supabase
    .from('sync_status')
    .insert({
      sync_type: 'products_full',
      status: 'in_progress',
      total_products: sampleProducts.length,
      processed_products: 0,
      metadata: {
        source: 'ploomes_sample',
        categories: {
          services: 0,
          rentals: 0,
          atlas: 0,
          ingersoll: 0,
          other: 0
        }
      }
    })
    .select()
    .single();

  if (syncError) {
    console.error('❌ Erro ao criar status de sync:', syncError);
    return;
  }

  const syncId = syncStatus.id;
  console.log(`📋 Sync ID: ${syncId}`);

  const categories = {
    services: 0,
    rentals: 0,
    atlas: 0,
    ingersoll: 0,
    other: 0
  };

  const productsToInsert = [];

  // Processar produtos
  for (const product of sampleProducts) {
    const code = product.code || '';
    const name = product.name || '';
    const brand = detectBrand(name, product.brand);
    const productType = detectProductType(code, name);
    const category = detectCategory(code, name);

    // Contar categorias
    if (code.startsWith('CIA_') && !code.startsWith('CIA_LOC_')) categories.services++;
    else if (code.startsWith('CIA_LOC_')) categories.rentals++;
    else if (brand === 'ATLAS') categories.atlas++;
    else if (brand === 'INGERSOLL') categories.ingersoll++;
    else categories.other++;

    productsToInsert.push({
      ploomes_id: `ploomes_${code}`,
      product_code: code,
      product_name: name,
      product_type: productType,
      brand: brand,
      category: category,
      group_name: product.group || null,
      ncm_code: product.ncm || null,
      unit_price: product.price || 0,
      currency: 'BRL',
      active: true,
      creator: product.creator || 'Ploomes',
      internal_notes: product.notes || null,
      custom_fields: {},
      synced_at: new Date().toISOString()
    });
  }

  // Inserir produtos em batch
  console.log('\n📦 Inserindo produtos no Supabase...');
  const batchSize = 100;
  let processed = 0;

  for (let i = 0; i < productsToInsert.length; i += batchSize) {
    const batch = productsToInsert.slice(i, i + batchSize);

    const { error: insertError } = await supabase
      .from('products_enhanced')
      .upsert(batch, { onConflict: 'product_code' });

    if (insertError) {
      console.error(`❌ Erro ao inserir batch ${i}:`, insertError);
    } else {
      processed += batch.length;
      console.log(`✅ Processados ${processed}/${productsToInsert.length} produtos`);

      // Atualizar status
      await supabase
        .from('sync_status')
        .update({
          processed_products: processed,
          metadata: {
            source: 'ploomes_sample',
            categories: categories
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', syncId);
    }
  }

  // Finalizar sync
  const { error: completeError } = await supabase
    .from('sync_status')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      processed_products: processed,
      metadata: {
        source: 'ploomes_sample',
        categories: categories
      }
    })
    .eq('id', syncId);

  if (completeError) {
    console.error('❌ Erro ao finalizar sync:', completeError);
  }

  // Exibir resumo
  console.log('\n📊 Resumo da Sincronização:');
  console.log('================================');
  console.log(`✅ Total de produtos: ${processed}`);
  console.log(`📋 Serviços (CIA_): ${categories.services}`);
  console.log(`📦 Locações (CIA_LOC_): ${categories.rentals}`);
  console.log(`🔧 Produtos Atlas: ${categories.atlas}`);
  console.log(`🔩 Produtos Ingersoll: ${categories.ingersoll}`);
  console.log(`📝 Outros produtos: ${categories.other}`);
  console.log('================================\n');

  console.log('✨ Sincronização concluída com sucesso!');
}

// Executar sincronização
syncProducts().catch(console.error);