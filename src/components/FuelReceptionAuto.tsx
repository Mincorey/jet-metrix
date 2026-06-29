import React, { useState, useEffect } from 'react';
import { Copy, Share2 } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { WorkdayRecord } from '../data/WORKDAY';
import { getLatestDensityDB } from '../data/Daily_Measurements';
import { useToast } from '../context/ToastContext';
import { saveToQueue } from '../utils/offlineQueue';
import { normalizeDensity } from '../utils/densityHelper';

interface FuelReceptionAutoProps {
  currentWorkday: WorkdayRecord;
  onBack: () => void;
}

export default function FuelReceptionAuto({ currentWorkday, onBack }: FuelReceptionAutoProps) {
  const { showToast } = useToast();
  const [activeTanks, setActiveTanks] = useState<any[]>([]);
  const [selectedTank, setSelectedTank] = useState<string | null>(null);

  const [gosNumber, setGosNumber] = useState('');
  const [counterBefore, setCounterBefore] = useState('');
  const [counterAfter, setCounterAfter] = useState('');
  const [density, setDensity] = useState('');
  const [temperature, setTemperature] = useState('');
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
    setGosNumber('');
    setCounterBefore('');
    setCounterAfter('');
    setDensity('');
    setTemperature('');
    setResultData(null);
  };

  const formatGosNumber = (value: string) => {
    const clean = value.toUpperCase().replace(/[^А-ЯA-Z0-9]/g, '').replace(/RUS$/, '');
    let res = '';
    for (let i = 0; i < clean.length; i++) {
        if (i === 2 || i === 6) res += ' ';
        res += clean[i];
    }
    if (clean.length >= 8) {
        if (!res.includes('RUS')) {
             res += ' RUS';
        }
    }
    return res.substring(0, 14);
  };

  const handleCalculateAndSave = async () => {
    if (!gosNumber.trim() || !counterBefore.trim() || !counterAfter.trim() || !density.trim() || !temperature.trim()) {
      showToast('Заполните все поля!', 'error');
      return;
    }

    const before = parseFloat(counterBefore.replace(',', '.'));
    const after = parseFloat(counterAfter.replace(',', '.'));
    const temp = parseFloat(temperature.replace(',', '.'));

    if (isNaN(before) || isNaN(after) || isNaN(temp)) {
      showToast('Введите корректные числовые значения', 'error');
      return;
    }

    if (after < before) {
      showToast('Показания счетчика ПОСЛЕ не могут быть меньше показаний ДО', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const volume = parseFloat((after - before).toFixed(2));

      const parsedDensity = normalizeDensity(density);
      if (isNaN(parsedDensity) || parsedDensity <= 0) {
        showToast('Некорректная плотность.', 'error');
        return;
      }

      const mass = parseFloat((volume * parsedDensity).toFixed(2));

      const currentDate = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

      const recordPayload = {
        Workday_ID: currentWorkday.id,
        Date: currentDate,
        Name: currentWorkday.Name,
        Gos_Number: gosNumber,
        Tank_Name: selectedTank!,
        Counter_Before: before,
        Counter_After: after,
        Density: parsedDensity,
        Temperature: temp,
        Volume: volume,
        Mass: mass
      };

      let result = false;
      let tempId: number | null = null;
      let savedSuccessfully = false;

      if (navigator.onLine) {
          try {
              const resp = await fetch('/api/fuel-reception-auto', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(recordPayload)
              });
              if (resp.ok) {
                  const data = await resp.json();
                  tempId = data.id;
                  result = true;
                  savedSuccessfully = true;
              }
          } catch (e) {
              console.error(e);
          }
      }

      if (!savedSuccessfully) {
        tempId = Date.now();
        await saveToQueue('/api/fuel-reception-auto', recordPayload);
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

    const text = `Прием топлива из АЦ\n` +
      `========================\n` +
      `Сотрудник: ${currentWorkday?.Name} \n` +
      `Гос. Номер: ${resultData.Gos_Number} \n` +
      `Резервуар: ${resultData.Tank_Name} \n` +
      `Счетчик ДО: ${resultData.Counter_Before} л.\n` +
      `Счетчик ПОСЛЕ: ${resultData.Counter_After} л.\n` +
      `Плотность: ${resultData.Density} г / см³\n` +
      `Температура: ${resultData.Temperature} °C\n` +
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
    const element = document.getElementById('reception-auto-result-modal');
    if (!element) return;

    try {
      await new Promise(res => setTimeout(res, 100));
      const blob = await htmlToImage.toBlob(element, {
        quality: 0.95,
        backgroundColor: '#0f172a'
      });

      if (!blob) return;

      const file = new File([blob], `Reception_Auto_${resultData.Gos_Number}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Прием топлива из АЦ: ${resultData.Gos_Number} ` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reception_Auto_${resultData.Gos_Number}.png`;
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
    setGosNumber('');
    setCounterBefore('');
    setCounterAfter('');
    setDensity('');
    setTemperature('');
    setSelectedTank(null);
  };

  const sortedTanks = [...activeTanks].sort((a, b) => a.Name.localeCompare(b.Name, undefined, { numeric: true }));

  if (!selectedTank) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center py-12 px-4 font-sans transition-colors duration-200">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 mb-2">
              Прием из АЦ: Выбор резервуара
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
                  className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 py-5 rounded-2xl text-lg font-bold shadow-sm active:scale-95 transition-all"
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
            Прием из АЦ
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {selectedTank} | {currentWorkday.Date}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-4">Внесите данные:</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Гос. номер АЦ:
              </label>
              <input
                type="text"
                value={gosNumber}
                onChange={(e) => setGosNumber(formatGosNumber(e.target.value))}
                placeholder="XX 0000 00 RUS"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white transition-all font-medium uppercase"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Счетчик ДО (л):
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={counterBefore}
                onChange={(e) => setCounterBefore(e.target.value.replace(/[^0-9.,]/g, ''))}
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
                onChange={(e) => setCounterAfter(e.target.value.replace(/[^0-9.,]/g, ''))}
                placeholder="0"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Плотность (г/см³):
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={density}
                  onChange={(e) => setDensity(e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, ''))}
                  onFocus={(e) => !e.target.value && setDensity('0.')}
                  maxLength={6}
                  placeholder="0.0000"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Температура (°C):
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value.replace(/[^0-9.,\-]/g, ''))}
                  placeholder="0.0"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleCalculateAndSave}
                disabled={isSaving}
                className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-all shadow-md active:scale-[0.98] ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSaving ? 'Запись...' : 'Внести данные'}
              </button>
              <button
                onClick={() => setSelectedTank(null)}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 font-medium py-3 rounded-xl transition-all active:scale-[0.98]"
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

            <div id="reception-auto-result-modal" className="w-full bg-slate-900 border-none rounded-xl p-5 mb-6 text-white shadow-lg overflow-hidden relative" style={{ backgroundColor: '#0f172a' }}>
              <h3 className="text-xl font-bold text-center mb-1 text-white">Прием Топлива АЦ</h3>
              <p className="text-center text-slate-400 text-xs mb-5">
                Сотрудник: {currentWorkday?.Name} | {resultData.Date}
              </p>

              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-center border-b border-indigo-500/30 pb-2">
                  <span className="text-indigo-200 text-sm">Гос. Номер:</span>
                  <span className="font-bold text-indigo-100 tracking-wide bg-indigo-900/50 px-2 py-0.5 rounded">{resultData.Gos_Number}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Резервуар:</span>
                  <span className="font-bold text-white tracking-wide">{resultData.Tank_Name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Объем:</span>
                  <span className="font-mono font-medium text-white">{resultData.Volume} л</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Плотность:</span>
                  <span className="font-mono font-medium text-white">{resultData.Density} г/см³</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Температура:</span>
                  <span className="font-mono font-medium text-white">{resultData.Temperature} °C</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-300 font-medium">Масса:</span>
                  <span className="font-mono font-bold text-indigo-400 text-lg">{resultData.Mass} кг</span>
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
                className="flex-1 flex justify-center items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium py-2.5 rounded-xl text-sm transition-colors border border-slate-200 dark:border-slate-600"
              >
                <Copy className="w-4 h-4" />
                <span>Копия</span>
              </button>
              <button
                onClick={handleShareReception}
                className="flex-1 flex justify-center items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium py-2.5 rounded-xl text-sm transition-colors border border-slate-200 dark:border-slate-600"
              >
                <Share2 className="w-4 h-4" />
                <span>Скрин</span>
              </button>
             </div>

            <button
              onClick={clearForm}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl text-sm transition-colors shadow-md"
            >
              ОК
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
