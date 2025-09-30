/**
 * Script para verificar o tamanho real das coleções do Firestore
 * Execute com: node scripts/check_firestore_collections.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, getCountFromServer } = require('firebase/firestore');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkCollectionSizes() {
  console.log('🔍 Verificando tamanho das coleções do Firestore...\n');
  
  const collections = [
    'posicoesDLL',
    'posicoesAjusteManual',
    'ordensDLL',
    'CarteirasDeRefDLL',
    'strategies',
    'contasDll',
    'strategyAllocations'
  ];
  
  const results = [];
  
  for (const collectionName of collections) {
    try {
      console.log(`📊 Verificando ${collectionName}...`);
      
      // Tentar usar getCountFromServer (mais eficiente)
      try {
        const coll = collection(db, collectionName);
        const snapshot = await getCountFromServer(coll);
        const count = snapshot.data().count;
        
        results.push({
          collection: collectionName,
          count,
          method: 'getCountFromServer'
        });
        
        console.log(`   ✅ ${collectionName}: ${count.toLocaleString()} documentos\n`);
      } catch (countError) {
        // Fallback: buscar todos os documentos (mais lento, mas funciona sempre)
        console.log(`   ⚠️  getCountFromServer não disponível, usando getDocs...`);
        const coll = collection(db, collectionName);
        const snapshot = await getDocs(coll);
        const count = snapshot.size;
        
        results.push({
          collection: collectionName,
          count,
          method: 'getDocs'
        });
        
        console.log(`   ✅ ${collectionName}: ${count.toLocaleString()} documentos\n`);
      }
      
    } catch (error) {
      console.error(`   ❌ Erro ao verificar ${collectionName}:`, error.message);
      results.push({
        collection: collectionName,
        count: 'ERROR',
        error: error.message
      });
    }
  }
  
  // Resumo
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║              RESUMO DAS COLEÇÕES FIRESTORE                 ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  results.forEach(({ collection, count }) => {
    const collectionStr = collection.padEnd(30);
    const countStr = count === 'ERROR' ? 'ERROR'.padStart(20) : String(count).padStart(20);
    console.log(`║ ${collectionStr} ${countStr} ║`);
  });
  
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  // Análise
  const posicoes = results.find(r => r.collection === 'posicoesDLL')?.count || 0;
  const ajustes = results.find(r => r.collection === 'posicoesAjusteManual')?.count || 0;
  
  if (typeof posicoes === 'number' && typeof ajustes === 'number') {
    console.log('\n📊 ANÁLISE:');
    console.log(`   • Total de documentos em posicoesDLL: ${posicoes.toLocaleString()}`);
    console.log(`   • Total de documentos em posicoesAjusteManual: ${ajustes.toLocaleString()}`);
    console.log(`   • Total combinado: ${(posicoes + ajustes).toLocaleString()}`);
    console.log('\n🔴 PROBLEMA IDENTIFICADO:');
    console.log(`   • Reads reportados pelo monitor: 19.688 (posições) + 7.180 (ajustes) = 26.868`);
    console.log(`   • Documentos reais nas coleções: ${posicoes.toLocaleString()} + ${ajustes.toLocaleString()} = ${(posicoes + ajustes).toLocaleString()}`);
    
    if (posicoes + ajustes < 26868) {
      const multiplier = (26868 / (posicoes + ajustes)).toFixed(1);
      console.log(`   • O sistema está lendo os mesmos dados ~${multiplier}x!`);
      console.log(`   • Isso indica múltiplas chamadas desnecessárias ou falta de cache.`);
    }
  }
  
  process.exit(0);
}

checkCollectionSizes().catch(console.error);
