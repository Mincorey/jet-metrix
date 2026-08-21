export function getTankLimits(tankName: string) {
  if (!tankName) {
    return { maxVolume: Infinity, minVolume: 0, hasLimits: false };
  }

  const normalized = tankName.toUpperCase();

  if (normalized.includes('РК-1') || normalized.includes('ТИП') || normalized.includes('ВАГОН')) {
    return { maxVolume: Infinity, minVolume: 0, hasLimits: false };
  }

  if (normalized.includes('РГС-50')) {
    return {
      maxVolume: 52600,
      minVolume: 600,
      hasLimits: true,
    };
  }

  if (normalized.includes('РГС-100')) {
    return {
      maxVolume: 98000,
      minVolume: 2000,
      hasLimits: true,
    };
  }

  return { maxVolume: Infinity, minVolume: 0, hasLimits: false };
}
