/**
 * Утилита для визуального цветового разделения групп резервуаров (РГС-50, РГС-100, РК и др.)
 * Обеспечивает единый стиль оформления кнопок выбора резервуара во всех операциях
 * с автоматическим назначением уникального цвета для новых групп.
 */

export interface TankColorConfig {
  group: string;
  buttonClasses: string;
}

/**
 * Извлекает базовую группу / тип резервуара из его названия.
 * Примеры:
 * - "РГС-50 №1", "РГС-50 №8" -> "РГС-50"
 * - "РГС-100 №1", "РГС-100 №4" -> "РГС-100"
 * - "РК-1", "РК-2", "РК №1" -> "РК"
 * - "РВС-1000 №3" -> "РВС-1000"
 * - "Е-1", "Е-2" -> "Е"
 */
export function getTankGroup(tankName: string): string {
  if (!tankName) return '';
  const trimmed = tankName.trim();

  // 1. Если имя содержит разделитель номера № или # (например, "РГС-50 №1", "РГС-100 №2", "РВС-1000 #3")
  if (/[№#]/.test(trimmed)) {
    return trimmed.split(/[№#]/)[0].trim();
  }

  const upper = trimmed.toUpperCase();

  // 2. Для резервуаров РК (РК-1, РК-2, РК 1 и т.д.)
  if (upper.startsWith('РК')) {
    return 'РК';
  }

  // 3. Стандартные типы РГС / РВС с объемом (например, "РГС-50", "РГС-100", "РВС-1000")
  if (upper.startsWith('РГС-') || upper.startsWith('РВС-')) {
    // Отсекаем суффикс номера через пробел, если он есть (например, "РГС-50 1" -> "РГС-50")
    return trimmed.replace(/\s+\d+$/, '').trim();
  }

  // 4. Короткие префиксы вида Буквы-Число (например, "Е-1", "Ц-2")
  const letterHyphenNumMatch = trimmed.match(/^([А-Яа-яA-Za-z]+)-(\d+)$/);
  if (letterHyphenNumMatch) {
    return letterHyphenNumMatch[1].toUpperCase();
  }

  // 5. Запасной вариант: отсекаем завершающие цифры с разделителем
  return trimmed.replace(/\s*(?:№|#|-)?\s*\d+\s*$/, '').trim() || trimmed;
}

// 1. РГС-50: базовый нейтральный стиль проекта (slate/серый), сохраняем как есть
const RGS_50_STYLE =
  'bg-slate-100 hover:bg-slate-200/90 dark:bg-slate-800 dark:hover:bg-slate-700/90 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200';

// 2. РГС-100: светло-голубой акцент (sky/blue) для светлой и тёмной темы
const RGS_100_STYLE =
  'bg-sky-50 hover:bg-sky-100/90 dark:bg-sky-950/50 dark:hover:bg-sky-900/60 border border-sky-300 dark:border-sky-600/50 text-sky-950 dark:text-sky-100';

// 3. РК (РК-1): светло-бежевый / песочно-янтарный (amber/sand)
const RK_STYLE =
  'bg-amber-50 hover:bg-amber-100/90 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-300 dark:border-amber-600/50 text-amber-950 dark:text-amber-100';

// 4. Динамическая гармоничная палитра для любых новых типов резервуаров на будущее
const DYNAMIC_THEMES = [
  // Фиолетовый / Пурпурный
  'bg-purple-50 hover:bg-purple-100/90 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 border border-purple-300 dark:border-purple-600/50 text-purple-950 dark:text-purple-100',
  // Бирюзовый / Мятный
  'bg-teal-50 hover:bg-teal-100/90 dark:bg-teal-950/40 dark:hover:bg-teal-900/50 border border-teal-300 dark:border-teal-600/50 text-teal-950 dark:text-teal-100',
  // Кораллово-розовый
  'bg-rose-50 hover:bg-rose-100/90 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 border border-rose-300 dark:border-rose-600/50 text-rose-950 dark:text-rose-100',
  // Индиго
  'bg-indigo-50 hover:bg-indigo-100/90 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-600/50 text-indigo-950 dark:text-indigo-100',
  // Изумрудный
  'bg-emerald-50 hover:bg-emerald-100/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-600/50 text-emerald-950 dark:text-emerald-100',
];

/**
 * Детерминированный хеш для стабильного закрепления цвета за новым типом резервуара
 */
function hashGroupName(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Возвращает класс оформления кнопки для указанного резервуара.
 * @param tankName - название резервуара (например, "РГС-50 №1", "РГС-100 №2", "РК-1")
 * @param isSelected - активен ли резервуар (выбран в данный момент)
 * @param isMeasured - замерян ли резервуар (для режима инвентаризации)
 */
export function getTankButtonClasses(
  tankName: string,
  isSelected: boolean = false,
  isMeasured: boolean = false
): string {
  // Состояние: выбран в данный момент
  if (isSelected) {
    return 'bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-emerald-500 shadow-md ring-2 ring-emerald-400/50';
  }

  // Состояние: уже замерян (для инвентаризации)
  if (isMeasured) {
    return 'bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/20';
  }

  const group = getTankGroup(tankName).toUpperCase();

  // 1. Группа РГС-50 (оставить как есть)
  if (group === 'РГС-50') {
    return RGS_50_STYLE;
  }

  // 2. Группа РГС-100 (светло-голубой)
  if (group === 'РГС-100') {
    return RGS_100_STYLE;
  }

  // 3. Группа РК (светло-бежевый)
  if (group === 'РК') {
    return RK_STYLE;
  }

  // 4. Любые другие/новые типы резервуаров на будущее
  const themeIndex = hashGroupName(group) % DYNAMIC_THEMES.length;
  return DYNAMIC_THEMES[themeIndex];
}
