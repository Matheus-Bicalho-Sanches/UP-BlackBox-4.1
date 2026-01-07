/**
 * Firebase Helpers - Funções auxiliares para operações do Firebase
 * Inclui tracking automático de reads para monitoramento de custos
 */

import { collection, getDocs, query, QueryConstraint, CollectionReference, Query, onSnapshot } from 'firebase/firestore';
import { FirestoreMonitor } from './firestoreMonitor';

/**
 * Wrapper para getDocs que rastreia automaticamente os reads
 * @param collectionName Nome da coleção para tracking
 * @param queryRef Query ou CollectionReference do Firestore
 * @param context Contexto da chamada (nome da função que está chamando)
 * @returns Snapshot dos documentos
 */
export async function trackedGetDocs(
  collectionName: string,
  queryRef: Query | CollectionReference,
  context: string = 'unknown'
) {
  const startTime = performance.now();
  
  try {
    const snapshot = await getDocs(queryRef);
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);
    
    // Rastrear reads
    FirestoreMonitor.trackRead(collectionName, snapshot.size, context);
    
    // Log adicional com timing
    console.log(`⏱️  [${context}] ${collectionName}: ${duration}ms`);
    
    return snapshot;
  } catch (error) {
    console.error(`❌ [${context}] Erro ao buscar ${collectionName}:`, error);
    throw error;
  }
}

/**
 * Wrapper para onSnapshot que rastreia automaticamente os reads em tempo real
 * @param collectionName Nome da coleção para tracking
 * @param queryRef Query ou CollectionReference do Firestore
 * @param onNext Callback para o próximo snapshot
 * @param onError Callback opcional para erro
 * @param context Contexto da chamada
 * @returns Função de unsubscribe
 */
export function trackedOnSnapshot(
  collectionName: string,
  queryRef: Query | CollectionReference,
  onNext: (snapshot: any) => void,
  onError?: (error: any) => void,
  context: string = 'unknown'
) {
  return onSnapshot(
    queryRef,
    (snapshot) => {
      // Rastrear reads a cada atualização
      FirestoreMonitor.trackRead(collectionName, snapshot.size, `${context} (realtime)`);
      onNext(snapshot);
    },
    (error) => {
      console.error(`❌ [${context}] Erro no listener ${collectionName}:`, error);
      if (onError) onError(error);
    }
  );
}

/**
 * Helper para criar contexto automático baseado na pilha de chamadas
 * Útil quando não quiser especificar contexto manualmente
 */
export function getCallerContext(): string {
  try {
    const error = new Error();
    const stack = error.stack?.split('\n');
    if (stack && stack.length > 3) {
      // Pegar a terceira linha da pilha (quem chamou a função que chamou getCallerContext)
      const callerLine = stack[3];
      const match = callerLine.match(/at (\w+)/);
      return match ? match[1] : 'unknown';
    }
  } catch (e) {
    // Ignorar erros
  }
  return 'unknown';
}

/**
 * Variação do trackedGetDocs que detecta contexto automaticamente
 */
export async function autoTrackedGetDocs(
  collectionName: string,
  queryRef: Query | CollectionReference
) {
  const context = getCallerContext();
  return trackedGetDocs(collectionName, queryRef, context);
}

/**
 * Wrapper para fetch que rastreia chamadas de API que resultam em reads do backend
 * @param url URL da API
 * @param context Contexto da chamada
 * @param estimatedReads Número estimado de reads (opcional, será extraído da resposta se disponível)
 */
export async function trackedFetch(
  url: string,
  context: string = 'unknown',
  options?: RequestInit
): Promise<Response> {
  const startTime = performance.now();
  
  try {
    const response = await fetch(url, options);
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);
    
    // Clonar resposta para poder ler o body sem consumir o original
    const clonedResponse = response.clone();
    
    try {
      const data = await clonedResponse.json();
      
      // Tentar extrair informações de reads do backend
      let totalReads = 0;
      let readsBreakdown: Record<string, number> = {};
      
      // Se a resposta contém informações sobre posições do cliente
      if (data.positions && Array.isArray(data.positions)) {
        // Verificar se o backend retornou métricas reais
        if (data.firestore_metrics) {
          // Usar métricas REAIS do backend
          readsBreakdown['posicoesDLL'] = data.firestore_metrics.posicoesDLL_reads || 0;
          readsBreakdown['posicoesAjusteManual'] = data.firestore_metrics.posicoesAjusteManual_reads || 0;
          totalReads = data.firestore_metrics.total_reads || 0;
          
          console.log(`📊 [${context}] Métricas REAIS do backend recebidas!`);
        } else {
          // Fallback: estimativa conservadora baseada nos logs reais
          const numPositions = data.positions.length;
          const estimatedPositionDocs = Math.max(numPositions, 30); // No mínimo 30 docs
          const estimatedAdjustmentDocs = Math.ceil(numPositions * 0.9); // ~90% têm ajustes
          
          readsBreakdown['posicoesDLL'] = estimatedPositionDocs;
          readsBreakdown['posicoesAjusteManual'] = estimatedAdjustmentDocs;
          totalReads = estimatedPositionDocs + estimatedAdjustmentDocs;
          
          console.log(`📊 [${context}] Usando estimativa (backend não retornou métricas)`);
        }
      }
      
      // Rastrear os reads do backend
      if (totalReads > 0) {
        Object.entries(readsBreakdown).forEach(([collection, count]) => {
          FirestoreMonitor.trackRead(
            collection,
            count,
            `${context} (backend)`
          );
        });
      }
      
      console.log(`🌐 [${context}] API call to ${url}: ${duration}ms (${totalReads} backend reads: ${JSON.stringify(readsBreakdown)})`);
    } catch (jsonError) {
      // Se não for JSON, apenas logar
      console.log(`🌐 [${context}] API call to ${url}: ${duration}ms`);
    }
    
    return response;
  } catch (error) {
    console.error(`❌ [${context}] Erro ao chamar API ${url}:`, error);
    throw error;
  }
}
