import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  Plane, 
  Droplet, 
  Scale, 
  Gauge, 
  Download, 
  RefreshCw, 
  TrendingUp, 
  AlertCircle, 
  Info,
  CalendarDays,
  ChevronDown,
  Check,
  X
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { domToPng } from 'modern-screenshot';
import { createClient } from '@supabase/supabase-js';
import { DayPicker, DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';
import { FuelDispensingVSRecord } from '../data/Fuel_Dispensing_VS';

type PeriodType = 'yesterday' | 'week' | 'month' | 'three_months' | 'six_months' | 'year' | 'custom';

interface PeriodFilterConfig {
  id: PeriodType;
  label: string;
  sublabel: string;
}

const PERIOD_CONFIG: PeriodFilterConfig[] = [
  { id: 'yesterday', label: 'Вчера', sublabel: '24 часа' },
  { id: 'week', label: 'Неделя', sublabel: '7 дней' },
  { id: 'month', label: 'Месяц', sublabel: '30 дней' },
  { id: 'three_months', label: '3 месяца', sublabel: '90 дней' },
  { id: 'six_months', label: 'Полгода', sublabel: '180 дней' },
  { id: 'year', label: 'Год', sublabel: '365 дней' },
];

const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const MONTH_SHORT_RU = [
  'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
];

interface DispensingVSDynamicsProps {
  onBack: () => void;
}

// Парсинг даты вида "ДД.ММ.ГГГГ ЧЧ:ММ" или "ДД.ММ.ГГГГ" в миллисекунды
function parseRuDate(dateStr: string): number {
  if (!dateStr) return 0;
  const parts = dateStr.trim().split(' ');
  const datePart = parts[0].split('.');
  const timePart = parts[1] ? parts[1].split(':') : ['00', '00'];
  if (datePart.length === 3) {
    const day = parseInt(datePart[0], 10);
    const month = parseInt(datePart[1], 10) - 1;
    const year = parseInt(datePart[2], 10);
    const hours = parseInt(timePart[0] || '0', 10);
    const minutes = parseInt(timePart[1] || '0', 10);
    const ts = new Date(year, month, day, hours, minutes).getTime();
    return isNaN(ts) ? 0 : ts;
  }
  return 0;
}

// Форматирование чисел с разделителями тысяч
function formatNumber(num: number): string {
  return Math.round(num).toLocaleString('ru-RU');
}

// Кастомный тултип для графика литров
const CustomLitersTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-emerald-500/30 text-white min-w-[210px] z-50">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-2 mb-2.5">
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {data.fullName || data.fullDate || data.date || label}
          </span>
          {data.time && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {data.time}
            </span>
          )}
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Объем:</span>
            <span className="font-bold text-emerald-400 text-sm font-mono">
              {formatNumber(data.liters)} л
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Масса:</span>
            <span className="font-medium text-slate-200 font-mono">
              {formatNumber(data.kg)} кг
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Плотность:</span>
            <span className="font-mono text-slate-300 font-medium">
              {Number(data.density).toFixed(4)} г/см³
            </span>
          </div>
          {data.count !== undefined && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">Операций в ВС:</span>
              <span className="font-semibold text-slate-200">{data.count}</span>
            </div>
          )}
          {data.tza && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">ТЗА:</span>
              <span className="font-medium text-slate-300">{data.tza}</span>
            </div>
          )}
          {data.controlNum && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Контрольный талон:</span>
              <span className="font-medium text-slate-300">№{data.controlNum}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Кастомный тултип для графика килограммов
const CustomKgTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-indigo-500/30 text-white min-w-[210px] z-50">
        <div className="flex items-center justify-between gap-2 border-b border-slate-700/80 pb-2 mb-2.5">
          <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {data.fullName || data.fullDate || data.date || label}
          </span>
          {data.time && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
              {data.time}
            </span>
          )}
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Масса:</span>
            <span className="font-bold text-indigo-400 text-sm font-mono">
              {formatNumber(data.kg)} кг
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Объем:</span>
            <span className="font-medium text-slate-200 font-mono">
              {formatNumber(data.liters)} л
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Плотность:</span>
            <span className="font-mono text-slate-300 font-medium">
              {Number(data.density).toFixed(4)} г/см³
            </span>
          </div>
          {data.count !== undefined && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">Операций в ВС:</span>
              <span className="font-semibold text-slate-200">{data.count}</span>
            </div>
          )}
          {data.tza && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
              <span className="text-slate-400">ТЗА:</span>
              <span className="font-medium text-slate-300">{data.tza}</span>
            </div>
          )}
          {data.controlNum && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Контрольный талон:</span>
              <span className="font-medium text-slate-300">№{data.controlNum}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export default function DispensingVSDynamics({ onBack }: DispensingVSDynamicsProps) {
  const [period, setPeriod] = useState<PeriodType>('yesterday');
  const [allRecords, setAllRecords] = useState<FuelDispensingVSRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // Состояние для выбора произвольного диапазона в календаре
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarRange, setCalendarRange] = useState<DateRange | undefined>(undefined);
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ from: Date; to: Date } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Загрузка всех данных заправок ВС
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Пробуем серверный эндпоинт Vercel API
      try {
        const response = await fetch('/api/fuel-dispensing-vs');
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const data = await response.json();
          if (Array.isArray(data) && data.length > 0) {
            setAllRecords(data);
            try {
              localStorage.setItem('cached_dispensing_vs_dynamics', JSON.stringify(data));
            } catch {}
            setLoading(false);
            return;
          }
        }
      } catch (apiErr) {
        console.warn('API endpoint не ответил, используем прямое подключение к базе данных:', apiErr);
      }

      // 2. Прямой запрос к Supabase (для локальной разработки Vite или резервного канала)
      const supabaseUrl = 'https://zjmwnprjxowljawtpdxz.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqbXducHJqeG93bGphd3RwZHh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA1OTkwOSwiZXhwIjoyMDkzNjM1OTA5fQ.Ulia_PsIqLaVnYY-gGwp_idMp5NjuLHYbV-6PQxiTZs';
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const { data: supaData, error: supaError } = await supabase
        .from('Fuel_Dispensing_VS')
        .select('*')
        .order('id', { ascending: false });

      if (supaError) throw supaError;

      if (Array.isArray(supaData)) {
        setAllRecords(supaData);
        try {
          localStorage.setItem('cached_dispensing_vs_dynamics', JSON.stringify(supaData));
        } catch {}
      } else {
        throw new Error('Некорректный формат ответа базы данных');
      }
    } catch (err: any) {
      console.warn('Не удалось загрузить данные из API и Supabase, пробуем локальный кэш:', err);
      const cached = localStorage.getItem('cached_dispensing_vs_dynamics');
      if (cached) {
        try {
          setAllRecords(JSON.parse(cached));
        } catch {
          setError(err.message || 'Ошибка загрузки данных');
        }
      } else {
        setError(err.message || 'Ошибка подключения к базе данных');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Обработка подтверждения выбора периода в календаре
  const handleApplyCalendarRange = () => {
    if (!calendarRange?.from) return;
    const from = new Date(calendarRange.from);
    from.setHours(0, 0, 0, 0);
    const to = calendarRange.to ? new Date(calendarRange.to) : new Date(from);
    to.setHours(23, 59, 59, 999);

    setAppliedCustomRange({ from, to });
    setPeriod('custom');
    setIsCalendarOpen(false);
  };

  // Сброс произвольного периода
  const handleResetCustomRange = () => {
    setAppliedCustomRange(null);
    setCalendarRange(undefined);
    setPeriod('yesterday');
  };

  // Вычисление данных для выбранного периода
  const processedData = useMemo(() => {
    if (!allRecords || allRecords.length === 0) {
      return {
        filteredRecords: [],
        chartData: [],
        totalLiters: 0,
        totalKg: 0,
        operationsCount: 0,
        avgDensity: '0.0000',
        dateRangeText: '',
        periodTitle: '',
        showAxisTicks: true,
        axisCaption: '',
      };
    }

    // Опорная дата: текущее время браузера
    const now = new Date();
    let startTs = 0;
    let endTs = now.getTime();
    let periodTitle = '';
    let isMonthlyBuckets = false;
    let monthBucketsCount = 0;
    let showAxisTicks = true;
    let axisCaption = '';

    if (period === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      y.setHours(0, 0, 0, 0);
      startTs = y.getTime();
      const ye = new Date(y);
      ye.setHours(23, 59, 59, 999);
      endTs = ye.getTime();
      periodTitle = 'Вчера';
      showAxisTicks = true;
      axisCaption = 'Время проведения заправок (чч:мм)';
    } else if (period === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      d.setHours(0, 0, 0, 0);
      startTs = d.getTime();
      periodTitle = 'За последнюю неделю (7 дней)';
      showAxisTicks = true;
      axisCaption = 'Посуточная динамика за 7 дней (календарные даты)';
    } else if (period === 'month') {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      d.setHours(0, 0, 0, 0);
      startTs = d.getTime();
      periodTitle = 'За последний месяц (30 дней)';
      // Для месяца скрываем нагромождение чисел на оси X, а под шкалой выводим название периода
      showAxisTicks = false;
      const startStr = new Date(startTs).toLocaleDateString('ru-RU');
      const endStr = new Date(endTs).toLocaleDateString('ru-RU');
      axisCaption = `Период: ${startStr} — ${endStr} (суточная динамика за 30 дней)`;
    } else if (period === 'three_months') {
      isMonthlyBuckets = true;
      monthBucketsCount = 3;
      periodTitle = 'За последние 3 месяца';
      showAxisTicks = true;
      axisCaption = 'Помесячная динамика за 3 месяца (суммарно по месяцам)';
      const d = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
      startTs = d.getTime();
    } else if (period === 'six_months') {
      isMonthlyBuckets = true;
      monthBucketsCount = 6;
      periodTitle = 'За последние полгода (6 месяцев)';
      showAxisTicks = true;
      axisCaption = 'Помесячная динамика за полгода (суммарно по 6 месяцам)';
      const d = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
      startTs = d.getTime();
    } else if (period === 'year') {
      isMonthlyBuckets = true;
      monthBucketsCount = 12;
      periodTitle = 'За последний год (12 месяцев)';
      showAxisTicks = true;
      axisCaption = 'Помесячная динамика за год (суммарно по 12 месяцам)';
      const d = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
      startTs = d.getTime();
    } else if (period === 'custom' && appliedCustomRange) {
      startTs = appliedCustomRange.from.getTime();
      endTs = appliedCustomRange.to.getTime();
      const diffDays = Math.ceil((endTs - startTs) / (1000 * 60 * 60 * 24));
      periodTitle = `Выбранный период (${diffDays} дн.)`;

      if (diffDays > 60) {
        // Больше 60 дней: помесячная агрегация
        isMonthlyBuckets = true;
        const startYear = appliedCustomRange.from.getFullYear();
        const startMonth = appliedCustomRange.from.getMonth();
        const endYear = appliedCustomRange.to.getFullYear();
        const endMonth = appliedCustomRange.to.getMonth();
        monthBucketsCount = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
        showAxisTicks = true;
        axisCaption = `Помесячная динамика: ${format(appliedCustomRange.from, 'dd.MM.yyyy')} — ${format(appliedCustomRange.to, 'dd.MM.yyyy')}`;
      } else if (diffDays > 14) {
        // От 15 до 60 дней: суточные точки, скрываем нагромождение чисел на оси X
        showAxisTicks = false;
        axisCaption = `Период: ${format(appliedCustomRange.from, 'dd.MM.yyyy')} — ${format(appliedCustomRange.to, 'dd.MM.yyyy')} (${diffDays} дней)`;
      } else {
        // До 14 дней: суточные точки с красивыми подписями дат
        showAxisTicks = true;
        axisCaption = `Посуточная динамика: ${format(appliedCustomRange.from, 'dd.MM.yyyy')} — ${format(appliedCustomRange.to, 'dd.MM.yyyy')}`;
      }
    }

    // Фильтрация записей по временному интервалу
    let filtered = allRecords.filter((r: any) => {
      const ts = r.Timestamp || parseRuDate(r.Date);
      return ts >= startTs && ts <= endTs;
    });

    // Резервная логика для "Вчера": если вчера операций не было, берем день последней смены
    if (period === 'yesterday' && filtered.length === 0) {
      const sortedAll = [...allRecords].sort((a: any, b: any) => {
        const tsA = a.Timestamp || parseRuDate(a.Date);
        const tsB = b.Timestamp || parseRuDate(b.Date);
        return tsB - tsA;
      });
      if (sortedAll.length > 0) {
        const lastRecordDate = sortedAll[0].Date ? sortedAll[0].Date.split(' ')[0] : '';
        if (lastRecordDate) {
          filtered = sortedAll.filter((r: any) => r.Date && r.Date.startsWith(lastRecordDate));
          periodTitle = `Последняя смена (${lastRecordDate})`;
          axisCaption = `Время проведения заправок за ${lastRecordDate} (чч:мм)`;
        }
      }
    }

    // Сортируем записи хронологически
    filtered.sort((a: any, b: any) => {
      const tsA = a.Timestamp || parseRuDate(a.Date);
      const tsB = b.Timestamp || parseRuDate(b.Date);
      return tsA - tsB;
    });

    // Сводные показатели
    const totalLiters = filtered.reduce((sum, r) => sum + (Number(r.Volume) || 0), 0);
    const totalKg = filtered.reduce((sum, r) => sum + (Number(r.Mass) || 0), 0);
    const operationsCount = filtered.length;
    const avgDensity = totalLiters > 0 ? (totalKg / totalLiters).toFixed(4) : '0.0000';

    // Формирование текстового диапазона дат
    let dateRangeText = '';
    if (filtered.length > 0) {
      const firstDate = filtered[0].Date ? filtered[0].Date.split(' ')[0] : '';
      const lastDate = filtered[filtered.length - 1].Date ? filtered[filtered.length - 1].Date.split(' ')[0] : '';
      if (firstDate === lastDate) {
        dateRangeText = firstDate;
      } else {
        dateRangeText = `${firstDate} — ${lastDate}`;
      }
    } else {
      const startDateStr = new Date(startTs).toLocaleDateString('ru-RU');
      const endDateStr = new Date(endTs).toLocaleDateString('ru-RU');
      dateRangeText = `${startDateStr} — ${endDateStr}`;
    }

    // Подготовка точек графика
    let chartData: any[] = [];

    if (isMonthlyBuckets) {
      // ======================================================================
      // АГРЕГАЦИЯ ПО МЕСЯЦАМ (3 точки для 3 мес., 6 точек для 6 мес., 12 для года)
      // ======================================================================
      const buckets: any[] = [];
      const anchorDate = (period === 'custom' && appliedCustomRange) ? appliedCustomRange.to : now;

      for (let i = monthBucketsCount - 1; i >= 0; i--) {
        const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth();
        const bStartTs = new Date(y, m, 1, 0, 0, 0, 0).getTime();
        const bEndTs = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();

        // Если это 3 месяца - выводим полное название месяца ('Июль', 'Август', 'Сентябрь')
        // Если полгода или год - выводим сокращение ('Июл', 'Авг', 'Сен')
        const tickName = monthBucketsCount <= 3 ? MONTH_NAMES_RU[m] : MONTH_SHORT_RU[m];

        buckets.push({
          name: tickName,
          fullName: `${MONTH_NAMES_RU[m]} ${y}`,
          date: `${MONTH_NAMES_RU[m]} ${y}`,
          startTs: bStartTs,
          endTs: bEndTs,
          liters: 0,
          kg: 0,
          count: 0,
        });
      }

      filtered.forEach((r: any) => {
        const ts = r.Timestamp || parseRuDate(r.Date);
        buckets.forEach((b) => {
          if (ts >= b.startTs && ts <= b.endTs) {
            b.liters += Number(r.Volume) || 0;
            b.kg += Number(r.Mass) || 0;
            b.count += 1;
          }
        });
      });

      chartData = buckets.map((b) => ({
        name: b.name,
        fullName: b.fullName,
        date: b.fullName,
        liters: b.liters,
        kg: b.kg,
        count: b.count,
        density: b.liters > 0 ? Number((b.kg / b.liters).toFixed(4)) : 0,
      }));

    } else if (period === 'yesterday') {
      // ======================================================================
      // ДЛЯ ВЧЕРА: каждая заправка ВС отдельной точкой по времени суток (чч:мм)
      // ======================================================================
      chartData = filtered.map((r: any, idx: number) => {
        const timePart = r.Date && r.Date.includes(' ') ? r.Date.split(' ')[1] : `№${idx + 1}`;
        return {
          name: timePart,
          time: timePart,
          date: r.Date ? r.Date.split(' ')[0] : '',
          fullDate: r.Date || '',
          liters: Number(r.Volume) || 0,
          kg: Number(r.Mass) || 0,
          density: Number(r.Density) || 0,
          tza: r.TZA || '',
          controlNum: r.Control_Number || '',
          operator: r.Name || '',
        };
      });

    } else {
      // ======================================================================
      // ДЛЯ НЕДЕЛИ, МЕСЯЦА И КОРОТКИХ ДИАПАЗОНОВ: посуточная группировка
      // ======================================================================
      const dayMap: Record<string, {
        date: string;
        shortDate: string;
        timestamp: number;
        liters: number;
        kg: number;
        count: number;
      }> = {};

      filtered.forEach((r: any) => {
        const ts = r.Timestamp || parseRuDate(r.Date);
        const dateStr = r.Date ? r.Date.split(' ')[0] : new Date(ts).toLocaleDateString('ru-RU');
        const shortDate = dateStr.substring(0, 5); // ДД.ММ

        if (!dayMap[dateStr]) {
          dayMap[dateStr] = {
            date: dateStr,
            shortDate,
            timestamp: ts,
            liters: 0,
            kg: 0,
            count: 0,
          };
        }
        dayMap[dateStr].liters += Number(r.Volume) || 0;
        dayMap[dateStr].kg += Number(r.Mass) || 0;
        dayMap[dateStr].count += 1;
      });

      chartData = Object.values(dayMap)
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((item) => ({
          name: item.shortDate,
          date: item.date,
          fullDate: item.date,
          liters: item.liters,
          kg: item.kg,
          count: item.count,
          density: item.liters > 0 ? Number((item.kg / item.liters).toFixed(4)) : 0,
        }));
    }

    return {
      filteredRecords: filtered,
      chartData,
      totalLiters,
      totalKg,
      operationsCount,
      avgDensity,
      dateRangeText,
      periodTitle,
      showAxisTicks,
      axisCaption,
    };
  }, [allRecords, period, appliedCustomRange]);

  // Скриншот страницы
  const handleDownloadScreenshot = async () => {
    if (!containerRef.current || isExporting) return;
    setIsExporting(true);
    try {
      const dataUrl = await domToPng(containerRef.current, {
        scale: 2,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#090d16' : '#f8fafc',
      });
      const link = document.createElement('a');
      link.download = `Динамика_выдачи_в_ВС_${period}_${new Date().toLocaleDateString('ru-RU')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Ошибка сохранения снимка:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 py-8 px-3 sm:px-6 font-sans transition-colors duration-200">
      <div ref={containerRef} className="w-full max-w-5xl mx-auto space-y-8 pb-16">
        
        {/* Верхняя навигационная панель */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-xl transition-all font-medium text-sm shadow-sm active:scale-95"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>На главную</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Динамика выдачи в ВС
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <Plane className="w-3 h-3" />
                  Авиатопливо
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Аналитика объемов и массы заправленного топлива по данным журнала операций
              </p>
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={fetchData}
              disabled={loading}
              title="Обновить данные"
              className="flex items-center gap-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 p-2.5 sm:px-3.5 sm:py-2.5 rounded-xl transition-all text-xs font-medium shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
              <span className="hidden sm:inline">Обновить</span>
            </button>

            <button
              onClick={handleDownloadScreenshot}
              disabled={isExporting || loading}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl transition-all font-semibold text-xs sm:text-sm shadow-md active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Сохранение...' : 'Скриншот'}</span>
            </button>
          </div>
        </div>

        {/* Кнопки-фильтры периодов */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Быстрые периоды
            </div>
            {period === 'custom' && (
              <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full">
                Активен период из календаря
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-2.5">
            {PERIOD_CONFIG.map((p) => {
              const isActive = period === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setAppliedCustomRange(null);
                    setPeriod(p.id);
                  }}
                  className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-xl transition-all text-center select-none active:scale-95 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 border border-emerald-500 font-bold'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="text-sm font-bold tracking-tight">
                    {p.label}
                  </span>
                  <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>
                    {p.sublabel}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="activeFilterIndicator"
                      className="absolute -bottom-1 w-6 h-1 bg-white dark:bg-emerald-300 rounded-full"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* ======================================================================== */}
          {/* НАШ МОЩНЫЙ И КРАСИВЫЙ КАЛЕНДАРЬ ДЛЯ ВЫБОРА ПРОИЗВОЛЬНОГО ПЕРИОДА */}
          {/* ======================================================================== */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-700 shadow-sm transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-all text-left shadow-sm active:scale-95 flex-1 ${
                  period === 'custom'
                    ? 'bg-emerald-600 text-white shadow-emerald-600/20'
                    : 'bg-slate-100 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className={`p-2 rounded-lg ${period === 'custom' ? 'bg-emerald-500/80 text-white' : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm'}`}>
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sm sm:text-base leading-snug">
                    {period === 'custom' && appliedCustomRange
                      ? `Период: ${format(appliedCustomRange.from, 'dd.MM.yyyy')} — ${format(appliedCustomRange.to, 'dd.MM.yyyy')}`
                      : 'Выбрать произвольный период в календаре'}
                  </span>
                  <span className={`text-xs ${period === 'custom' ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isCalendarOpen ? 'Нажмите, чтобы свернуть календарь' : 'Укажите дату начала и окончания в календаре'}
                  </span>
                </div>
                <ChevronDown className={`w-5 h-5 ml-auto shrink-0 transition-transform duration-200 ${isCalendarOpen ? 'rotate-180' : ''}`} />
              </button>

              {period === 'custom' && (
                <button
                  onClick={handleResetCustomRange}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 font-medium px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors self-end sm:self-auto border border-transparent hover:border-rose-200"
                >
                  <X className="w-4 h-4" />
                  <span>Сбросить выбор</span>
                </button>
              )}
            </div>

            {/* Раскрывающаяся панель календаря */}
            {isCalendarOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-4 pt-5 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center"
              >
                <div className="text-center mb-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Нажмите на дату начала, затем на дату окончания периода:
                  </p>
                </div>

                {/* DayPicker календарь */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner flex justify-center w-full max-w-sm">
                  <DayPicker
                    mode="range"
                    selected={calendarRange}
                    onSelect={setCalendarRange}
                    locale={ru}
                    modifiersClassNames={{
                      selected: 'bg-emerald-600 text-white font-bold',
                      range_start: 'bg-emerald-600 text-white rounded-l-full font-bold',
                      range_end: 'bg-emerald-600 text-white rounded-r-full font-bold',
                      range_middle: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200',
                      today: 'font-extrabold text-emerald-600 dark:text-emerald-400'
                    }}
                    className="font-sans text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Информационная плашка выбранного диапазона и кнопка ОК */}
                <div className="w-full max-w-sm mt-4 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs text-slate-600 dark:text-slate-300 text-center sm:text-left">
                    {calendarRange?.from ? (
                      <div>
                        <span className="text-slate-400">Период: </span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {format(calendarRange.from, 'dd.MM.yyyy')}
                        </span>
                        {' — '}
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {calendarRange.to ? format(calendarRange.to, 'dd.MM.yyyy') : format(calendarRange.from, 'dd.MM.yyyy')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Выберите даты в календаре</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleApplyCalendarRange}
                      disabled={!calendarRange?.from}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-95 disabled:cursor-not-allowed text-xs sm:text-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>ОК</span>
                    </button>
                    <button
                      onClick={() => setIsCalendarOpen(false)}
                      className="px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Закрыть
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Индикатор загрузки */}
        {loading && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Загрузка журнала выдачи топлива в ВС...
            </p>
          </div>
        )}

        {/* Сообщение об ошибке */}
        {error && !loading && (
          <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-5 flex items-start gap-3 text-rose-800 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <h4 className="font-semibold text-sm">Не удалось загрузить данные</h4>
              <p className="text-xs mt-1 text-rose-700 dark:text-rose-400">{error}</p>
              <button
                onClick={fetchData}
                className="mt-3 text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium px-3 py-1.5 rounded-lg transition-colors"
              >
                Повторить попытку
              </button>
            </div>
          </div>
        )}

        {/* Основной блок графиков и пояснений */}
        {!loading && !error && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${period}-${appliedCustomRange ? appliedCustomRange.from.getTime() : ''}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="space-y-8"
            >
              {/* Предупреждение, если за период нет данных */}
              {processedData.chartData.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-10 text-center border border-dashed border-slate-300 dark:border-slate-700 shadow-sm">
                  <Info className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    За выбранный период операций не найдено
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    В диапазоне {processedData.dateRangeText} выдача авиатоплива в воздушные суда не фиксировалась. Выберите другой период для анализа.
                  </p>
                </div>
              ) : (
                <>
                  {/* ======================================================================== */}
                  {/* ГРАФИК 1: ВЫДАЧА В ЛИТРАХ */}
                  {/* ======================================================================== */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-md transition-all">
                    {/* Заголовок графика 1 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400">
                          <Droplet className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            Выдача топлива в ВС (литры)
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {period === 'yesterday' 
                              ? 'Объем каждой заправки ВС по времени суток' 
                              : period === 'three_months' || period === 'six_months' || period === 'year'
                              ? 'Суммарный помесячный объем выданного топлива'
                              : 'Суммарный суточный объем выданного топлива'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex sm:flex-col items-baseline sm:items-end justify-between gap-1">
                        <span className="text-xs text-slate-400 font-medium">Суммарно:</span>
                        <span className="text-lg sm:text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                          {formatNumber(processedData.totalLiters)} л
                        </span>
                      </div>
                    </div>

                    {/* Поле самого графика 1 */}
                    <div className="h-72 sm:h-84 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={processedData.chartData}
                          margin={{ top: 15, right: 15, left: 0, bottom: 20 }}
                        >
                          <defs>
                            <linearGradient id="vsLitersGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#475569"
                            opacity={0.15}
                          />
                          <XAxis
                            dataKey="name"
                            axisLine={{ stroke: '#64748b', strokeWidth: 1, opacity: 0.3 }}
                            tickLine={processedData.showAxisTicks}
                            tick={processedData.showAxisTicks ? { fill: '#64748b', fontSize: 12, fontWeight: 500 } : false}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            dx={-5}
                            tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                            width={45}
                          />
                          <Tooltip content={<CustomLitersTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="liters"
                            name="Выдано литров"
                            stroke="#10b981"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#vsLitersGradient)"
                            isAnimationActive={true}
                            animationDuration={1300}
                            animationEasing="ease-out"
                            dot={{
                              r: period === 'three_months' || period === 'six_months' ? 6 : 4,
                              fill: '#10b981',
                              stroke: '#ffffff',
                              strokeWidth: 2,
                            }}
                            activeDot={{
                              r: 8,
                              fill: '#059669',
                              stroke: '#ffffff',
                              strokeWidth: 3,
                            }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Поясняющая надпись шкалы / название периода */}
                    <div className="text-center mt-1">
                      <span className="inline-block text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/60 py-1.5 px-4 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-sm">
                        {processedData.axisCaption}
                      </span>
                    </div>
                  </div>

                  {/* ======================================================================== */}
                  {/* ПОЯСНИТЕЛЬНЫЙ ФРЕЙМ ПОД ГРАФИКОМ 1 (ЛИТРЫ) */}
                  {/* ======================================================================== */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-md">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Сводка показателей по объему (литры)
                      </h3>
                    </div>

                    {/* 4 карточки-показателя */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      {/* Карточка 1: Период */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Период</div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                            {processedData.dateRangeText}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {processedData.periodTitle}
                          </div>
                        </div>
                      </div>

                      {/* Карточка 2: Кол-во операций */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                          <Plane className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Операций в ВС</div>
                          <div className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5 font-mono">
                            {processedData.operationsCount}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            заправок ВС за период
                          </div>
                        </div>
                      </div>

                      {/* Карточка 3: Выдано топлива в литрах */}
                      <div className="bg-emerald-50/70 dark:bg-emerald-950/20 rounded-xl p-3.5 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-emerald-500 text-white shrink-0 shadow-sm shadow-emerald-500/30">
                          <Droplet className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-emerald-800 dark:text-emerald-300 font-medium">Выдано топлива (л)</div>
                          <div className="text-base sm:text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                            {formatNumber(processedData.totalLiters)} л
                          </div>
                          <div className="text-[11px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
                            суммарный объем
                          </div>
                        </div>
                      </div>

                      {/* Карточка 4: Средняя плотность */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                          <Gauge className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Средняя плотность</div>
                          <div className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
                            {processedData.avgDensity}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            г/см³ (средневзвешенная)
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Поясняющий связный текст простым языком */}
                    <div className="mt-4 p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/50 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2.5">
                      <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        За выбранный период <span className="font-semibold text-slate-900 dark:text-white">({processedData.periodTitle}: {processedData.dateRangeText})</span> всеми операциями «Выдача в ВС» успешно заправлено <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatNumber(processedData.totalLiters)} литров</span> авиакеросина. Всего выполнено <span className="font-semibold text-slate-900 dark:text-white">{processedData.operationsCount} операций заправки</span> ВС со средней физической плотностью партий топлива <span className="font-semibold font-mono text-slate-900 dark:text-white">{processedData.avgDensity} г/см³</span>.
                      </div>
                    </div>
                  </div>

                  {/* ======================================================================== */}
                  {/* ГРАФИК 2: ВЫДАЧА В КИЛОГРАММАХ */}
                  {/* ======================================================================== */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-md transition-all">
                    {/* Заголовок графика 2 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400">
                          <Scale className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            Выдача топлива в ВС (килограммы)
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {period === 'yesterday' 
                              ? 'Фактическая масса каждой заправки ВС по времени суток' 
                              : period === 'three_months' || period === 'six_months' || period === 'year'
                              ? 'Суммарная помесячная масса выданного топлива'
                              : 'Суммарная суточная масса выданного топлива'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex sm:flex-col items-baseline sm:items-end justify-between gap-1">
                        <span className="text-xs text-slate-400 font-medium">Суммарно:</span>
                        <span className="text-lg sm:text-xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
                          {formatNumber(processedData.totalKg)} кг
                        </span>
                      </div>
                    </div>

                    {/* Поле самого графика 2 */}
                    <div className="h-72 sm:h-84 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={processedData.chartData}
                          margin={{ top: 15, right: 15, left: 0, bottom: 20 }}
                        >
                          <defs>
                            <linearGradient id="vsKgGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.45} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#475569"
                            opacity={0.15}
                          />
                          <XAxis
                            dataKey="name"
                            axisLine={{ stroke: '#64748b', strokeWidth: 1, opacity: 0.3 }}
                            tickLine={processedData.showAxisTicks}
                            tick={processedData.showAxisTicks ? { fill: '#64748b', fontSize: 12, fontWeight: 500 } : false}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#64748b', fontSize: 11 }}
                            dx={-5}
                            tickFormatter={(val) => `${Math.round(val / 1000)}k`}
                            width={45}
                          />
                          <Tooltip content={<CustomKgTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="kg"
                            name="Выдано килограмм"
                            stroke="#6366f1"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#vsKgGradient)"
                            isAnimationActive={true}
                            animationDuration={1400}
                            animationEasing="ease-out"
                            dot={{
                              r: period === 'three_months' || period === 'six_months' ? 6 : 4,
                              fill: '#6366f1',
                              stroke: '#ffffff',
                              strokeWidth: 2,
                            }}
                            activeDot={{
                              r: 8,
                              fill: '#4f46e5',
                              stroke: '#ffffff',
                              strokeWidth: 3,
                            }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Поясняющая надпись шкалы / название периода */}
                    <div className="text-center mt-1">
                      <span className="inline-block text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/60 py-1.5 px-4 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-sm">
                        {processedData.axisCaption}
                      </span>
                    </div>
                  </div>

                  {/* ======================================================================== */}
                  {/* ПОЯСНИТЕЛЬНЫЙ ФРЕЙМ ПОД ГРАФИКОМ 2 (КИЛОГРАММЫ) */}
                  {/* ======================================================================== */}
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-700 shadow-md">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                      <span className="flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Сводка показателей по массе (килограммы)
                      </h3>
                    </div>

                    {/* 4 карточки-показателя */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                      {/* Карточка 1: Период */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Период</div>
                          <div className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                            {processedData.dateRangeText}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {processedData.periodTitle}
                          </div>
                        </div>
                      </div>

                      {/* Карточка 2: Кол-во операций */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                          <Plane className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Операций в ВС</div>
                          <div className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mt-0.5 font-mono">
                            {processedData.operationsCount}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            заправок ВС за период
                          </div>
                        </div>
                      </div>

                      {/* Карточка 3: Выдано топлива в килограммах */}
                      <div className="bg-indigo-50/70 dark:bg-indigo-950/20 rounded-xl p-3.5 border border-indigo-200 dark:border-indigo-800/60 flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-indigo-500 text-white shrink-0 shadow-sm shadow-indigo-500/30">
                          <Scale className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-indigo-800 dark:text-indigo-300 font-medium">Выдано топлива (кг)</div>
                          <div className="text-base sm:text-lg font-extrabold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                            {formatNumber(processedData.totalKg)} кг
                          </div>
                          <div className="text-[11px] text-indigo-700/70 dark:text-indigo-400/70 mt-0.5">
                            суммарная масса
                          </div>
                        </div>
                      </div>

                      {/* Карточка 4: Средняя плотность */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/80 flex items-start gap-3">
                        <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                          <Gauge className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Средняя плотность</div>
                          <div className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 font-mono mt-0.5">
                            {processedData.avgDensity}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            г/см³ (средневзвешенная)
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Поясняющий связный текст простым языком */}
                    <div className="mt-4 p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/50 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed flex items-start gap-2.5">
                      <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                      <div>
                        За выбранный период <span className="font-semibold text-slate-900 dark:text-white">({processedData.periodTitle}: {processedData.dateRangeText})</span> суммарная масса выданного авиационного топлива составила <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{formatNumber(processedData.totalKg)} кг</span>. Физическая плотность выданного керосина составила <span className="font-semibold font-mono text-slate-900 dark:text-white">{processedData.avgDensity} г/см³</span> по <span className="font-semibold text-slate-900 dark:text-white">{processedData.operationsCount} выполненным заправкам</span> ВС.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
