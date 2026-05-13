export function normalizeDensity(densityInput: string | number): number {
  let density = typeof densityInput === 'string' 
    ? parseFloat(densityInput.replace(',', '.')) 
    : densityInput;
  
  if (isNaN(density) || density === 0) return 0;
  
  // Petroleum densities are usually between 0.6 and 1.0 kg/L.
  // If user inputs something like 785.9, 7859, 78590, we normalize it down to < 2
  while (density > 2) {
    density /= 10;
  }
  
  // Round to 4 decimal places to avoid floating point precision issues
  return parseFloat(density.toFixed(4));
}
