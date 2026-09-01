import React, { useState, useEffect, useRef } from 'react';
import { Copy, Share2, Download, ArrowLeft } from 'lucide-react';
import { domToBlob } from 'modern-screenshot';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { WorkdayRecord } from '../data/WORKDAY';
import { useToast } from '../context/ToastContext';
import { saveToQueue } from '../utils/offlineQueue';
import { normalizeDensity } from '../utils/densityHelper';
import { validateTankOperation, fetchParkStateMap, TankValidationResult } from '../utils/tankLimits';
import TankLimitErrorModal from './TankLimitErrorModal';

interface InWarehouseTransferProps {
  currentUser: { Name: string };
  currentWorkday: WorkdayRecord | null;
  onBack: () => void;
}

export default function InWarehouseTransfer({ currentUser, currentWorkday, onBack }: InWarehouseTransferProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [tanks, setTanks] = useState<any[]>([]);
  const [fromTank, setFromTank] = useState<string | null>(null);
  const [toTank, setToTank] = useState<string | null>(null);

  const [counterBefore, setCounterBefore] = useState('');
  const [counterAfter, setCounterAfter] = useState('');
  const [density, setDensity] = useState('');
  const [temperature, setTemperature] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState<TankValidationResult | null>(null);
  const [resultData, setResultData] = useState<any>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTanks = async () => {
      try {
        const res = await fetch('/api/tanks');
        if (res.ok) {
          const data = await res.json();
          const rgsTanks = data.filter((t: any) => 
            t.Status === 'active' && 
            t.Name.includes('РГС') && 
            !t.Name.includes('РК-1')
          );
          setTanks(rgsTanks);
          localStorage.setItem('cached_tanks', JSON.stringify(rgsTanks));
        }
      } catch (error) {
        console.error('Error fetching tanks:', error);
        const cached = localStorage.getItem('cached_tanks');
        if (cached) setTanks(JSON.parse(cached));
      }
    };
    fetchTanks();
  }, []);

  useEffect(() => {
    if (step === 3 && fromTank) {
      const fetchLatestMeasurement = async () => {
        try {
          const response = await fetch('/api/daily-measurements');
          if (response.ok) {
            const data = await response.json();
            const latest = data.find((r: any) => r.Tank_Name === fromTank);
            if (latest) {
              setDensity(latest.Density?.toString() || '');
              setTemperature(latest.Temperature?.toString() || '');
            }
          }
        } catch (error) {
          console.error("Error fetching latest measurement:", error);
        }
      };
      fetchLatestMeasurement();
    }
  }, [step, fromTank]);

  const handleSave = async () => {
    if (isSaving) return;

    if (!fromTank || !toTank || !counterBefore.trim() || !counterAfter.trim() || !density.trim() || !temperature.trim()) {
      showToast('Заполните все поля!', 'error');
      return;
    }

    const before = parseFloat(counterBefore.replace(',', '.'));
    const after = parseFloat(counterAfter.replace(',', '.'));
    const dens = normalizeDensity(density);
    const temp = parseFloat(temperature.replace(',', '.'));

    if (isNaN(before) || isNaN(after) || isNaN(dens) || isNaN(temp)) {
      showToast('Введите корректные числа!', 'error');
      return;
    }

    if (after < before) {
      showToast('Счетчик ПОСЛЕ не может быть меньше ДО!', 'error');
      return;
    }

    const volume = parseFloat((after - before).toFixed(2));

    setIsSaving(true);
    let payload: any = null;
    try {
      // Проверка лимитов для обоих резервуаров (исходный и целевой)
      const parkMap = await fetchParkStateMap();
      const fromCurVol = parkMap[fromTank!] ?? 0;
      const toCurVol = parkMap[toTank!] ?? 0;

      // 1. Проверка исходного резервуара на незабираемый остаток
      const fromValidation = validateTankOperation({
        tankName: fromTank!,
        currentVolume: fromCurVol,
        deltaVolume: -volume,
        operationTypeLabel: 'Перекачка (исходный резервуар)',
      });
      if (!fromValidation.isValid) {
        setValidationError(fromValidation);
        return;
      }

      // 2. Проверка целевого резервуара на переполнение
      const toValidation = validateTankOperation({
        tankName: toTank!,
        currentVolume: toCurVol,
        deltaVolume: volume,
        operationTypeLabel: 'Перекачка (целевой резервуар)',
      });
      if (!toValidation.isValid) {
        setValidationError(toValidation);
        return;
      }

      const mass = parseFloat((volume * dens).toFixed(2));
      const dateStr = new Date().toLocaleString('ru-RU', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
      }).replace(',', '');

      payload = {
        Workday_ID: currentWorkday?.id || null,
        Date: dateStr,
        Name: currentUser.Name,
        From_Tank: fromTank!,
        To_Tank: toTank!,
        Counter_Before: before,
        Counter_After: after,
        Density: dens,
        Temperature: temp,
        Volume: volume,
        Mass: mass
      };
      let savedSuccessfully = false;
      if (navigator.onLine) {
        const res = await fetch('/api/in-warehouse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          setResultData({ ...payload, id: data.id });
          setStep(4);
          savedSuccessfully = true;
        } else {
          showToast('Ошибка при сохранении на сервере.', 'error');
        }
      }

      if (!savedSuccessfully && !navigator.onLine) {
        await saveToQueue('/api/in-warehouse', payload);
        setResultData({ ...payload, id: Date.now() });
        setStep(4);
        showToast('Сохранено локально (офлайн)', 'warning');
      }
    } catch (error) {
      console.error("Save error:", error);
      await saveToQueue('/api/in-warehouse', payload);
      setResultData({ ...payload, id: Date.now() });
      setStep(4);
      showToast('Сбой сети. Сохранено локально (офлайн)', 'warning');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!resultData) return;
    const text = `Внутрискладская перекачка\n` +
      `Дата: ${resultData.Date}\n` +
      `Сотрудник: ${resultData.Name}\n` +
      `Из: ${resultData.From_Tank}\n` +
      `В: ${resultData.To_Tank}\n` +
      `Плотность: ${resultData.Density}\n` +
      `Температура: ${resultData.Temperature}\n` +
      `Объем: ${resultData.Volume} л\n` +
      `Масса: ${resultData.Mass} кг`;
    
    try {
      await navigator.clipboard.writeText(text);
      showToast('Данные скопированы!', 'success');
    } catch (err) {
      showToast('Ошибка копирования', 'error');
    }
  };

  const handleShare = async () => {
    if (!receiptRef.current) return;
    try {
      const blob = await domToBlob(receiptRef.current, {
        scale: 2,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff'
      });
      if (blob && navigator.share) {
        const file = new File([blob], `Transfer_${resultData.id}.png`, { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: 'Внутрискладская перекачка',
        });
      } else if (blob) {
        saveAs(blob, `Transfer_${resultData.id}.png`);
        showToast('Скриншот скачан', 'success');
      }
    } catch (err) {
      console.error('Share error:', err);
      showToast('Ошибка создания скриншота', 'error');
    }
  };

  const handleDownloadExcel = async () => {
    if (!resultData) return;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Перекачка');

    worksheet.columns = [
      { header: 'Параметр', key: 'param', width: 25 },
      { header: 'Значение', key: 'value', width: 35 }
    ];

    worksheet.addRows([
      { param: 'Тип операции', value: 'Внутрискладская перекачка' },
      { param: 'Дата', value: resultData.Date },
      { param: 'Сотрудник', value: resultData.Name },
      { param: 'Из резервуара', value: resultData.From_Tank },
      { param: 'В резервуар', value: resultData.To_Tank },
      { param: 'Счетчик ДО', value: resultData.Counter_Before },
      { param: 'Счетчик ПОСЛЕ', value: resultData.Counter_After },
      { param: 'Плотность', value: resultData.Density },
      { param: 'Температура', value: resultData.Temperature },
      { param: 'Объем (л)', value: resultData.Volume },
      { param: 'Масса (кг)', value: resultData.Mass }
    ]);

    worksheet.getRow(1).font = { bold: true };
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Transfer_${resultData.Date.replace(/[: ]/g, '_')}.xlsx`);
  };

  const sortedTanks = [...tanks].sort((a, b) => a.Name.localeCompare(b.Name, undefined, { numeric: true }));

  if (step === 1) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-16 pb-20 px-4 flex flex-col items-center">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-8 text-slate-800 dark:text-slate-100">Выбор резервуара ИЗ</h1>
          <div className="grid grid-cols-2 gap-3">
            {sortedTanks.map(t => (
              <button
                key={t.id}
                onClick={() => { setFromTank(t.Name); setStep(2); }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-5 rounded-2xl text-lg font-bold shadow-sm active:scale-95 transition-all text-slate-800 dark:text-slate-200"
              >
                {t.Name}
              </button>
            ))}
          </div>
          <button onClick={onBack} className="w-full mt-10 py-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-medium flex items-center justify-center gap-2">
            <ArrowLeft className="w-5 h-5" /> Назад
          </button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-16 pb-20 px-4 flex flex-col items-center">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-2 text-slate-800 dark:text-slate-100">Выбор резервуара В</h1>
          <p className="text-center text-slate-500 mb-8">Из резервуара: <span className="font-bold text-emerald-600">{fromTank}</span></p>
          <div className="grid grid-cols-2 gap-3">
            {sortedTanks.filter(t => t.Name !== fromTank).map(t => (
              <button
                key={t.id}
                onClick={() => { setToTank(t.Name); setStep(3); }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 py-5 rounded-2xl text-lg font-bold shadow-sm active:scale-95 transition-all text-slate-800 dark:text-slate-200"
              >
                {t.Name}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(1)} className="w-full mt-10 py-4 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl font-medium flex items-center justify-center gap-2">
            <ArrowLeft className="w-5 h-5" /> Назад
          </button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pt-12 pb-20 px-4 flex flex-col items-center">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-6 text-slate-800 dark:text-slate-100">Данные по перекачке:</h1>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-100 dark:border-slate-700 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Счетчик ДО (л):</label>
              <input 
                type="text" 
                inputMode="decimal" 
                value={counterBefore} 
                onChange={e => setCounterBefore(e.target.value.replace(/[^0-9.,]/g, ''))} 
                className="w-full p-4 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-2xl focus:ring-2 focus:ring-slate-500 outline-none text-lg font-mono" 
                placeholder="0" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1">Счетчик ПОСЛЕ (л):</label>
              <input 
                type="text" 
                inputMode="decimal" 
                value={counterAfter} 
                onChange={e => setCounterAfter(e.target.value.replace(/[^0-9.,]/g, ''))} 
                className="w-full p-4 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-2xl focus:ring-2 focus:ring-slate-500 outline-none text-lg font-mono" 
                placeholder="0" 
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Плотность:</label>
                <input 
                  type="text" 
                  inputMode="decimal" 
                  value={density} 
                  onChange={e => setDensity(e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, ''))}
                  onFocus={(e) => !e.target.value && setDensity('0.')}
                  maxLength={6} 
                  className="w-full p-4 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-2xl focus:ring-2 focus:ring-slate-500 outline-none text-lg font-mono" 
                  placeholder="0.0000" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-500 mb-1">Температура:</label>
                <input 
                  type="text" 
                  inputMode="decimal" 
                  value={temperature} 
                  onChange={e => setTemperature(e.target.value.replace(/[^0-9.,]/g, ''))} 
                  className="w-full p-4 bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-600 rounded-2xl focus:ring-2 focus:ring-slate-500 outline-none text-lg font-mono" 
                  placeholder="0.0" 
                />
              </div>
            </div>
            <div className="pt-2 flex flex-col gap-3">
              <button onClick={handleSave} disabled={isSaving} className={`w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-lg shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}>
                {isSaving ? 'Запись...' : 'Внести данные'}
              </button>
              <button onClick={() => setStep(2)} className="w-full py-4 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium rounded-2xl active:scale-[0.98]">
                Назад
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Receipt Modal Step 4
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* receipt-like container */}
        <div ref={receiptRef} className="w-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xl mb-6 relative overflow-hidden text-slate-800 dark:text-white">
          <div className="flex flex-col items-center mb-6">
            <h3 className="text-xl font-bold text-center text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              Внутрискладская перекачка
            </h3>
            <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-600 my-4"></div>
            <p className="text-xs text-slate-500 font-mono italic">{resultData?.Date}</p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Сотрудник:</span>
              <span className="font-semibold">{resultData?.Name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-xs italic">Резервуар ИЗ:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{resultData?.From_Tank}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 text-xs italic">Резервуар В:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{resultData?.To_Tank}</span>
            </div>
            
            <div className="border-t border-dashed border-slate-300 dark:border-slate-600 my-4"></div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Счетчик ДО:</span>
              <span className="font-mono text-base">{resultData?.Counter_Before} л</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Счетчик ПОСЛЕ:</span>
              <span className="font-mono text-base">{resultData?.Counter_After} л</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Плотность:</span>
              <span className="font-mono text-base">{resultData?.Density} г/см³</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Температура:</span>
              <span className="font-mono text-base">{resultData?.Temperature} °C</span>
            </div>

            <div className="border-t border-dashed border-slate-300 dark:border-slate-600 my-4"></div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Объем:</span>
              <span className="font-mono font-bold text-xl">{resultData?.Volume} л</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-slate-800 dark:text-slate-100">Итого МАССА:</span>
              <span className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400 tracking-tighter">
                {resultData?.Mass} кг
              </span>
            </div>
          </div>
        </div>

        {/* Buttons Section */}
        <div className="w-full flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={handleCopy} className="flex items-center justify-center gap-2 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <Copy className="w-5 h-5" />
              <span className="font-bold text-sm">Копия</span>
            </button>
            <button onClick={handleShare} className="flex items-center justify-center gap-2 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <Share2 className="w-5 h-5" />
              <span className="font-bold text-sm">Отправить</span>
            </button>
          </div>
          <button onClick={handleDownloadExcel} className="flex items-center justify-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Download className="w-5 h-5" />
            <span className="font-bold text-sm">Скачать Excel</span>
          </button>
          <button onClick={() => setStep(1)} className="w-full py-5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white font-black rounded-xl text-xl shadow-xl active:scale-95 transition-all">
            ОК
          </button>
        </div>
      </div>

      {/* MODAL ПРЕДУПРЕЖДЕНИЯ О ЛИМИТАХ РЕЗЕРВУАРА */}
      <TankLimitErrorModal 
        validation={validationError} 
        onClose={() => setValidationError(null)} 
      />
    </div>
  );
}
