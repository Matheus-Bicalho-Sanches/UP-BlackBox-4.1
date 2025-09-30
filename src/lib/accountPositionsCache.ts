/**
 * Sistema de cache para posições de contas
 * Evita múltiplas chamadas desnecessárias ao backend
 */

interface CacheEntry {
  data: any[];
  timestamp: number;
  loading: boolean;
}

class AccountPositionsCacheClass {
  private cache: Map<string, CacheEntry> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();
  private cacheDuration = 30000; // 30 segundos
  
  /**
   * Verifica se há cache válido para uma conta
   */
  has(accountId: string): boolean {
    const entry = this.cache.get(accountId);
    if (!entry) return false;
    
    const age = Date.now() - entry.timestamp;
    return age < this.cacheDuration;
  }
  
  /**
   * Obtém dados do cache
   */
  get(accountId: string): any[] | null {
    if (!this.has(accountId)) return null;
    return this.cache.get(accountId)!.data;
  }
  
  /**
   * Salva dados no cache
   */
  set(accountId: string, data: any[]): void {
    this.cache.set(accountId, {
      data,
      timestamp: Date.now(),
      loading: false
    });
  }
  
  /**
   * Marca uma conta como "carregando" para evitar duplicatas
   */
  setLoading(accountId: string): void {
    const existing = this.cache.get(accountId);
    if (existing) {
      existing.loading = true;
    } else {
      this.cache.set(accountId, {
        data: [],
        timestamp: Date.now(),
        loading: true
      });
    }
  }
  
  /**
   * Verifica se uma conta está sendo carregada
   */
  isLoading(accountId: string): boolean {
    return this.cache.get(accountId)?.loading || false;
  }
  
  /**
   * Adiciona uma promise pendente (para evitar chamadas simultâneas)
   */
  setPendingRequest(accountId: string, promise: Promise<any>): void {
    this.pendingRequests.set(accountId, promise);
  }
  
  /**
   * Obtém promise pendente se existir
   */
  getPendingRequest(accountId: string): Promise<any> | null {
    return this.pendingRequests.get(accountId) || null;
  }
  
  /**
   * Remove promise pendente
   */
  clearPendingRequest(accountId: string): void {
    this.pendingRequests.delete(accountId);
  }
  
  /**
   * Invalida cache de uma conta específica
   */
  invalidate(accountId: string): void {
    this.cache.delete(accountId);
    this.pendingRequests.delete(accountId);
    console.log(`🗑️  [Cache] Invalidado cache para conta ${accountId}`);
  }
  
  /**
   * Invalida todo o cache
   */
  invalidateAll(): void {
    this.cache.clear();
    this.pendingRequests.clear();
    console.log('🗑️  [Cache] Todo cache invalidado');
  }
  
  /**
   * Obtém estatísticas do cache
   */
  getStats() {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    let loadingEntries = 0;
    
    this.cache.forEach((entry) => {
      const age = now - entry.timestamp;
      if (entry.loading) {
        loadingEntries++;
      } else if (age < this.cacheDuration) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    });
    
    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      loadingEntries,
      pendingRequests: this.pendingRequests.size
    };
  }
  
  /**
   * Limpa entradas expiradas
   */
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    this.cache.forEach((entry, accountId) => {
      const age = now - entry.timestamp;
      if (age >= this.cacheDuration && !entry.loading) {
        this.cache.delete(accountId);
        cleaned++;
      }
    });
    
    if (cleaned > 0) {
      console.log(`🧹 [Cache] Limpou ${cleaned} entradas expiradas`);
    }
  }
}

// Exportar instância singleton
export const AccountPositionsCache = new AccountPositionsCacheClass();

// Limpar cache automaticamente a cada 5 minutos
if (typeof window !== 'undefined') {
  setInterval(() => {
    AccountPositionsCache.cleanup();
  }, 5 * 60 * 1000);
  
  // Adicionar ao window para debug
  (window as any).accountPositionsCache = AccountPositionsCache;
  console.log('💾 AccountPositionsCache ativado! Use window.accountPositionsCache.getStats() para ver estatísticas.');
}
