import React, { useState, useEffect } from 'react';
import { X, Copy, Share2 } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { WorkdayRecord } from '../data/WORKDAY';
import { addFuelReceptionRecordDB } from '../data/Fuel_Reception';
import { getLatestDensityDB } from '../data/Daily_Measurements';
import { useToast } from '../context/ToastContext';
import { saveToQueue } from '../utils/offlineQueue';
import { normalizeDensity } from '../utils/densityHelper';

interface FuelReceptionProps {
  currentWorkday: WorkdayRecord;
  onBack: () => void;
}

export default function FuelReception({ currentWorkday, onBack }: FuelReceptionProps) {
  const { showToast } = useToast();
  const [activeTanks, setActiveTanks] = useState<any[]>([]);
  const [selectedTank, setSelectedTank] = useState<string | null>(null);

  const [counterBefore, setCounterBefore] = useState('');
  const [counterAfter, setCounterAfter] = useState('');
  const [density, setDensity] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [resultData, setResultData] = useState<any>(null);

  useEffect(() => {
    const fetchTanks = async () => {
      try {
        const res = await fetch('/api/tanks');
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        const parsedTanks = data
          .filter((t: any) => t.Status === 'active' && (t.Category === 'tank' || !t.Category))
          .map((t: any) => ({ ...t, Calibration: JSON.parse(t.Calibration) }));
        setActiveTanks(parsedTanks);
        localStorage.setItem('cached_tanks', JSON.stringify(parsedTanks));
      } catch (error) {
        console.error('Error fetching tanks:', error);
        const cached = localStorage.getItem('cached_tanks');
        if (cached) {
          setActiveTanks(JSON.parse(cached));
        }
      }
    };
    fetchTanks();
  }, []);

  useEffect(() => {
    if (selectedTank) {
      const fetchDensity = async () => {
        const latestDensity = await getLatestDensityDB(selectedTank);
        if (latestDensity) {
          setDensity(latestDensity.toString());
        } else {
          setDensity('');
        }
      };
      fetchDensity();
    }
  }, [selectedTank]);

  const handleTankClick = (tank: string) => {
    setSelectedTank(tank);
    setCounterBefore('');
    setCounterAfter('');
    setDensity('');
    setResultData(null);
  };

  const handleCalculateAndSave = async () => {
    if (!counterBefore.trim() || !counterAfter.trim() || !density.trim()) {
      showToast('Заполните все поля!', 'error');
      return;
    }

    const before = parseFloat(counterBefore.replace(',', '.'));
    const after = parseFloat(counterAfter.replace(',', '.'));

    if (isNaN(before) || isNaN(after)) {
      showToast('Введите корректные числовые значения', 'error');
      return;
    }

    if (after < before) {
      showToast('Показания счетчика ПОСЛЕ не могут быть меньше показаний ДО', 'error');
      return;
    }

    const volume = parseFloat((after - before).toFixed(2));

    const parsedDensity = normalizeDensity(density);
    if (isNaN(parsedDensity) || parsedDensity <= 0) {
      showToast('Некорректная плотность.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const mass = parseFloat((volume * parsedDensity).toFixed(2));

      const currentDate = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

      const recordPayload = {
        Workday_ID: currentWorkday.id,
        Date: currentDate,
        Name: currentWorkday.Name,
        Tank_Name: selectedTank!,
        Counter_Before: before,
        Counter_After: after,
        Density: parsedDensity,
        Volume: volume,
        Mass: mass
      };

      let result = false;
      let tempId: number | null = null;
      let savedSuccessfully = false;

      if (navigator.onLine) {
        const dbResult = await addFuelReceptionRecordDB(recordPayload);
        if (dbResult) {
          result = true;
          savedSuccessfully = true;
        }
      }

      if (!savedSuccessfully) {
        tempId = Date.now();
        await saveToQueue('/api/fuel-reception', recordPayload);
        result = true;
        showToast('Сеть недоступна или запрос не удался. Данные сохранены локально и будут отправлены позже.', 'warning');
      }

      if (result) {
        setResultData({ ...recordPayload, id: tempId || Date.now() });
      } else {
        showToast('Ошибка при сохранении данных на Сервере.', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyReception = async () => {
    if (!resultData) return;

    const text = `Прием топлива\n` +
      `========================\n` +
      `Сотрудник: ${currentWorkday?.Name} \n` +
      `Резервуар: ${resultData.Tank_Name} \n` +
      `Счетчик ДО: ${resultData.Counter_Before} л.\n` +
      `Счетчик ПОСЛЕ: ${resultData.Counter_After} л.\n` +
      `Плотность: ${resultData.Density} г / см³\n` +
      `Объем: ${resultData.Volume} л.\n` +
      `Масса: ${resultData.Mass} кг.\n` +
      `========================\n` +
      `Дата: ${resultData.Date} `;

    try {
      await navigator.clipboard.writeText(text);
      showToast('Данные приема скопированы!', 'success');
    } catch (err) {
      showToast('Ошибка копирования.', 'error');
    }
  };

  const handleShareReception = async () => {
    const element = document.getElementById('reception-result-modal');
    if (!element) return;

    try {
      await new Promise(res => setTimeout(res, 100));
      const blob = await htmlToImage.toBlob(element, {
        quality: 0.95,
        backgroundColor: '#0f172a'
      });

      if (!blob) return;

      const file = new File([blob], `Reception_${resultData.Tank_Name}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Прием топлива: ${resultData.Tank_Name} ` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reception_${resultData.Tank_Name}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Скриншот чека скачан!', 'success');
      }
    } catch (err) {
      console.error('Screenshot error:', err);
      showToast('Ошибка создания скриншота.', 'error');
    }
  };

  const clearForm = () => {
    setResultData(null);
    setCounterBefore('');
    setCounterAfter('');
    setDensity('');
    setSelectedTank(null);
  };

  const sortedTanks = [...activeTanks].sort((a, b) => a.Name.localeCompare(b.Name, undefined, { numeric: true }));

  if (!selectedTank) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center pt-16 pb-20 px-4 font-sans transition-colors duration-200">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 mb-2">
              Выбор приёмного резервуара:
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Смена: {currentWorkday.Name} | {currentWorkday.Date}
            </p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 mb-6 w-full max-w-md mx-auto">
              {sortedTanks.map(tank => (
                <button
                  key={tank.id}
                  onClick={() => handleTankClick(tank.Name)}
                  className="w-full py-5 px-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl text-lg font-bold transition-all shadow-sm active:scale-95"
                >
                  {tank.Name}
                </button>
              ))}
            </div>

            <div className="pt-4">
              <button
                onClick={onBack}
                className="w-full py-4 mt-8 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium rounded-2xl transition-colors"
              >
                Назад
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center py-12 px-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 mb-2">
            Прием топлива
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {selectedTank} | {currentWorkday.Date}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-4">Введите показания счетчика приема:</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Счетчик ДО (л):
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={counterBefore}
                onChange={(e) => {
                  setCounterBefore(e.target.value.replace(/[^0-9.,]/g, ''));
                }}
                placeholder="0"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Счетчик ПОСЛЕ (л):
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={counterAfter}
                onChange={(e) => {
                  setCounterAfter(e.target.value.replace(/[^0-9.,]/g, ''));
                }}
                placeholder="0"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Плотность (г/см³):
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={density}
                onChange={(e) => {
                  setDensity(e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, ''));
                }}
                onFocus={(e) => !e.target.value && setDensity('0.')}
                maxLength={6}
                placeholder="0.0000"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
              />
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleCalculateAndSave}
                disabled={isSaving}
                className={`w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4.5 rounded-xl text-lg transition-all shadow-md active:scale-[0.98] ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSaving ? 'Запись...' : 'Записать'}
              </button>
              <button
                onClick={() => setSelectedTank(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-bold py-4 rounded-xl text-base transition-all active:scale-[0.98]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно результатов */}
      {resultData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl flex flex-col items-center">

            <div id="reception-result-modal" className="w-full bg-slate-900 border-none rounded-xl p-5 mb-6 text-white shadow-lg overflow-hidden relative" style={{ backgroundColor: '#0f172a' }}>
              <h3 className="text-xl font-bold text-center mb-1 text-white">Прием Топлива</h3>
              <p className="text-center text-slate-400 text-xs mb-5">
                Сотрудник: {currentWorkday?.Name} | {resultData.Date}
              </p>

              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Резервуар:</span>
                  <span className="font-bold text-white tracking-wide">{resultData.Tank_Name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Счетчик ДО:</span>
                  <span className="font-mono font-medium text-white">{resultData.Counter_Before} л</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Счетчик ПОСЛЕ:</span>
                  <span className="font-mono font-medium text-white">{resultData.Counter_After} л</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Плотность:</span>
                  <span className="font-mono font-medium text-white">{resultData.Density} г/см³</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Объем:</span>
                  <span className="font-mono font-medium text-white">{resultData.Volume} л</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-300 font-medium">Масса:</span>
                  <span className="font-mono font-bold text-emerald-400 text-lg">{resultData.Mass} кг</span>
                </div>
              </div>

              <div className="absolute -bottom-8 -right-8 opacity-5">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z" />
                </svg>
              </div>
            </div>

            <div className="w-full flex justify-between gap-3 mb-4">
              <button
                onClick={handleCopyReception}
                className="flex-1 flex justify-center items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-4 rounded-xl text-base transition-all border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95"
              >
                <Copy className="w-5 h-5" />
                <span>Копия</span>
              </button>
              <button
                onClick={handleShareReception}
                className="flex-1 flex justify-center items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-4 rounded-xl text-base transition-all border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95"
              >
                <Share2 className="w-5 h-5" />
                <span>Скрин</span>
              </button>
            </div>

            <button
              onClick={clearForm}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4.5 rounded-xl text-lg transition-all shadow-md active:scale-95"
            >
              ОК
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
