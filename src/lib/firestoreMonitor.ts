/**
 * FirestoreMonitor - Sistema de monitoramento de reads do Firestore
 * Rastreia e contabiliza todas as leituras de documentos para análise de custos
 */

interface ReadRecord {
  collection: string;
  context: string;
  count: number;
  timestamp: number;
}

interface CollectionStats {
  total: number;
  byContext: Record<string, number>;
}

class FirestoreMonitorClass {
  private reads: Map<string, ReadRecord[]> = new Map();
  private startTime: number = Date.now();
  private listeners: Set<() => void> = new Set();
  
  /**
   * Registra uma leitura do Firestore
   * @param collection Nome da coleção (ex: "strategies", "posicoesDLL")
   * @param count Número de documentos lidos
   * @param context Contexto da chamada (ex: "initialLoad", "fetchReferencePositions")
   */
  trackRead(collection: string, count: number, context: string = 'unknown') {
    const key = `${collection}::${context}`;
    const existing = this.reads.get(key) || [];
    
    existing.push({
      collection,
      context,
      count,
      timestamp: Date.now()
    });
    
    this.reads.set(key, existing);
    
    // Log no console
    const total = this.getTotalByCollection(collection);
    console.log(`📖 [${context}] ${collection}: +${count} reads (total: ${total})`);
    
    // Notificar listeners (para atualizar UI)
    this.notifyListeners();
  }
  
  /**
   * Obtém total de reads de uma coleção específica
   */
  getTotalByCollection(collection: string): number {
    let total = 0;
    this.reads.forEach((records, key) => {
      if (key.startsWith(collection + '::')) {
        records.forEach(record => total += record.count);
      }
    });
    return total;
  }
  
  /**
   * Obtém estatísticas agrupadas por coleção
   */
  getStatsByCollection(): Map<string, CollectionStats> {
    const stats = new Map<string, CollectionStats>();
    
    this.reads.forEach((records, key) => {
      const [collection, context] = key.split('::');
      
      if (!stats.has(collection)) {
        stats.set(collection, { total: 0, byContext: {} });
      }
      
      const collectionStats = stats.get(collection)!;
      const contextTotal = records.reduce((sum, r) => sum + r.count, 0);
      
      collectionStats.total += contextTotal;
      collectionStats.byContext[context] = contextTotal;
    });
    
    return stats;
  }
  
  /**
   * Obtém total geral de reads
   */
  getTotalReads(): number {
    let total = 0;
    this.reads.forEach(records => {
      records.forEach(record => total += record.count);
    });
    return total;
  }
  
  /**
   * Calcula custo estimado (Firestore cobra $0.06 por 100k reads)
   */
  getEstimatedCost(): number {
    return (this.getTotalReads() / 100000) * 0.06;
  }
  
  /**
   * Gera relatório detalhado no console
   */
  getReport(): void {
    const elapsed = ((Date.now() - this.startTime) / 1000 / 60).toFixed(2);
    const stats = this.getStatsByCollection();
    const totalReads = this.getTotalReads();
    const cost = this.getEstimatedCost();
    
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           FIRESTORE READS REPORT (${elapsed} min)                  ║
╠═══════════════════════════════════════════════════════════════╣`);
    
    // Detalhamento por coleção e contexto
    this.reads.forEach((records, key) => {
      const total = records.reduce((sum, r) => sum + r.count, 0);
      const line = `║ ${key.padEnd(50)} ${String(total).padStart(6)} reads ║`;
      console.log(line);
    });
    
    console.log(`╠═══════════════════════════════════════════════════════════════╣`);
    
    // Totais por coleção
    const sortedStats = Array.from(stats.entries()).sort((a, b) => b[1].total - a[1].total);
    sortedStats.forEach(([collection, collectionStats]) => {
      const percentage = ((collectionStats.total / totalReads) * 100).toFixed(1);
      const line = `║ ${collection.padEnd(35)} ${String(collectionStats.total).padStart(6)} (${percentage.padStart(5)}%) ║`;
      console.log(line);
    });
    
    console.log(`╠═══════════════════════════════════════════════════════════════╣`);
    console.log(`║ TOTAL: ${String(totalReads).padStart(49)} reads ║`);
    console.log(`║ Custo estimado (US$ 0.06/100k): US$ ${cost.toFixed(4).padStart(10)} ║`);
    console.log(`╚═══════════════════════════════════════════════════════════════╝`);
    
    return;
  }
  
  /**
   * Exporta dados como JSON para download
   */
  exportJSON(): void {
    const data = {
      startTime: this.startTime,
      endTime: Date.now(),
      elapsedMinutes: ((Date.now() - this.startTime) / 1000 / 60).toFixed(2),
      totalReads: this.getTotalReads(),
      estimatedCost: this.getEstimatedCost(),
      byCollection: Object.fromEntries(this.getStatsByCollection()),
      details: Array.from(this.reads.entries()).map(([key, records]) => ({
        key,
        records
      }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firestore-reads-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log('✅ Dados exportados com sucesso!');
  }
  
  /**
   * Reseta todos os contadores
   */
  reset(): void {
    this.reads.clear();
    this.startTime = Date.now();
    this.notifyListeners();
    console.log('🔄 FirestoreMonitor resetado');
  }
  
  /**
   * Adiciona listener para mudanças
   */
  addListener(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  /**
   * Notifica todos os listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }
  
  /**
   * Obtém dados resumidos para UI
   */
  getSummary() {
    const stats = this.getStatsByCollection();
    const sortedStats = Array.from(stats.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5); // Top 5 coleções
    
    return {
      totalReads: this.getTotalReads(),
      estimatedCost: this.getEstimatedCost(),
      elapsedMinutes: ((Date.now() - this.startTime) / 1000 / 60).toFixed(1),
      topCollections: sortedStats.map(([collection, stats]) => ({
        collection,
        total: stats.total,
        percentage: ((stats.total / this.getTotalReads()) * 100).toFixed(1)
      }))
    };
  }
}

// Exportar instância singleton
export const FirestoreMonitor = new FirestoreMonitorClass();

// Adicionar ao objeto window para acesso no console
if (typeof window !== 'undefined') {
  (window as any).firestoreMonitor = FirestoreMonitor;
  console.log('🔍 FirestoreMonitor ativado! Use window.firestoreMonitor.getReport() para ver estatísticas.');
}
