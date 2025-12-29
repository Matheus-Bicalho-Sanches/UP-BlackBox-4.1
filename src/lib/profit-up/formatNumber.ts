/**
 * Formata um número com vírgula como separador decimal e 2 casas decimais
 * @param value - Valor numérico a ser formatado
 * @returns String formatada (ex: "87,32")
 */
export function formatPrice(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/**
 * Formata um número de porcentagem com vírgula como separador decimal e 2 casas decimais
 * @param value - Valor numérico a ser formatado
 * @returns String formatada (ex: "+0,06%")
 */
export function formatPercentage(value: number): string {
  return value.toFixed(2).replace(".", ",") + "%";
}

