import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Calendar as CalendarIcon, Search, Filter, Pencil, AlertTriangle, Check, X, RefreshCw, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { ru } from 'date-fns/locale';
import { useToast } from '../context/ToastContext';
import { getVolumeFromCalibration } from '../utils/calibrationHelper';

interface AdminCorrectionProps {
  onBack: () => void;
}

const titleMap: Record<string, string> = {
  reception: 'Прием топлива',
  reception_auto: 'Прием из АЦ',
  dispense_tza: 'Выдача в ТЗА',
  dispense_vs: 'Выдача в ВС',
  measurement: 'Замер резервуара',
  train: 'Замер цистерны',
  in_warehouse: 'Внутрискладская перекачка',
};

const filterCategories = [
  { id: 'all', label: 'Все' },
  { id: 'reception', label: 'Прием', types: ['reception', 'reception_auto'] },
  { id: 'dispense', label: 'Выдача', types: ['dispense_tza', 'dispense_vs'] },
  { id: 'measurement', label: 'Замеры', types: ['measurement', 'train'] },
  { id: 'transfer', label: 'Перекачка', types: ['in_warehouse'] },
];

const getBadgeStyle = (type: string) => {
  switch (type) {
    case 'reception':
    case 'reception_auto':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    case 'dispense_tza':
    case 'dispense_vs':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
    case 'measurement':
    case 'train':
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800';
    case 'in_warehouse':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
};

export default function AdminCorrection({ onBack }: AdminCorrectionProps) {
  const { showToast } = useToast();

  // Navigation steps: 'calendar' | 'operations'
  const [currentStep, setCurrentStep] = useState<'calendar' | 'operations'>('calendar');

  // Calendar State
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);

  // Operations State
  const [operations, setOperations] = useState<any[]>([]);
  const [loadingOps, setLoadingOps] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  // Edit Modal State
  const [selectedOp, setSelectedOp] = useState<any | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [tanks, setTanks] = useState<any[]>([]);
  const [tzas, setTzas] = useState<any[]>([]);

  // Confirmation Dialog State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Загружаем резервуары и ТЗА для градуировки и списков
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [tRes, tzaRes] = await Promise.all([
          fetch('/api/tanks'),
          fetch('/api/tza')
        ]);
        if (tRes.ok) {
          const tData = await tRes.json();
          setTanks(tData.map((t: any) => ({ ...t, Calibration: JSON.parse(t.Calibration || '[]') })));
        }
        if (tzaRes.ok) {
          const tzaData = await tzaRes.json();
          setTzas(tzaData);
        }
      } catch (e) {
        console.error('Error fetching metadata in AdminCorrection:', e);
      }
    };
    fetchMeta();
  }, []);

  const formatDateToStr = (d: Date) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Выгрузка операций за выбранные даты
  const handleFetchOperations = async () => {
    if (!selectedDates || selectedDates.length === 0) {
      showToast('Пожалуйста, выберите хотя бы одну дату в календаре', 'error');
      return;
    }

    setLoadingOps(true);
    try {
      const datesParam = selectedDates.map(formatDateToStr).join(',');
      const res = await fetch(`/api/operations/by-dates?dates=${encodeURIComponent(datesParam)}`);
      if (res.ok) {
        const data = await res.json();
        setOperations(Array.isArray(data) ? data : []);
        setCurrentStep('operations');
      } else {
        showToast('Ошибка при выгрузке операций', 'error');
      }
    } catch (e) {
      console.error('Fetch operations error:', e);
      showToast('Ошибка подключения к серверу', 'error');
    } finally {
      setLoadingOps(false);
    }
  };

  const [selectedShift, setSelectedShift] = useState<string>('all');
  const [selectedOperator, setSelectedOperator] = useState<string>('all');

  // Уникальные смены и операторы для фильтров
  const uniqueShifts = useMemo(() => {
    const shifts = Array.from(new Set(operations.map(op => op.Workday_ID).filter(Boolean)));
    return shifts.sort((a, b) => Number(b) - Number(a));
  }, [operations]);

  const uniqueOperators = useMemo(() => {
    const ops = Array.from(new Set(operations.map(op => op.Name).filter(Boolean)));
    return ops.sort((a, b) => String(a).localeCompare(String(b)));
  }, [operations]);

  // Фильтрация операций
  const filteredOperations = useMemo(() => {
    return operations.filter(op => {
      // Фильтр по смене
      if (selectedShift !== 'all' && String(op.Workday_ID) !== String(selectedShift)) {
        return false;
      }
      // Фильтр по оператору
      if (selectedOperator !== 'all' && op.Name !== selectedOperator) {
        return false;
      }
      // Категория
      if (selectedFilter !== 'all') {
        const cat = filterCategories.find(c => c.id === selectedFilter);
        if (cat && !cat.types.includes(op.operationType)) return false;
      }
      // Текстовый поиск
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (op.Name || '').toLowerCase();
        const tank = (op.Tank_Name || op.From_Tank || op.To_Tank || '').toLowerCase();
        const tza = (op.TZA || '').toLowerCase();
        const gos = (op.Gos_Number || '').toLowerCase();
        const wagon = (op.Number || '').toLowerCase();
        const date = (op.Date || '').toLowerCase();
        const opTitle = (titleMap[op.operationType] || '').toLowerCase();

        return (
          name.includes(q) ||
          tank.includes(q) ||
          tza.includes(q) ||
          gos.includes(q) ||
          wagon.includes(q) ||
          date.includes(q) ||
          opTitle.includes(q)
        );
      }
      return true;
    });
  }, [operations, selectedShift, selectedOperator, selectedFilter, searchQuery]);

  // Клик по операции для открытия окна редактирования
  const handleOpenEdit = (op: any) => {
    setSelectedOp(op);
    setFormData({ ...op });
  };

  const handleFieldChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  // Реактивный расчет объема и массы для открытой формы
  const liveCalculation = useMemo(() => {
    if (!selectedOp) return { volume: 0, mass: 0, avgLevel: 0 };
    const parseF = (v: any) => parseFloat(String(v || '').replace(',', '.')) || 0;
    const type = selectedOp.operationType;

    let volume = parseF(selectedOp.Volume);
    let mass = parseF(selectedOp.Mass);
    let avgLevel = parseF(selectedOp.Average_Level);
    const density = parseF(formData.Density);

    if (['reception', 'reception_auto', 'dispense_tza', 'in_warehouse'].includes(type)) {
      const before = parseF(formData.Counter_Before);
      const after = parseF(formData.Counter_After);
      if (after >= before) {
        volume = parseFloat((after - before).toFixed(2));
        mass = parseFloat((volume * density).toFixed(2));
      }
    } else if (type === 'dispense_vs') {
      volume = parseF(formData.Volume);
      mass = Math.round(volume * density);
    } else if (['measurement', 'train'].includes(type)) {
      const l1 = parseInt(formData.Level_1) || 0;
      const l2 = parseInt(formData.Level_2) || 0;
      const l3 = parseInt(formData.Level_3) || 0;
      avgLevel = Math.round((l1 + l2 + l3) / 3);

      const targetTank = tanks.find(t => t.Name === (type === 'train' ? formData.Type : formData.Tank_Name));
      if (targetTank && targetTank.Calibration) {
        const cat = type === 'train' ? 'train' : 'tank';
        const calcVol = getVolumeFromCalibration(targetTank.Calibration, avgLevel, cat);
        volume = parseFloat(calcVol.toFixed(2));
      }
      mass = parseFloat((volume * density).toFixed(2));
    }

    return { volume, mass, avgLevel };
  }, [selectedOp, formData, tanks]);

  // Нажатие на "Записать"
  const handleInitiateSave = () => {
    if (!selectedOp) return;
    const parseF = (v: any) => parseFloat(String(v || '').replace(',', '.')) || 0;

    // Валидации
    if (['reception', 'reception_auto', 'dispense_tza', 'in_warehouse'].includes(selectedOp.operationType)) {
      const before = parseF(formData.Counter_Before);
      const after = parseF(formData.Counter_After);
      if (after < before) {
        showToast('Показания счетчика ПОСЛЕ не могут быть меньше ДО', 'error');
        return;
      }
    }

    const dens = parseF(formData.Density);
    if (formData.Density !== undefined && (isNaN(dens) || dens <= 0)) {
      showToast('Укажите корректную плотность', 'error');
      return;
    }

    // Собираем измененные поля
    const diffs: { label: string; oldVal: string; newVal: string }[] = [];
    const fieldsToCheck: Record<string, string> = {
      Counter_Before: 'Счетчик ДО',
      Counter_After: 'Счетчик ПОСЛЕ',
      Density: 'Плотность (г/см³)',
      Volume: 'Объем (л)',
      Level_1: 'Замер 1 (мм)',
      Level_2: 'Замер 2 (мм)',
      Level_3: 'Замер 3 (мм)',
      Temperature: 'Температура (°C)',
      Tank_Name: 'Резервуар',
      TZA: 'ТЗА',
      Gos_Number: 'Гос. номер АЦ',
      Number: 'Номер вагона',
      Control_Number: 'Контрольный талон',
      From_Tank: 'Резервуар ИЗ',
      To_Tank: 'Резервуар В'
    };

    // Проверяем изменение входных полей
    for (const [key, label] of Object.entries(fieldsToCheck)) {
      if (formData[key] !== undefined && String(formData[key]) !== String(selectedOp[key] ?? '')) {
        diffs.push({
          label,
          oldVal: String(selectedOp[key] ?? '—'),
          newVal: String(formData[key])
        });
      }
    }

    // Проверяем изменение выходных расчетных полей (Volume, Mass, Average_Level)
    if (liveCalculation.volume !== selectedOp.Volume) {
      diffs.push({
        label: 'Расчетный объем (л)',
        oldVal: `${Math.round(selectedOp.Volume || 0)} л`,
        newVal: `${Math.round(liveCalculation.volume)} л`
      });
    }
    if (liveCalculation.mass !== selectedOp.Mass) {
      diffs.push({
        label: 'Расчетная масса (кг)',
        oldVal: `${Math.round(selectedOp.Mass || 0)} кг`,
        newVal: `${Math.round(liveCalculation.mass)} кг`
      });
    }

    if (diffs.length === 0) {
      showToast('Никакие параметры не были изменены', 'info');
      return;
    }

    // Готовим payload для сохранения
    const payloadData: any = { ...formData };
    payloadData.Volume = liveCalculation.volume;
    payloadData.Mass = liveCalculation.mass;
    if (liveCalculation.avgLevel > 0) {
      payloadData.Average_Level = liveCalculation.avgLevel;
    }
    if (payloadData.Density !== undefined) {
      payloadData.Density = dens;
    }

    setPendingChanges({
      diffs,
      payloadData,
      operationType: selectedOp.operationType,
      id: selectedOp.id
    });
    setShowConfirmModal(true);
  };

  // Подтверждение сохранения ("ДА")
  const handleConfirmSave = async () => {
    if (!pendingChanges || isSaving) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/operations/edit-last', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationType: pendingChanges.operationType,
          id: pendingChanges.id,
          data: pendingChanges.payloadData,
          action: 'edit',
          isAdmin: true
        })
      });

      if (res.ok) {
        showToast('Операция успешно изменена и пересчитана!', 'success');
        setShowConfirmModal(false);
        setSelectedOp(null);
        setPendingChanges(null);

        // Обновляем список операций в фоне
        const datesParam = selectedDates.map(formatDateToStr).join(',');
        const refreshRes = await fetch(`/api/operations/by-dates?dates=${encodeURIComponent(datesParam)}`);
        if (refreshRes.ok) {
          const freshData = await refreshRes.json();
          setOperations(Array.isArray(freshData) ? freshData : []);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Ошибка при сохранении операции', 'error');
      }
    } catch (e) {
      console.error('Save error:', e);
      showToast('Ошибка соединения с сервером', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center pt-8 pb-20 px-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-2xl flex flex-col items-center">

        {/* ===================== ШАГ 1: ВЫБОР ДАТ (КАЛЕНДАРЬ) ===================== */}
        {currentStep === 'calendar' && (
          <div className="w-full flex flex-col items-center">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 mb-1">
                Корректировка операций
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Выберите одну или несколько дат для выгрузки операций
              </p>
            </div>

            {/* Блок календаря */}
            <div className="w-full max-w-md bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-md border border-slate-200 dark:border-slate-700 mb-6 flex flex-col items-center">
              <DayPicker
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates((dates as Date[]) || [])}
                locale={ru}
                modifiersClassNames={{
                  selected: 'bg-indigo-600 text-white rounded-full font-bold',
                  today: 'font-bold text-indigo-600 dark:text-indigo-400'
                }}
                className="font-sans dark:text-slate-200"
              />

              {selectedDates.length > 0 && (
                <div className="w-full pt-4 mt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Выбрано дат: <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedDates.length}</span>
                  </div>
                  <button
                    onClick={() => setSelectedDates([])}
                    className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    Сбросить выбор
                  </button>
                </div>
              )}
            </div>

            {/* Кнопки действий */}
            <div className="w-full max-w-md flex flex-col gap-3">
              <button
                onClick={handleFetchOperations}
                disabled={loadingOps || selectedDates.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-lg font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2"
              >
                {loadingOps ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Выгрузка данных...</span>
                  </>
                ) : (
                  <>
                    <CalendarIcon className="w-5 h-5" />
                    <span>Выгрузить операции</span>
                  </>
                )}
              </button>

              <button
                onClick={onBack}
                className="w-full py-4 mt-4 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium rounded-2xl transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Назад в Панель администратора</span>
              </button>
            </div>
          </div>
        )}

        {/* ===================== ШАГ 2: СПИСОК ОПЕРАЦИЙ ===================== */}
        {currentStep === 'operations' && (
          <div className="w-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                  Операции за выбранные даты
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {selectedDates.map(formatDateToStr).join(', ')} • Всего операций: <span className="font-bold text-slate-700 dark:text-slate-200">{filteredOperations.length}</span>
                </p>
              </div>

              <button
                onClick={() => setCurrentStep('calendar')}
                className="p-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">К выбору дат</span>
              </button>
            </div>

            {/* Поиск и Фильтры */}
            <div className="space-y-3 mb-6">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Поиск по сотруднику, резервуару, ТЗА, номеру..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 text-sm transition-all"
                />
              </div>

              {/* Селекторы Смены и Оператора */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <select
                    value={selectedShift}
                    onChange={(e) => setSelectedShift(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">Все смены</option>
                    {uniqueShifts.map(s => (
                      <option key={s} value={s}>Смена №{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={selectedOperator}
                    onChange={(e) => setSelectedOperator(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                  >
                    <option value="all">Все сотрудники</option>
                    {uniqueOperators.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Быстрые фильтры по типу операции */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {filterCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedFilter(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedFilter === cat.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Список карточек */}
            {filteredOperations.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                  Операции не найдены
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOperations.map(op => {
                  const title = titleMap[op.operationType] || 'Операция';
                  const badgeClass = getBadgeStyle(op.operationType);
                  const vol = Math.round(op.Volume || 0);
                  const mass = Math.round(op.Mass || 0);

                  return (
                    <div
                      key={`${op.operationType}-${op.id}`}
                      onClick={() => handleOpenEdit(op)}
                      className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]"
                    >
                      {/* Верхняя строка карточки */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${badgeClass}`}>
                          {title}
                        </span>
                        <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                          {op.Date || '—'}
                        </span>
                      </div>

                      {/* Исполнитель и Смена */}
                      <div className="flex items-center justify-between text-sm mb-3">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          👤 {op.Name || 'Неизвестно'}
                        </div>
                        {op.Workday_ID && (
                          <div className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            Смена №{op.Workday_ID}
                          </div>
                        )}
                      </div>

                      {/* Ключевые параметры операции */}
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300">
                          {op.Tank_Name && <span>Резервуар: <b className="text-slate-900 dark:text-white">{op.Tank_Name}</b></span>}
                          {op.From_Tank && <span>Из: <b className="text-slate-900 dark:text-white">{op.From_Tank}</b></span>}
                          {op.To_Tank && <span>В: <b className="text-slate-900 dark:text-white">{op.To_Tank}</b></span>}
                          {op.TZA && <span>ТЗА: <b className="text-slate-900 dark:text-white">{op.TZA}</b></span>}
                          {op.Gos_Number && <span>АЦ: <b className="text-slate-900 dark:text-white">{op.Gos_Number}</b></span>}
                          {op.Number && <span>Вагон: <b className="text-slate-900 dark:text-white">{op.Number}</b></span>}
                          {op.Density !== undefined && op.Density !== null && (
                            <span>Плотность: <b className="text-slate-900 dark:text-white">{op.Density}</b></span>
                          )}
                          {op.Average_Level !== undefined && op.Average_Level !== null && (
                            <span>Уровень: <b className="text-slate-900 dark:text-white">{op.Average_Level} мм</b></span>
                          )}
                        </div>

                        {/* Результаты (Объем и Масса) */}
                        <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-300">
                          <div>
                            Объем: <span className="font-bold text-slate-900 dark:text-white font-mono">{vol.toLocaleString('ru-RU')} л</span>
                            {mass > 0 && (
                              <span className="ml-3">
                                Масса: <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{mass.toLocaleString('ru-RU')} кг</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                            <span>Изменить</span>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ===================== МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ ===================== */}
      {selectedOp && !showConfirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">

            {/* Шапка модалки */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${getBadgeStyle(selectedOp.operationType)}`}>
                  {titleMap[selectedOp.operationType] || 'Операция'}
                </span>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1">
                  Редактирование параметров
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedOp.Name} • {selectedOp.Date} (Смена №{selectedOp.Workday_ID || '—'})
                </p>
              </div>

              <button
                onClick={() => setSelectedOp(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Тело формы редактирования */}
            <div className="p-6 space-y-4 max-h-[65vh] overflow-y-auto">

              {/* Счетчики ДО и ПОСЛЕ (для приема, АЦ, ТЗА, перекачки) */}
              {['reception', 'reception_auto', 'dispense_tza', 'in_warehouse'].includes(selectedOp.operationType) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Счетчик ДО (л)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.Counter_Before ?? ''}
                      onChange={(e) => handleFieldChange('Counter_Before', e.target.value.replace(/[^0-9.,]/g, ''))}
                      className="w-full bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Счетчик ПОСЛЕ (л)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.Counter_After ?? ''}
                      onChange={(e) => handleFieldChange('Counter_After', e.target.value.replace(/[^0-9.,]/g, ''))}
                      className="w-full bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Плотность */}
              {selectedOp.operationType !== 'reception' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Плотность (г/см³)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.Density ?? ''}
                    onChange={(e) => handleFieldChange('Density', e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="w-full bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Выдача в ВС: Объем */}
              {selectedOp.operationType === 'dispense_vs' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Количество выданного топлива (л)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={formData.Volume ?? ''}
                    onChange={(e) => handleFieldChange('Volume', e.target.value.replace(/[^0-9.,]/g, ''))}
                    className="w-full bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Замеры: Уровни 1, 2, 3 */}
              {['measurement', 'train'].includes(selectedOp.operationType) && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Замер 1 (мм)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.Level_1 ?? ''}
                        onChange={(e) => handleFieldChange('Level_1', e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl px-2.5 py-2 font-mono text-sm text-center text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Замер 2 (мм)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.Level_2 ?? ''}
                        onChange={(e) => handleFieldChange('Level_2', e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl px-2.5 py-2 font-mono text-sm text-center text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                        Замер 3 (мм)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.Level_3 ?? ''}
                        onChange={(e) => handleFieldChange('Level_3', e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl px-2.5 py-2 font-mono text-sm text-center text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      Температура (°C)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={formData.Temperature ?? ''}
                      onChange={(e) => handleFieldChange('Temperature', e.target.value.replace(/[^0-9.,-]/g, ''))}
                      className="w-full bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Дополнительные параметры (Резервуар, ТЗА, Гос.номер) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {formData.Tank_Name !== undefined && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Резервуар</label>
                    <input
                      type="text"
                      value={formData.Tank_Name ?? ''}
                      onChange={(e) => handleFieldChange('Tank_Name', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
                {formData.TZA !== undefined && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">ТЗА</label>
                    <input
                      type="text"
                      value={formData.TZA ?? ''}
                      onChange={(e) => handleFieldChange('TZA', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
                {formData.Gos_Number !== undefined && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Гос. номер АЦ</label>
                    <input
                      type="text"
                      value={formData.Gos_Number ?? ''}
                      onChange={(e) => handleFieldChange('Gos_Number', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
                {formData.Control_Number !== undefined && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Контрольный талон</label>
                    <input
                      type="text"
                      value={formData.Control_Number ?? ''}
                      onChange={(e) => handleFieldChange('Control_Number', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {/* Блок динамического пересчета (Live Preview) */}
              <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 mt-4">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 mb-2 flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Пересчет в реальном времени:</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Новый объем:</span>
                    <span className="text-base font-bold font-mono text-slate-900 dark:text-white">
                      {Math.round(liveCalculation.volume).toLocaleString('ru-RU')} л
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Новая масса:</span>
                    <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {liveCalculation.mass.toLocaleString('ru-RU')} кг
                    </span>
                  </div>
                </div>
                {liveCalculation.avgLevel > 0 && (
                  <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                    Средний уровень: <b>{liveCalculation.avgLevel} мм</b>
                  </div>
                )}
              </div>

            </div>

            {/* Футер кнопок модалки */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-3 bg-slate-50/30 dark:bg-slate-800/30">
              <button
                onClick={() => setSelectedOp(null)}
                className="px-5 py-2.5 rounded-xl font-medium text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleInitiateSave}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Записать</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ===================== МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ ===================== */}
      {showConfirmModal && pendingChanges && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl border border-amber-200 dark:border-amber-700/50 p-6 my-auto animate-in zoom-in-95 duration-200 text-center">

            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Подтверждение изменения
            </h3>

            <p className="text-sm text-slate-700 dark:text-slate-200 mb-4 leading-relaxed font-medium">
              Вы действительно хотите изменить операцию <b>«{titleMap[pendingChanges.operationType] || 'Операция'}»</b> за смену <b>№{selectedOp?.Workday_ID || '—'}</b> от <b>{selectedOp?.Date?.split(' ')[0] || selectedOp?.Date}</b>?
            </p>

            {/* Блоки БЫЛО / СТАЛО */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left mb-4">
              <div className="bg-rose-50/70 dark:bg-rose-950/30 p-3.5 rounded-2xl border border-rose-200 dark:border-rose-900/50">
                <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 mb-2 uppercase tracking-wide flex items-center gap-1">
                  <span>❌</span>
                  <span>БЫЛО:</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {pendingChanges.diffs.map((d: any, idx: number) => (
                    <div key={idx} className="text-slate-700 dark:text-slate-300">
                      <span className="text-slate-500 dark:text-slate-400">{d.label}:</span>{' '}
                      <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">{d.oldVal}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-emerald-50/70 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-900/50">
                <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wide flex items-center gap-1">
                  <span>✅</span>
                  <span>СТАЛО:</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {pendingChanges.diffs.map((d: any, idx: number) => (
                    <div key={idx} className="text-slate-700 dark:text-slate-300">
                      <span className="text-slate-500 dark:text-slate-400">{d.label}:</span>{' '}
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{d.newVal}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-6 italic">
              Операция будет сохранена в базе за дату проведения, а показатели смены №{selectedOp?.Workday_ID || '—'} будут автоматически пересчитаны.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={isSaving}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-colors"
              >
                НЕТ
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={isSaving}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Запись...</span>
                  </>
                ) : (
                  <span>ДА</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
