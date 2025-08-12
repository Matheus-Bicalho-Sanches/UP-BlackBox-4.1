import { db } from '@/config/firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

/**
 * Interface para uma posição na carteira de referência
 */
export interface ReferencePosition {
  id?: string;
  ticker: string;
  price: number;
  quantity: number;
  percentage: number;
  description?: string;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Interface para uma carteira de referência
 */
export interface ReferencePortfolio {
  id?: string;
  strategy_id: string;
  strategy_name: string;
  name: string;
  description?: string;
  positions: ReferencePosition[];
  total_value: number;
  is_active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Serviço para gerenciar carteiras de referência
 */
export class ReferencePortfolioService {
  private collectionName = 'referencePortfolios';

  /**
   * Busca todas as carteiras de referência
   */
  async getAllPortfolios(): Promise<ReferencePortfolio[]> {
    try {
      const querySnapshot = await getDocs(
        query(
          collection(db, this.collectionName),
          orderBy('createdAt', 'desc')
        )
      );
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReferencePortfolio[];
    } catch (error) {
      console.error('Erro ao buscar carteiras de referência:', error);
      throw error;
    }
  }

  /**
   * Busca carteiras de referência por estratégia
   */
  async getPortfoliosByStrategy(strategyId: string): Promise<ReferencePortfolio[]> {
    try {
      const querySnapshot = await getDocs(
        query(
          collection(db, this.collectionName),
          where('strategy_id', '==', strategyId),
          orderBy('createdAt', 'desc')
        )
      );
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ReferencePortfolio[];
    } catch (error) {
      console.error('Erro ao buscar carteiras por estratégia:', error);
      throw error;
    }
  }

  /**
   * Busca uma carteira de referência específica
   */
  async getPortfolio(portfolioId: string): Promise<ReferencePortfolio | null> {
    try {
      const docRef = doc(db, this.collectionName, portfolioId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as ReferencePortfolio;
      }
      
      return null;
    } catch (error) {
      console.error('Erro ao buscar carteira de referência:', error);
      throw error;
    }
  }

  /**
   * Cria uma nova carteira de referência
   */
  async createPortfolio(portfolio: Omit<ReferencePortfolio, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...portfolio,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return docRef.id;
    } catch (error) {
      console.error('Erro ao criar carteira de referência:', error);
      throw error;
    }
  }

  /**
   * Atualiza uma carteira de referência
   */
  async updatePortfolio(portfolioId: string, updates: Partial<ReferencePortfolio>): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, portfolioId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Erro ao atualizar carteira de referência:', error);
      throw error;
    }
  }

  /**
   * Adiciona uma posição à carteira de referência
   */
  async addPosition(portfolioId: string, position: Omit<ReferencePosition, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      const portfolio = await this.getPortfolio(portfolioId);
      if (!portfolio) {
        throw new Error('Carteira de referência não encontrada');
      }

      const newPosition: ReferencePosition = {
        ...position,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const updatedPositions = [...portfolio.positions, newPosition];
      
      // Recalcular valor total
      const totalValue = updatedPositions.reduce((sum, pos) => sum + (pos.price * pos.quantity), 0);
      
      await this.updatePortfolio(portfolioId, {
        positions: updatedPositions,
        total_value: totalValue
      });
    } catch (error) {
      console.error('Erro ao adicionar posição:', error);
      throw error;
    }
  }

  /**
   * Atualiza uma posição na carteira de referência
   */
  async updatePosition(portfolioId: string, positionIndex: number, updates: Partial<ReferencePosition>): Promise<void> {
    try {
      const portfolio = await this.getPortfolio(portfolioId);
      if (!portfolio) {
        throw new Error('Carteira de referência não encontrada');
      }

      if (positionIndex < 0 || positionIndex >= portfolio.positions.length) {
        throw new Error('Índice de posição inválido');
      }

      const updatedPositions = [...portfolio.positions];
      updatedPositions[positionIndex] = {
        ...updatedPositions[positionIndex],
        ...updates,
        updatedAt: serverTimestamp()
      };

      // Recalcular valor total
      const totalValue = updatedPositions.reduce((sum, pos) => sum + (pos.price * pos.quantity), 0);
      
      await this.updatePortfolio(portfolioId, {
        positions: updatedPositions,
        total_value: totalValue
      });
    } catch (error) {
      console.error('Erro ao atualizar posição:', error);
      throw error;
    }
  }

  /**
   * Remove uma posição da carteira de referência
   */
  async removePosition(portfolioId: string, positionIndex: number): Promise<void> {
    try {
      const portfolio = await this.getPortfolio(portfolioId);
      if (!portfolio) {
        throw new Error('Carteira de referência não encontrada');
      }

      if (positionIndex < 0 || positionIndex >= portfolio.positions.length) {
        throw new Error('Índice de posição inválido');
      }

      const updatedPositions = portfolio.positions.filter((_, index) => index !== positionIndex);
      
      // Recalcular valor total
      const totalValue = updatedPositions.reduce((sum, pos) => sum + (pos.price * pos.quantity), 0);
      
      await this.updatePortfolio(portfolioId, {
        positions: updatedPositions,
        total_value: totalValue
      });
    } catch (error) {
      console.error('Erro ao remover posição:', error);
      throw error;
    }
  }

  /**
   * Remove uma carteira de referência
   */
  async deletePortfolio(portfolioId: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, portfolioId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Erro ao deletar carteira de referência:', error);
      throw error;
    }
  }

  /**
   * Calcula as diferenças entre carteira de referência e posições reais
   */
  calculateDifferences(
    referencePositions: ReferencePosition[], 
    realPositions: any[]
  ): Array<{
    ticker: string;
    referenceQuantity: number;
    realQuantity: number;
    difference: number;
    referencePercentage: number;
    realPercentage: number;
    percentageDifference: number;
    action: 'buy' | 'sell' | 'none';
  }> {
    const differences = [];
    
    // Criar mapa das posições reais
    const realPositionsMap = new Map();
    realPositions.forEach(pos => {
      realPositionsMap.set(pos.ticker, pos);
    });

    // Calcular diferenças para posições de referência
    referencePositions.forEach(refPos => {
      const realPos = realPositionsMap.get(refPos.ticker);
      const realQuantity = realPos ? realPos.quantity : 0;
      const difference = refPos.quantity - realQuantity;
      
      differences.push({
        ticker: refPos.ticker,
        referenceQuantity: refPos.quantity,
        realQuantity: realQuantity,
        difference: difference,
        referencePercentage: refPos.percentage,
        realPercentage: realPos ? realPos.percentage || 0 : 0,
        percentageDifference: refPos.percentage - (realPos ? realPos.percentage || 0 : 0),
        action: difference > 0 ? 'buy' : difference < 0 ? 'sell' : 'none'
      });
    });

    // Adicionar posições reais que não estão na referência
    realPositions.forEach(realPos => {
      const hasReference = referencePositions.some(refPos => refPos.ticker === realPos.ticker);
      if (!hasReference) {
        differences.push({
          ticker: realPos.ticker,
          referenceQuantity: 0,
          realQuantity: realPos.quantity,
          difference: -realPos.quantity,
          referencePercentage: 0,
          realPercentage: realPos.percentage || 0,
          percentageDifference: -(realPos.percentage || 0),
          action: 'sell'
        });
      }
    });

    return differences;
  }
}

// Instância singleton do serviço
export const referencePortfolioService = new ReferencePortfolioService(); 