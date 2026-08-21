export interface TankLimitConfig {
  maxVolume: number;       // Верхняя граница наполнения (л)
  minVolume: number;       // Нижняя граница — незабираемый остаток (л)
  nominalCapacity: number; // Номинальная вместимость (л)
  hasLimits: boolean;      // Применяются ли лимиты
}

/**
 * Возвращает конфигурацию лимитов для заданного резервуара.
 * - РГС-50: верхняя граница 52 600 л, незабираемый остаток 600 л
 * - РГС-100: верхняя граница 98 000 л, незабираемый остаток 2 000 л
 * - РК-1, ЖД-цистерны и прочие: без лимитов
 */
export function getTankLimits(tankName: string): TankLimitConfig {
  if (!tankName) {
    return { maxVolume: Infinity, minVolume: 0, nominalCapacity: 0, hasLimits: false };
  }

  const normalized = tankName.toUpperCase();

  if (normalized.includes('РК-1') || normalized.includes('ТИП') || normalized.includes('ВАГОН')) {
    return { maxVolume: Infinity, minVolume: 0, nominalCapacity: 0, hasLimits: false };
  }

  if (normalized.includes('РГС-50')) {
    return {
      maxVolume: 52600,
      minVolume: 600,
      nominalCapacity: 50000,
      hasLimits: true,
    };
  }

  if (normalized.includes('РГС-100')) {
    return {
      maxVolume: 98000,
      minVolume: 2000,
      nominalCapacity: 100000,
      hasLimits: true,
    };
  }

  return { maxVolume: Infinity, minVolume: 0, nominalCapacity: 0, hasLimits: false };
}

export interface TankValidationResult {
  isValid: boolean;
  errorType?: 'overflow' | 'underflow';
  title?: string;
  message?: string;
  tankName: string;
  currentVolume: number;
  operationVolume: number;
  projectedVolume: number;
  limitVolume: number;
  diffVolume: number;
}

/**
 * Валидирует операцию над резервуаром на предмет выхода за границы предельного наполнения или незабираемого остатка.
 * @param deltaVolume - изменение объема (положительное при приеме, отрицательное при выдаче)
 */
export function validateTankOperation({
  tankName,
  currentVolume,
  deltaVolume,
  operationTypeLabel = 'Операция'
}: {
  tankName: string;
  currentVolume: number;
  deltaVolume: number;
  operationTypeLabel?: string;
}): TankValidationResult {
  const limits = getTankLimits(tankName);
  const curVol = Math.round(currentVolume || 0);
  const opVol = Math.round(Math.abs(deltaVolume || 0));
  const projectedVolume = Math.round(curVol + deltaVolume);

  if (!limits.hasLimits) {
    return {
      isValid: true,
      tankName,
      currentVolume: curVol,
      operationVolume: opVol,
      projectedVolume,
      limitVolume: 0,
      diffVolume: 0,
    };
  }

  // 1. Проверка на ПЕРЕПОЛНЕНИЕ (Превышение верхнего предела наполнения)
  if (projectedVolume > limits.maxVolume) {
    const overflow = projectedVolume - limits.maxVolume;
    return {
      isValid: false,
      errorType: 'overflow',
      title: 'Превышение предельного объема наполнения!',
      message: `В резервуаре «${tankName}» расчетный объем после проведения операции составит ${projectedVolume.toLocaleString('ru-RU')} л, что превышает максимально допустимый предел наполнения (${limits.maxVolume.toLocaleString('ru-RU')} л) на ${overflow.toLocaleString('ru-RU')} л. Проведение операции заблокировано.`,
      tankName,
      currentVolume: curVol,
      operationVolume: opVol,
      projectedVolume,
      limitVolume: limits.maxVolume,
      diffVolume: overflow,
    };
  }

  // 2. Проверка на НЕЗАБИРАЕМЫЙ ОСТАТОК (Ниже критического минимального уровня)
  if (projectedVolume < limits.minVolume) {
    const underflow = limits.minVolume - projectedVolume;
    return {
      isValid: false,
      errorType: 'underflow',
      title: 'Нарушение незабираемого остатка!',
      message: `В резервуаре «${tankName}» расчетный остаток после проведения операции составит ${projectedVolume.toLocaleString('ru-RU')} л, что ниже минимального незабираемого остатка (${limits.minVolume.toLocaleString('ru-RU')} л) на ${underflow.toLocaleString('ru-RU')} л. Проведение операции заблокировано.`,
      tankName,
      currentVolume: curVol,
      operationVolume: opVol,
      projectedVolume,
      limitVolume: limits.minVolume,
      diffVolume: underflow,
    };
  }

  return {
    isValid: true,
    tankName,
    currentVolume: curVol,
    operationVolume: opVol,
    projectedVolume,
    limitVolume: 0,
    diffVolume: 0,
  };
}

/**
 * Загружает текущее состояние всего резервуарного парка в виде словаря { [tankName]: currentVolume }
 */
export async function fetchParkStateMap(): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  try {
    const res = await fetch('/api/park-state');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        data.forEach((t: any) => {
          if (t.name) {
            map[t.name] = Number(t.volume) || 0;
          }
        });
      }
    }
  } catch (e) {
    console.error('Error fetching park state map:', e);
  }
  return map;
}

/**
 * Получает текущий остаток конкретного резервуара из /api/park-state
 */
export async function getTankCurrentVolume(tankName: string): Promise<number> {
  if (!tankName) return 0;
  const map = await fetchParkStateMap();
  return map[tankName] ?? 0;
}

