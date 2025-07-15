'use client'

import { useState, useEffect, useCallback } from 'react';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  Timestamp
} from 'firebase/firestore';
import app from '@/config/firebase';
import {
    ResponsiveContainer, 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend 
} from 'recharts'; // Importar Recharts para o gráfico
// Remover imports não usados de libs financeiras
// import { Finance } from 'financejs'; 
// import { irr } from 'node-irr'; 

interface ClientProfitabilityProps {
  clientId: string;
}

interface AllocationSnapshot {
  date: string; // YYYY-MM-DD
  totalValue: number;
}

interface Transaction {
  date: string; // YYYY-MM-DD
  type: 'transaction' | 'aporte' | 'resgate';
  transactionType?: 'aporte' | 'resgate' | 'deposit' | 'entrada';
  amount: number;
  portfolioValueBefore: number;
}

// Funções auxiliares de data
const getFirstDayOfMonth = (date: Date): string => {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
};
const getLastDayOfMonth = (date: Date): string => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
};
const getFirstDayOfYear = (date: Date): string => {
  return new Date(date.getFullYear(), 0, 1).toISOString().split('T')[0];
};
const getLastDayOfYear = (date: Date): string => {
  return new Date(date.getFullYear(), 11, 31).toISOString().split('T')[0];
};
const getFirstDayOfLast12Months = (date: Date): string => {
  const targetDate = new Date(date);
  targetDate.setMonth(targetDate.getMonth() - 11);
  targetDate.setDate(1);
  return targetDate.toISOString().split('T')[0];
};

// Função para formatar moeda (movida para fora do componente)
const formatCurrency = (value: number | null): string => {
    if (value === null || value === undefined) return '-';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// const finance = new Finance(); // Remover

// Interface para os dados do gráfico de rentabilidade
interface ProfitabilityChartDataPoint {
    date: string;
    cumulativeReturn: number; // Em %
}

export default function ClientProfitability({ clientId }: ClientProfitabilityProps) {
  // Estado para tipo de período selecionado (incluindo CUSTOM)
  const [periodType, setPeriodType] = useState<'MTD' | 'YTD' | '12M' | 'ALL' | 'CUSTOM'>('YTD');
  // Estados para datas personalizadas
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [profitability, setProfitability] = useState<number | null>(null);
  const [absoluteGainLoss, setAbsoluteGainLoss] = useState<number | null>(null); 
  const [chartData, setChartData] = useState<ProfitabilityChartDataPoint[]>([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayStartDate, setDisplayStartDate] = useState<string | null>(null);
  const [displayEndDate, setDisplayEndDate] = useState<string | null>(null);
  const db = getFirestore(app);

  // Função para calcular TWRR - AGORA RECEBE DATAS COMO PARÂMETROS
  const calculatePreciseTWRR = useCallback(async (startDate: string, endDate: string) => {
      console.log(`[TWRR] Iniciando cálculo para ${startDate} a ${endDate}`); // LOG INÍCIO
      setLoading(true);
      setError(null);
      setProfitability(null);
      setAbsoluteGainLoss(null);
      setChartData([]); 
      setDisplayStartDate(null);
      setDisplayEndDate(null);

      // Validação básica das datas recebidas
      if (!startDate || !endDate || new Date(endDate) < new Date(startDate)) {
         console.error("[TWRR] Erro: Período inválido selecionado."); // LOG ERRO
         setError("Período inválido selecionado.");
         setLoading(false);
         return;
      }

      try {
        console.log("[TWRR] Buscando dados no Firestore..."); // LOG BUSCA
        // --- 1. Buscar TODOS os Dados Relevantes --- 
        const allocationRef = collection(db, 'allocations');
        const transactionsRef = collection(db, 'transactions');

        // A) Buscar TODAS as Transações
        const transQuery = query(
          transactionsRef,
          where('clientId', '==', clientId),
          orderBy('date', 'asc')
        );
        
        // B) Buscar TODAS as Alocações
         const allAllocQuery = query(
            allocationRef,
            where('clientId', '==', clientId),
            orderBy('date', 'asc')
         );
         
        const [transSnapshot, allAllocSnapshot] = await Promise.all([
            getDocs(transQuery),
            getDocs(allAllocQuery),
        ]);

        const allTransactions = transSnapshot.docs.map(d => {
            const data = d.data();
            return {
                ...data,
                id: d.id,
                date: data.date,
                type: 'transaction' as const,
                transactionType: data.type,
                amount: Number(data.amount) || 0,
                portfolioValueBefore: Number(data.portfolioValueBefore) || 0
            } as Transaction;
        });
        const allAllocations = allAllocSnapshot.docs.map(d => ({ type: 'allocation', id: d.id, ...d.data(), date: d.data().date } as AllocationSnapshot & { type: 'allocation', id: string, date: string })); // Garantir date como string

        console.log(`[TWRR] Total Transações encontradas: ${allTransactions.length}`); // LOG DADOS
        console.log(`[TWRR] Total Alocações encontradas: ${allAllocations.length}`); // LOG DADOS

        // Combinar e ordenar todos os eventos
        const allEvents: any[] = [...allTransactions, ...allAllocations].sort((a, b) => {
            const dateComparison = a.date.localeCompare(b.date);
            if (dateComparison !== 0) return dateComparison;
            
            // Regra de desempate: transação antes de alocação
            const typeA = (a as any).type;
            const typeB = (b as any).type;
            
            if (typeA === 'transaction' && typeB === 'allocation') return -1;
            if (typeA === 'allocation' && typeB === 'transaction') return 1;
            return 0; // Mantém ordem original se data e tipo forem iguais (improvável)
        });

        if (allEvents.length === 0) {
            console.error("[TWRR] Erro: Nenhum evento (alocação ou transação) encontrado para o cliente.");
            setError("Nenhum dado de alocação ou transação encontrado para este cliente.");
            setLoading(false);
            return;
        }

        // --- 2. Determinar Ponto Inicial Efetivo --- 
        let initialValuePoint = null;
        let initialValue = 0;
        let initialValueDate = '';
        let effectiveStartDate = startDate; // Assume a data do usuário por padrão

        // Encontra o último evento <= startDate
        const lastEventBeforeOrOnStartDate = [...allEvents].reverse().find(e => e.date <= startDate);

        if (lastEventBeforeOrOnStartDate) {
            initialValuePoint = lastEventBeforeOrOnStartDate;
            initialValue = initialValuePoint.type === 'allocation' ? initialValuePoint.totalValue : initialValuePoint.portfolioValueBefore; // Usa o valor correto
            // Correção: Se o evento for uma transação, o valor inicial é *após* o fluxo dela se ela for *exatamente* em startDate
             if (initialValuePoint.type === 'transaction' && initialValuePoint.date === startDate) {
                 const numericAmount = Number(initialValuePoint.amount);
                 const isDeposit = initialValuePoint.transactionType === 'aporte' || initialValuePoint.transactionType === 'deposit' || initialValuePoint.transactionType === 'entrada';
                 const cashFlow = isDeposit ? numericAmount : -numericAmount;
                 initialValue = initialValuePoint.portfolioValueBefore + cashFlow; 
                 console.log(`[TWRR] Ajuste: Evento inicial é transação na data de início. Valor inicial definido para PÓS-fluxo: ${formatCurrency(initialValue)}`);
             }
            initialValueDate = initialValuePoint.date;
            console.log(`[TWRR] Ponto inicial encontrado ANTES/EM ${startDate}: Data=${initialValueDate}, Tipo=${initialValuePoint.type}, Valor Base=${formatCurrency(initialValue)}`);
        } else {
            // Não há eventos antes/em startDate, encontra o primeiro APÓS startDate
            const firstEventAfterStartDate = allEvents.find(e => e.date > startDate);
            if (firstEventAfterStartDate) {
                initialValuePoint = firstEventAfterStartDate;
                // O valor inicial *antes* deste primeiro evento é considerado 0 para TWRR?
                // Não, o valor inicial é o valor *neste* ponto. O TWRR começa aqui.
                initialValue = firstEventAfterStartDate.type === 'allocation' ? firstEventAfterStartDate.totalValue : firstEventAfterStartDate.portfolioValueBefore;
                // Se for transação, o valor inicial é o valor ANTES dela.
                initialValueDate = firstEventAfterStartDate.date;
                effectiveStartDate = initialValueDate; // O período efetivo começa NESTA data
                console.log(`[TWRR] Nenhum ponto antes/em ${startDate}. Iniciando no PRIMEIRO evento APÓS: Data=${initialValueDate}, Tipo=${initialValuePoint.type}, Valor Base=${formatCurrency(initialValue)}`);
            } else {
                console.error(`[TWRR] Erro: Nenhum evento encontrado antes, em, ou após ${startDate}.`);
                setError(`Não há dados de alocação/transação no período selecionado ou após ${startDate}.`);
                setLoading(false);
                return;
            }
        }

        // --- 3. Determinar Ponto Final Efetivo --- 
        let finalValuePoint = null;
        let finalValue = 0;
        let effectiveEndDate = '';

        // Encontra o último evento <= endDate
        const lastEventBeforeOrOnEndDate = [...allEvents].reverse().find(e => e.date <= endDate);

        if (lastEventBeforeOrOnEndDate) {
            finalValuePoint = lastEventBeforeOrOnEndDate;
            // O valor final é o valor DEPOIS do fluxo se for transação, ou o valor da alocação
            if (finalValuePoint.type === 'allocation') {
                finalValue = finalValuePoint.totalValue;
            } else { // Transação
                 const numericAmount = Number(finalValuePoint.amount);
                 const isDeposit = finalValuePoint.transactionType === 'aporte' || finalValuePoint.transactionType === 'deposit' || finalValuePoint.transactionType === 'entrada';
                 const cashFlow = isDeposit ? numericAmount : -numericAmount;
                 // Se portfolioValueBefore existe, usa ele + cashflow, senão, loga erro ou usa fallback?
                 if (typeof finalValuePoint.portfolioValueBefore === 'number') {
                     finalValue = finalValuePoint.portfolioValueBefore + cashFlow;
                 } else {
                      console.error(`[TWRR] Erro: portfolioValueBefore ausente na transação final ${finalValuePoint.id} em ${finalValuePoint.date}. Não é possível determinar valor final.`);
                      setError(`Dado portfolioValueBefore ausente na transação final em ${finalValuePoint.date}.`);
                      setLoading(false);
                      return;
                 }
            }
            effectiveEndDate = finalValuePoint.date;
            console.log(`[TWRR] Ponto final encontrado ANTES/EM ${endDate}: Data=${effectiveEndDate}, Tipo=${finalValuePoint.type}, Valor Final=${formatCurrency(finalValue)}`);
        } else {
            // Isso não deveria acontecer se o ponto inicial foi encontrado, a menos que endDate < startDate
            console.error(`[TWRR] Erro: Nenhum evento encontrado antes ou em ${endDate} (mas havia eventos antes/após ${startDate}). Verifique o intervalo.`);
            setError(`Não há dados de alocação/transação antes ou em ${endDate}.`);
            setLoading(false);
            return;
        }

        // Validação final do período efetivo
        if (new Date(effectiveEndDate) < new Date(initialValueDate)) {
            console.error(`[TWRR] Erro: Período efetivo de cálculo inválido (final ${effectiveEndDate} < inicial ${initialValueDate}). Não há eventos entre os pontos.`);
            setError(`Período de cálculo inválido ou sem eventos entre ${initialValueDate} e ${effectiveEndDate}. Verifique as datas selecionadas e os dados disponíveis.`);
            // Resetar estado para indicar que não há cálculo válido
            setProfitability(null);
            setAbsoluteGainLoss(null);
            setChartData([]);
            setDisplayStartDate(startDate); // Mostra datas do usuário
            setDisplayEndDate(endDate);
            setLoading(false);
            return;
        }
        console.log(`[TWRR] Período Efetivo Calculado: ${effectiveStartDate} a ${effectiveEndDate}`); // LOG PERÍODO EFETIVO
        console.log(`[TWRR] Datas para Cálculo TWRR: ${initialValueDate} (Valor: ${formatCurrency(initialValue)}) a ${effectiveEndDate} (Valor: ${formatCurrency(finalValue)})`); // LOG PERÍODO CÁLCULO
        
        // Atualizar datas de exibição para o período REAL calculado
        setDisplayStartDate(effectiveStartDate);
        setDisplayEndDate(effectiveEndDate); 

        // --- 4. Filtrar Eventos para o Loop de Cálculo --- 
        const eventsForLoop = allEvents.filter(e => 
            e.date > initialValueDate && e.date <= effectiveEndDate
        );
        console.log(`[TWRR] Eventos filtrados para loop: ${eventsForLoop.length}`);

        // --- 5. Calcular TWRR e Dados do Gráfico --- 
        let cumulativeReturnFactor = 1.0;
        let currentValue = initialValue;
        let totalNetCashFlow = 0; 
        const pointsForChart: ProfitabilityChartDataPoint[] = [
             { date: effectiveStartDate, cumulativeReturn: 0 } // Ponto inicial sempre na data de início EFETIVA com 0%
        ]; 
        let lastProcessedDate = initialValueDate; // O último ponto processado foi o inicial
        console.log(`[TWRR] Iniciando loop TWRR. Valor base (${initialValueDate}): ${formatCurrency(currentValue)}`); // LOG LOOP

        // O loop agora usa eventsForLoop
        for (const event of eventsForLoop) { 
            const eventDate = event.date;
            let valueBeforeEvent = currentValue; // Valor no início do sub-período
            let cashFlow = 0;
            // Adicionar mais logs para debug
            console.log(`\n[TWRR] Processando Evento: Data=${eventDate}, Tipo=${event.type}, ID=${event.id}`); 
            console.log(`[DEBUG] Verificando Propriedade 'type' do evento:`, event.type);
            
            // ADICIONAL: Log para ver transação original
            if (event.type === 'transaction' || event.type === 'aporte' || event.type === 'resgate') { // Ajustado para incluir aporte/resgate direto
                console.log(`[DEBUG] Evento de Fluxo de Caixa Original:`, { ...event });
            }

            // --- Lógica de Cálculo de HPR (Antes do Fluxo de Caixa) ---
            let hpr = 1.0;
            console.log(`[TWRR] Calculando HPR (antes do fluxo): currentValue=${formatCurrency(currentValue)}`); // LOG HPR
            if (currentValue > 0) {
                // Valor ANTES do evento de fluxo (se for transação/aporte/resgate)
                // ou o valor da alocação (se for allocation)
                let subPeriodEndValue = currentValue; // Assume que não muda por padrão (será sobrescrito abaixo)

                if(event.type === 'allocation') {
                    subPeriodEndValue = event.totalValue;
                    // valueBeforeEvent para atualização pós-fluxo deve ser o currentValue ANTES da alocação
                    valueBeforeEvent = currentValue; 
                } 
                // Para transaction, aporte, ou resgate, o valor final do sub-período 
                // é o valor *imediatamente antes* do fluxo de caixa.
                // Usar event.portfolioValueBefore se disponível.
                else if (event.type === 'transaction' || event.type === 'aporte' || event.type === 'resgate') {
                    // Acessar transactionType corretamente se for 'transaction'
                    const eventTransactionType = event.type === 'transaction' ? event.transactionType : event.type;
                    if (typeof event.portfolioValueBefore === 'number' && !isNaN(event.portfolioValueBefore)) {
                        subPeriodEndValue = event.portfolioValueBefore;
                        valueBeforeEvent = event.portfolioValueBefore; // Crucial: Use este valor exato para a atualização pós-fluxo
                        console.log(`[TWRR] Usando portfolioValueBefore (${formatCurrency(subPeriodEndValue)}) como fim do sub-período para ${eventTransactionType}`);
                    } else {
                        // Fallback: Se portfolioValueBefore estiver faltando, assumir HPR = 1.0
                        subPeriodEndValue = currentValue; 
                        valueBeforeEvent = currentValue; // Use currentValue para atualização pós-fluxo se valor específico faltar
                        console.warn(`[TWRR] Aviso: portfolioValueBefore ausente/inválido para ${eventTransactionType} em ${event.date}. HPR será 1.0.`);
                    }
                } 

                hpr = subPeriodEndValue / currentValue;
                console.log(`[TWRR] HPR: subPeriodEndValue=${formatCurrency(subPeriodEndValue)} / currentValue=${formatCurrency(currentValue)} = ${hpr.toFixed(5)}`); // LOG HPR
            } else if (currentValue < 0) {
                 console.error(`[TWRR] Erro: Valor base negativo (${formatCurrency(currentValue)}) antes de ${event.date}.`); // LOG ERRO
                 setError(`Cálculo TWRR interrompido: Valor base negativo antes de ${event.date}.`);
                 cumulativeReturnFactor = NaN; break;
            } // Se currentValue === 0, hpr continua 1.0

            const oldFactor = cumulativeReturnFactor;
            cumulativeReturnFactor *= hpr;
            console.log(`[TWRR] Fator Acumulado (pós HPR): ${oldFactor.toFixed(5)} * ${hpr.toFixed(5)} = ${cumulativeReturnFactor.toFixed(5)}`); // LOG FATOR

            // Adiciona ponto ao gráfico na data do evento (após HPR), se a data mudou
             if (eventDate > lastProcessedDate) { 
                 if (!isNaN(cumulativeReturnFactor) && isFinite(cumulativeReturnFactor)) {
                     const lastPoint = pointsForChart[pointsForChart.length - 1];
                     const newReturn = (cumulativeReturnFactor - 1) * 100;
                     // Evitar pontos duplicados na mesma data se múltiplos eventos ocorrerem
                     // Se a nova data for a mesma da data efetiva de início, e estamos no primeiro evento,
                     // atualiza o ponto inicial em vez de adicionar um novo.
                     if (lastPoint.date === effectiveStartDate && lastPoint.date === eventDate) {
                         lastPoint.cumulativeReturn = newReturn;
                         console.log(`[TWRR] Atualizando Ponto Gráfico INICIAL: Data=${eventDate}, Retorno=${newReturn.toFixed(2)}%`); // LOG GRÁFICO
                     } else if (lastPoint.date === eventDate) {
                         lastPoint.cumulativeReturn = newReturn;
                         console.log(`[TWRR] Atualizando Ponto Gráfico: Data=${eventDate}, Retorno=${newReturn.toFixed(2)}%`); // LOG GRÁFICO
                     } else {
                         pointsForChart.push({
                             date: eventDate,
                             cumulativeReturn: newReturn,
                         });
                         console.log(`[TWRR] Adicionando Ponto Gráfico: Data=${eventDate}, Retorno=${newReturn.toFixed(2)}%`); // LOG GRÁFICO
                     }
                     lastProcessedDate = eventDate; 
                 } else {
                     console.error(`[TWRR] Erro: Fator acumulado inválido em ${event.date}.`); // LOG ERRO
                     if (!error) setError(`Cálculo TWRR resultou em valor inválido em ${event.date}.`);
                     cumulativeReturnFactor = NaN; 
                     break; 
                 }
             }

            // --- Lógica de Atualização de Valor (APÓS HPR, Considerando Fluxo de Caixa) ---
            const valueBeforeUpdate = currentValue; // Guarda o valor antes de aplicar o fluxo
            cashFlow = 0; // Reseta cashFlow para cada evento

            if (event.type === 'allocation') {
                currentValue = event.totalValue;
            } else { // Evento é 'transaction', 'aporte', ou 'resgate'
                const numericAmount = Number(event.amount);
                if (isNaN(numericAmount)) {
                     console.error(`[TWRR] Erro: Falha ao converter event.amount (${event.amount}) para número em ${event.date}.`);
                     setError(`Erro interno ao ler valor (amount) em ${event.date}.`);
                     cumulativeReturnFactor = NaN; break;
                }
                
                let isDeposit = false;
                // Acessar transactionType corretamente
                 const eventTransactionType = event.type === 'transaction' ? event.transactionType : event.type;
                if (event.type === 'transaction') {
                    // Lógica anterior para determinar tipo dentro de 'transaction'
                    console.log(`[DEBUG] Tipo de transação identificado: ${eventTransactionType}`);
                    isDeposit = eventTransactionType === 'aporte' || eventTransactionType === 'deposit' || eventTransactionType === 'entrada';
                } else if (eventTransactionType === 'aporte') {
                    isDeposit = true;
                } // Se for 'resgate', isDeposit continua false

                cashFlow = isDeposit ? numericAmount : -numericAmount;
                console.log(`[DEBUG] Evento ${eventTransactionType}: isDeposit=${isDeposit}, cashFlow calculado=${formatCurrency(cashFlow)}`);
                totalNetCashFlow += cashFlow; // *** Acumula fluxo de caixa do LOOP ***

                // Atualiza currentValue: Valor ANTES do fluxo + fluxo
                // Usamos 'valueBeforeEvent' que foi definido corretamente na seção de HPR
                const numValueBeforeEvent = Number(valueBeforeEvent);
                const numCashFlow = Number(cashFlow);
                console.log(`[DEBUG] Tentando atualizar currentValue: Number(valueBeforeEvent)=${numValueBeforeEvent}, Number(cashFlow)=${numCashFlow}`); // DEBUG LOG

                if (isNaN(numValueBeforeEvent) || isNaN(numCashFlow)) {
                     console.error(`[TWRR] Erro: Falha ao converter valores para número antes da atualização (Pós-Fluxo). valueBeforeEvent=${valueBeforeEvent}, cashFlow=${cashFlow}`);
                     setError(`Erro interno ao converter valores para atualização após fluxo em ${event.date}.`);
                     cumulativeReturnFactor = NaN; break;
                }
                currentValue = numValueBeforeEvent + numCashFlow;
                console.log(`[DEBUG] Resultado da soma (currentValue pós-fluxo): ${currentValue}`);
                 if (isNaN(currentValue)) { 
                     console.error(`[TWRR] Erro: Resultado da atualização de currentValue pós-fluxo é NaN.`);
                     setError(`Erro interno ao atualizar valor após fluxo em ${event.date}.`);
                     cumulativeReturnFactor = NaN; break; 
                 }
            }
             console.log(`[TWRR] Valor Atualizado (pós-evento/fluxo): ${formatCurrency(currentValue)} (era ${formatCurrency(valueBeforeUpdate)})`); // LOG VALOR ATUAL
        }
        console.log("[TWRR] Fim do loop de eventos."); // LOG LOOP FIM

        // --- 6. Calcular Retorno Final e Ponto Final do Gráfico --- 
         // Agora usamos effectiveEndDate e o currentValue após o último evento processado
        console.log(`[TWRR] Calculando HPR Final: currentValue=${formatCurrency(currentValue)}, finalValue=${formatCurrency(finalValue)}, effectiveEndDate=${effectiveEndDate}, lastProcessedDate=${lastProcessedDate}`); // LOG FINAL HPR
        if (!isNaN(cumulativeReturnFactor)) {
            // Calcula HPR do último evento processado (lastProcessedDate) até a data final efetiva (effectiveEndDate)
            if (currentValue > 0 && effectiveEndDate > lastProcessedDate) {
                // Cálculo correto do HPR final: Valor final / Valor corrente (após o último evento do loop)
                const hpr_last = finalValue / currentValue;
                console.log(`[TWRR] HPR Final: ${finalValue} / ${currentValue} = ${hpr_last.toFixed(5)}`); // LOG FINAL HPR CORRETO
                
                if (!isNaN(hpr_last) && isFinite(hpr_last)) {
                     const factorBeforeMult = cumulativeReturnFactor; 
                     cumulativeReturnFactor *= hpr_last;
                      if (!isFinite(cumulativeReturnFactor)) {
                           console.error(`[TWRR] Erro: Fator acumulado tornou-se inválido após HPR final. Fator antes=${factorBeforeMult.toFixed(5)}, HPR=${hpr_last.toFixed(5)}`);
                           if (!error) setError(`Erro no cálculo final da rentabilidade.`);
                           cumulativeReturnFactor = NaN; 
                      } else {
                           console.log(`[TWRR] Fator Acumulado Final: ${cumulativeReturnFactor.toFixed(5)}`);
                      }
                 } else {
                      console.error(`[TWRR] Erro: HPR final inválido.`);
                      if (!error) setError(`Cálculo do HPR final inválido (${finalValue} / ${currentValue}) em ${effectiveEndDate}.`);
                      cumulativeReturnFactor = NaN; 
                 }
            } else if (currentValue <= 0 && finalValue > 0) {
                 console.error("[TWRR] Erro: Inconsistência - Valor final positivo após valor corrente zero/negativo.");
                 if (!error) setError("Inconsistência detectada: Valor final positivo após valor corrente zerar ou negativar.");
                 cumulativeReturnFactor = NaN;
            } else {
                 console.log("[TWRR] HPR Final: Não calculado (currentValue <= 0 ou data final não é posterior ao último evento processado). Fator permanece o do último evento.");
            }

            // Adiciona o ponto final do gráfico na data final EFETIVA 
            // SOMENTE se ela for posterior à data do último evento processado E o fator for válido
            if (!isNaN(cumulativeReturnFactor) && isFinite(cumulativeReturnFactor) && effectiveEndDate > lastProcessedDate) {
                 const finalReturn = (cumulativeReturnFactor - 1) * 100;
                 // Verifica se já existe um ponto exatamente na data final (caso do último evento ser na data final)
                  const lastChartPoint = pointsForChart[pointsForChart.length-1];
                  if(lastChartPoint.date === effectiveEndDate){
                       lastChartPoint.cumulativeReturn = finalReturn;
                       console.log(`[TWRR] Atualizando Ponto Gráfico FINAL: Data=${effectiveEndDate}, Retorno=${finalReturn.toFixed(2)}%`);
                  } else {
                       pointsForChart.push({
                           date: effectiveEndDate,
                           cumulativeReturn: finalReturn,
                       });
                       console.log(`[TWRR] Adicionando Ponto Gráfico Final: Data=${effectiveEndDate}, Retorno=${finalReturn.toFixed(2)}%`);
                  }
            } else if (isNaN(cumulativeReturnFactor) || !isFinite(cumulativeReturnFactor)){ 
                 if (!error && effectiveEndDate > lastProcessedDate) {
                    console.error(`[TWRR] Erro: Fator acumulado final inválido, não adicionando ponto final.`);
                    setError(`Cálculo TWRR final resultou em valor inválido em ${effectiveEndDate}.`);
                 } 
            }
        }

        // --- 7. Definir Resultados --- 
        // Recalcula o fluxo de caixa líquido TOTAL (abrangendo o período EFETIVO do cálculo)
         const effectiveTotalNetCashFlow = allTransactions
            .filter(t => t.date > initialValueDate && t.date <= effectiveEndDate)
            .reduce((sum, t) => {
                const numericAmount = Number(t.amount);
                if (isNaN(numericAmount)) return sum; // Ignora transações com valor inválido
                const isDeposit = t.transactionType === 'aporte' || t.transactionType === 'deposit' || t.transactionType === 'entrada';
                return sum + (isDeposit ? numericAmount : -numericAmount);
            }, 0);
        console.log(`[TWRR] Fluxo de Caixa Líquido Efetivo (${initialValueDate} a ${effectiveEndDate}): ${formatCurrency(effectiveTotalNetCashFlow)}`);

        console.log(`[TWRR] Definindo resultados finais. Fator Final: ${cumulativeReturnFactor?.toFixed(5)}`); // LOG RESULTADO
        if (!isNaN(cumulativeReturnFactor) && isFinite(cumulativeReturnFactor)) {
          const twrrPercentage = (cumulativeReturnFactor - 1) * 100;
          setProfitability(twrrPercentage);
          // *** CÁLCULO CORRETO DO GANHO/PERDA ABSOLUTA ***
          const gainLoss = finalValue - initialValue - effectiveTotalNetCashFlow; // Usa o fluxo de caixa efetivo
          setAbsoluteGainLoss(gainLoss);
          // Remove pontos inválidos antes de setar (segurança extra)
           const finalChartData = pointsForChart.filter(p => !isNaN(p.cumulativeReturn) && isFinite(p.cumulativeReturn));
           setChartData(finalChartData);
           console.log(`[TWRR] Resultados: TWRR=${twrrPercentage.toFixed(2)}%, Ganho/Perda=${formatCurrency(gainLoss)}, Pontos Gráfico=${finalChartData.length}`); // LOG RESULTADO
           // console.log("[TWRR] Pontos do Gráfico:", finalChartData); // LOG DETALHADO GRÁFICO (descomentar se necessário)
        } else {
          console.warn("[TWRR] Fator acumulado final inválido. Resetando resultados."); // LOG AVISO
          setProfitability(null);
          setAbsoluteGainLoss(null);
          setChartData([]); 
        }

      } catch (err: any) {
         console.error("[TWRR] Erro CATCH GERAL:", err); // LOG ERRO GERAL
        setError(`Erro ao calcular rentabilidade: ${err.message || 'Erro desconhecido.'}`);
        setProfitability(null);
        setAbsoluteGainLoss(null);
        setChartData([]);
      } finally {
         console.log("[TWRR] Cálculo finalizado."); // LOG FIM
        setLoading(false);
      }
  }, [clientId, db]); // REMOVIDO formatCurrency das dependências

  // Handler para botões de período predefinido
  const handlePresetClick = useCallback((preset: 'MTD' | 'YTD' | '12M' | 'ALL') => {
    setPeriodType(preset);
    const today = new Date();
    let start = '';
    let end = today.toISOString().split('T')[0];

    switch (preset) {
        case 'MTD': start = getFirstDayOfMonth(today); break;
        case 'YTD': start = getFirstDayOfYear(today); break;
        case '12M': start = getFirstDayOfLast12Months(today); break;
        case 'ALL': start = '1970-01-01'; break; 
    }
    calculatePreciseTWRR(start, end);
  }, [calculatePreciseTWRR]); // Depende da função de cálculo

  // Handler para o botão "Aplicar" do período customizado
  const handleCustomApplyClick = useCallback(() => {
     if (!customStartDate || !customEndDate) {
         setError("Selecione as datas de início e fim.");
         setProfitability(null); // Limpa resultados antigos
         setAbsoluteGainLoss(null);
         setChartData([]);
         setDisplayStartDate(null);
         setDisplayEndDate(null);
         return;
     }
     if (new Date(customEndDate) < new Date(customStartDate)) {
        setError("Data final não pode ser anterior à data inicial.");
         setProfitability(null); // Limpa resultados antigos
         setAbsoluteGainLoss(null);
         setChartData([]);
         setDisplayStartDate(null);
         setDisplayEndDate(null);
        return;
     }
     setPeriodType('CUSTOM');
     calculatePreciseTWRR(customStartDate, customEndDate);
  }, [customStartDate, customEndDate, calculatePreciseTWRR]); // Depende das datas e da função


  // useEffect para cálculo INICIAL (apenas na montagem)
  useEffect(() => {
    // Calcula para o período padrão inicial ('YTD')
    const today = new Date();
    const start = getFirstDayOfYear(today);
    const end = today.toISOString().split('T')[0];
    calculatePreciseTWRR(start, end);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatePreciseTWRR]); // Roda apenas uma vez referenciando a função memoizada

  // Função para formatar data para o eixo X do gráfico (ex: DD/MM)
  const formatDateTick = (tickItem: string) => {
      try {
          // Adiciona 'T00:00:00' para garantir que seja interpretado como UTC e evitar problemas de fuso
          const date = new Date(tickItem + 'T00:00:00'); 
          return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      } catch (e) { return tickItem; }
  };

  // Formatter para o tooltip do gráfico
   const formatTooltip = (value: number, name: string, props: any) => {
       const formattedValue = `${value.toFixed(2)}%`;
       return [formattedValue, 'Retorno Acumulado'];
   };
    const formatTooltipLabel = (label: string) => {
        try {
             const date = new Date(label + 'T00:00:00');
             return `Data: ${date.toLocaleDateString('pt-BR')}`;
        } catch (e) { return label; }
    };


  const renderResult = () => {
    // Mostra loading primeiro
     if (loading) {
       return <div className="text-center py-4"><span className="text-gray-400 italic">Calculando...</span></div>;
     }
     // Mostra erro se houver
     if (error) {
        // Não mostra o resultado numérico se houver erro, apenas a mensagem
       return null; // O erro já é mostrado em seu próprio container
     }
     // Mostra resultado se não estiver carregando e não houver erro
    if (profitability !== null) {
      return (
        <>
          <span className={`font-bold text-3xl ${profitability >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {profitability.toFixed(2)}%
          </span>
           {absoluteGainLoss !== null && (
              <p className={`text-sm mt-1 ${absoluteGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                   {absoluteGainLoss >= 0 ? '+' : ''}{formatCurrency(absoluteGainLoss)}
              </p>
           )}
        </>
      );
    }
     // Fallback se não carregando, sem erro, mas sem resultado (ex: dados insuficientes)
    return <span className="text-gray-500 text-3xl">-</span>;
  };

  return (
    <div className="space-y-6">
       {/* Seletor de Período */}
       <div className="flex flex-wrap items-center gap-2 mb-4">
            {/* Botões Predefinidos */}
            {(['MTD', 'YTD', '12M', 'ALL'] as const).map((p) => (
               <button
                 key={p}
                 onClick={() => handlePresetClick(p)} // USA O NOVO HANDLER
                 className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                   periodType === p 
                     ? 'bg-cyan-600 text-white' 
                     : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                 }`}
               >
                 {p === 'MTD' ? 'Mês Atual' : p === 'YTD' ? 'Ano Atual' : p === '12M' ? 'Últimos 12M' : 'Todo Período'}
               </button>
            ))}
            {/* Inputs de Data Personalizada */}
            <div className="flex items-center gap-2 border-l border-gray-600 pl-3 ml-1">
                <input 
                    type="date" 
                    value={customStartDate} 
                    onChange={(e) => {
                       setCustomStartDate(e.target.value);
                       // Limpa erro ao digitar, mas NÃO recalcula
                       if(error) setError(null); 
                    }}
                    className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    max={customEndDate || undefined} // Impede data inicial > final
                 />
                 <span className="text-gray-400">-</span>
                 <input 
                    type="date" 
                    value={customEndDate} 
                    onChange={(e) => {
                        setCustomEndDate(e.target.value); 
                        // Limpa erro ao digitar, mas NÃO recalcula
                        if(error) setError(null); 
                    }}
                    className="px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    min={customStartDate || undefined} // Impede data final < inicial
                    max={new Date().toISOString().split('T')[0]} // Impede data futura
                 />
                 <button
                    onClick={handleCustomApplyClick} // USA O NOVO HANDLER
                    disabled={!customStartDate || !customEndDate || loading}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      periodType === 'CUSTOM' 
                       ? 'bg-cyan-600 text-white' 
                       : 'bg-gray-600 text-gray-300 hover:bg-cyan-700'
                     } disabled:opacity-50 disabled:cursor-not-allowed`}
                 >
                    Aplicar
                 </button>
            </div>
       </div>

       {/* Exibição do Período Calculado e Resultado */}
       <div className="text-center">
          <div className="mb-2">
             <span className="text-sm text-gray-400">
                Período Calculado: {displayStartDate ? new Date(displayStartDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'} a {displayEndDate ? new Date(displayEndDate + 'T00:00:00').toLocaleDateString('pt-BR') : '-'} 
             </span>
          </div>
          {/* Container para o resultado numérico */}
          <div className="min-h-[60px] flex flex-col items-center justify-center"> 
             {renderResult()}
          </div>
          {/* Container para mensagem de erro */}
           {error && !loading && (
               <div className="mt-2 text-red-500 text-sm">{error}</div>
           )}
       </div>

      {/* Gráfico de Rentabilidade */}
       {chartData.length > 1 && !loading && !error && (
          <div className="h-72 w-full mt-6"> 
             <ResponsiveContainer>
                 <LineChart 
                    data={chartData}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                 >
                     <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                     <XAxis 
                         dataKey="date" 
                         stroke="#9ca3af" 
                         tickFormatter={formatDateTick} 
                         minTickGap={30} // Evita sobreposição de datas
                     />
                     <YAxis 
                         stroke="#9ca3af" 
                         tickFormatter={(value) => `${value.toFixed(1)}%`}
                         domain={['auto', 'auto']} // Ajusta domínio automaticamente
                         allowDataOverflow={true}
                         width={50} // Aumenta espaço para o eixo Y
                     />
                     <Tooltip 
                         contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                         labelStyle={{ color: '#e5e7eb', marginBottom: '5px' }}
                         itemStyle={{ color: '#38bdf8' }}
                         formatter={formatTooltip}
                         labelFormatter={formatTooltipLabel}
                     />
                     <Line 
                         type="monotone" 
                         dataKey="cumulativeReturn" 
                         stroke="#38bdf8" // Azul Cyan
                         strokeWidth={2}
                         dot={false} // Opcional: remover pontos
                         name="Retorno Acumulado" // Nome para legenda/tooltip
                     />
                 </LineChart>
             </ResponsiveContainer>
          </div>
       )}
       {chartData.length <= 1 && !loading && !error && (
           <div className="text-center text-gray-500 italic mt-6">
                {chartData.length === 1 ? 'Dados insuficientes para exibir o gráfico (necessário mais de um ponto).' : 'Sem dados de rentabilidade para exibir o gráfico.'}
           </div>
       )}

    </div>
  );
} 