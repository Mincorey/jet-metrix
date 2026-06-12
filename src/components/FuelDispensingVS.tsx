import React, { useState, useEffect } from 'react';
import { Copy, Share2 } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { WorkdayRecord } from '../data/WORKDAY';
import { FuelDispensingVSRecord, addFuelDispensingVSDB } from '../data/Fuel_Dispensing_VS';
import { getLatestDensityDB } from '../data/Daily_Measurements';
import { useToast } from '../context/ToastContext';
import { saveToQueue } from '../utils/offlineQueue';
import { normalizeDensity } from '../utils/densityHelper';

interface FuelDispensingVSProps {
  currentWorkday: WorkdayRecord;
  onBack: () => void;
}

export default function FuelDispensingVS({ currentWorkday, onBack }: FuelDispensingVSProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [activeTanks, setActiveTanks] = useState<any[]>([]);
  const [activeTzas, setActiveTzas] = useState<any[]>([]);
  const [selectedTZA, setSelectedTZA] = useState<string | null>(null);

  useEffect(() => {
    const fetchTzas = async () => {
      try {
        const res = await fetch('/api/tza');
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        setActiveTzas(data);
        localStorage.setItem('cached_tza', JSON.stringify(data));
      } catch (error) {
        console.error('Error fetching TZAs:', error);
        const cached = localStorage.getItem('cached_tza');
        if (cached) {
          setActiveTzas(JSON.parse(cached));
        }
      }
    };
    fetchTzas();
  }, []);

  const [controlNumber, setControlNumber] = useState('');
  const [passportNumber, setPassportNumber] = useState('');
  const [passportDate, setPassportDate] = useState('');
  const [densityStr, setDensityStr] = useState('');
  const [volumeStr, setVolumeStr] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [resultData, setResultData] = useState<any>(null);

  const handleTZAClick = (tza: string) => {
    setSelectedTZA(tza);
    setControlNumber('');
    setPassportNumber('');
    setPassportDate('');
    setDensityStr('');
    setVolumeStr('');
    setResultData(null);
    setStep(2);
  };

  const handleCalculateAndSave = async () => {
    if (!controlNumber.trim() || !passportNumber.trim() || !passportDate.trim() || !densityStr.trim() || !volumeStr.trim()) {
      showToast('Заполните все поля!', 'error');
      return;
    }

    const density = normalizeDensity(densityStr);
    const volume = parseFloat(volumeStr.replace(',', '.'));

    if (isNaN(density) || isNaN(volume)) {
      showToast('Введите корректные числовые значения', 'error');
      return;
    }

    if (volume <= 0) {
      showToast('Количество выданного топлива должно быть больше нуля', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const mass = Math.round(volume * density);

      const currentDate = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

      const recordPayload = {
        Workday_ID: currentWorkday.id,
        Date: currentDate,
        Name: currentWorkday.Name,
        TZA: selectedTZA!,
        Control_Number: controlNumber.trim(),
        Passport_Number: passportNumber.trim(),
        Passport_Date: passportDate.trim(),
        Density: density,
        Volume: volume,
        Mass: mass
      };

      let result = false;
      let tempId: number | null = null;

      if (navigator.onLine) {
        const dbResult = await addFuelDispensingVSDB(recordPayload);
        if (dbResult) result = true;
      } else {
        tempId = Date.now();
        await saveToQueue('/api/fuel-dispensing-vs', recordPayload);
        result = true;
        showToast('Сеть недоступна. Данные сохранены локально и будут отправлены позже.', 'warning');
      }

      if (result) {
        setResultData({ ...recordPayload, id: tempId || Date.now() });
      } else {
        showToast('Ошибка при сохранении заправки ВС на Сервере.', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyVS = async () => {
    if (!resultData) return;

    const text = `Выдача в ВС\n` +
      `========================\n` +
      `Сотрудник: ${currentWorkday?.Name}\n` +
      `ТЗА: ${resultData.TZA}\n` +
      `Контрольный талон: ${resultData.Control_Number}\n` +
      `Паспорт № ${resultData.Passport_Number} от ${resultData.Passport_Date}\n` +
      `Плотность: ${resultData.Density} г/см³\n` +
      `Объем: ${resultData.Volume} л.\n` +
      `Масса: ${resultData.Mass} кг.\n` +
      `========================\n` +
      `Дата: ${resultData.Date}`;

    try {
      await navigator.clipboard.writeText(text);
      showToast('Данные выдачи скопированы!', 'success');
    } catch (err) {
      showToast('Ошибка копирования.', 'error');
    }
  };

  const handleShareVS = async () => {
    const element = document.getElementById('vs-result-modal');
    if (!element) return;

    try {
      await new Promise(res => setTimeout(res, 100)); // wait for render
      const blob = await htmlToImage.toBlob(element, {
        quality: 0.95,
        backgroundColor: '#0f172a'
      });

      if (!blob) return;

      const file = new File([blob], `Dispense_VS_${resultData.TZA}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Выдача в ВС, ТЗА: ${resultData.TZA}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Dispense_VS_${resultData.TZA}.png`;
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
    setStep(1);
    setSelectedTZA(null);
    setControlNumber('');
    setPassportNumber('');
    setPassportDate('');
    setDensityStr('');
    setVolumeStr('');
  };

  // Step 1: Select TZA
  if (step === 1) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center pt-16 pb-20 px-4 font-sans transition-colors duration-200">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 mb-2">
              Выбор топливозаправщика
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Смена: {currentWorkday.Name} | {currentWorkday.Date}
            </p>
          </div>

          <div className="space-y-4">
            {activeTzas.length === 0 ? (
              <p className="text-center text-slate-500 py-4">Нет доступных ТЗА</p>
            ) : (
              activeTzas.map((tza) => (
                <button
                  key={tza.id}
                  onClick={() => handleTZAClick(tza.Name)}
                  className="w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-lg font-bold py-4 px-4 rounded-xl transition-all shadow-sm active:scale-95"
                >
                  ТЗА {tza.Name}
                </button>
              ))
            )}

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

  // Step 2: Input Data
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center py-12 px-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 mb-2">
            Выдача в ВС
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ТЗА: {selectedTZA} | {currentWorkday.Date}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-4">Введите данные по выдаче топлива в ВС:</h3>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Номер контрольного талона:
              </label>
                              <input
                              type="text"
                              inputMode="decimal"
                              value={controlNumber}
                              onChange={(e) => {
                                setControlNumber(e.target.value.replace(/[^0-9]/g, ''));
                              }}
                              placeholder="Например: 12345"
                              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                            />            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Плотность из контрольного талона:
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={densityStr}
                onChange={(e) => {
                  setDensityStr(e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, ''));
                }}
                onFocus={(e) => !e.target.value && setDensityStr('0.')}
                maxLength={6}
                placeholder="0.0000"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                № паспорта качества:
              </label>
              <input
                type="text"
                value={passportNumber}
                onChange={(e) => setPassportNumber(e.target.value)}
                placeholder="Например: 1234/56"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Дата паспорта качества:
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={passportDate}
                onChange={(e) => {
                  let val = e.target.value.replace(/\D/g, '');
                  if (val.length > 2) val = val.slice(0, 2) + '.' + val.slice(2);
                  if (val.length > 5) val = val.slice(0, 5) + '.' + val.slice(5, 9);
                  setPassportDate(val);
                }}
                maxLength={10}
                placeholder="ДД.ММ.ГГГГ"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Количество выданного топлива (л):
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={volumeStr}
                onChange={(e) => {
                  setVolumeStr(e.target.value.replace(/[^0-9.,]/g, ''));
                }}
                placeholder="0"
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
                onClick={() => setStep(1)}
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

            <div id="vs-result-modal" className="w-full bg-slate-900 border-none rounded-xl p-5 mb-6 text-white shadow-lg overflow-hidden relative" style={{ backgroundColor: '#0f172a' }}>
              <h3 className="text-xl font-bold text-center mb-1 text-white">Выдача в ВС</h3>
              <p className="text-center text-slate-400 text-xs mb-5">
                Сотрудник: {currentWorkday?.Name} | {resultData.Date}
              </p>

              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">ТЗА №:</span>
                  <span className="font-bold text-white tracking-wide">{resultData.TZA}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Контр. талон:</span>
                  <span className="font-bold text-white tracking-wide">{resultData.Control_Number}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Паспорт №:</span>
                  <span className="font-bold text-white tracking-wide text-right text-xs mt-1 leading-snug">№ {resultData.Passport_Number} <br />от {resultData.Passport_Date}</span>
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
                onClick={handleCopyVS}
                className="flex-1 flex justify-center items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-4 rounded-xl text-base transition-all border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95"
              >
                <Copy className="w-5 h-5" />
                <span>Копия</span>
              </button>
              <button
                onClick={handleShareVS}
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
