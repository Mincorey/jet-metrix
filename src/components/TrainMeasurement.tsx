import React, { useState, useEffect } from 'react';
import { X, Copy, Share2 } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { WorkdayRecord } from '../data/WORKDAY';
import { useToast } from '../context/ToastContext';
import { saveToQueue } from '../utils/offlineQueue';

interface TrainMeasurementProps {
  currentWorkday: WorkdayRecord;
  onBack: () => void;
}

export default function TrainMeasurement({ currentWorkday, onBack }: TrainMeasurementProps) {
  const { showToast } = useToast();
  const [activeTrains, setActiveTrains] = useState<any[]>([]);
  const [trainType, setTrainType] = useState('');
  const [trainNumber, setTrainNumber] = useState('');
  const [l1, setL1] = useState('');
  const [l2, setL2] = useState('');
  const [l3, setL3] = useState('');
  const [density, setDensity] = useState('');
  const [temp, setTemp] = useState('');



  const [resultData, setResultData] = useState<any>(null);

  useEffect(() => {
    const fetchTanks = async () => {
      try {
        const res = await fetch('/api/tanks');
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        const parsedTrains = data
          .filter((t: any) => t.Status === 'active' && t.Category === 'train')
          .map((t: any) => ({ ...t, Calibration: JSON.parse(t.Calibration) }));
        setActiveTrains(parsedTrains);
        localStorage.setItem('cached_trains', JSON.stringify(parsedTrains));
      } catch (error) {
        console.error('Error fetching trains:', error);
        const cached = localStorage.getItem('cached_trains');
        if (cached) {
          setActiveTrains(JSON.parse(cached));
        }
      }
    };
    fetchTanks();
  }, []);

  const handleCalculateAndSave = async () => {
    if (!trainNumber.trim() || !l1.trim() || !l2.trim() || !l3.trim() || !density.trim() || !temp.trim()) {
      showToast('Заполните все поля!', 'error');
      return;
    }

    const level1 = parseInt(l1, 10);
    const level2 = parseInt(l2, 10);
    const level3 = parseInt(l3, 10);
    const avgLevel = Math.round((level1 + level2 + level3) / 3);

    const parsedDensity = parseFloat(density.replace(',', '.'));
    const parsedTemp = parseFloat(temp.replace(',', '.'));

    let volume = 0;
    const targetTrain = activeTrains.find(t => t.Name === trainType);
    if (targetTrain && targetTrain.Calibration) {
      const lowerLevel = Math.floor(avgLevel / 10) * 10;
      const upperLevel = lowerLevel + 10;

      const getVol = (rec: any) => {
        const v = rec.volume ?? rec.Volume;
        return typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
      };

      const lowerRecord = targetTrain.Calibration.find((r: any) => Number(r.level ?? r.Level) === lowerLevel);
      const upperRecord = targetTrain.Calibration.find((r: any) => Number(r.level ?? r.Level) === upperLevel);

      let calculatedVolume = 0;

      if (lowerRecord && upperRecord) {
        if (avgLevel === lowerLevel) {
          calculatedVolume = getVol(lowerRecord);
        } else {
          const fraction = (avgLevel - lowerLevel) / 10;
          const volLower = getVol(lowerRecord);
          const volUpper = getVol(upperRecord);
          calculatedVolume = volLower + (volUpper - volLower) * fraction;
        }
      } else if (lowerRecord) {
        calculatedVolume = getVol(lowerRecord);
      } else if (upperRecord) {
        calculatedVolume = getVol(upperRecord);
      }

      volume = Math.round(calculatedVolume);
    }

    const mass = parseFloat((volume * parsedDensity).toFixed(2));

    const currentDate = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

    const payload = {
      Workday_ID: currentWorkday.id,
      Date: currentDate,
      Name: currentWorkday.Name,
      Number: trainNumber,
      Type: trainType,
      Level_1: level1,
      Level_2: level2,
      Level_3: level3,
      Average_Level: avgLevel,
      Density: parsedDensity,
      Temperature: parsedTemp,
      Volume: volume,
      Mass: mass
    };

    try {
      if (navigator.onLine) {
        const response = await fetch('/api/trains', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          setResultData(payload);
        } else {
          showToast('Ошибка при сохранении на сервере.', 'error');
        }
      } else {
        const tempId = Date.now();
        await saveToQueue('/api/trains', payload);
        setResultData({ ...payload, id: tempId });
        showToast('Сеть недоступна. Данные сохранены локально и будут отправлены позже.', 'warning');
      }
    } catch (error) {
      console.error('Error saving train data:', error);
      showToast('Ошибка при соединении с сервером.', 'error');
    }
  };

  const handleCopyTrain = async () => {
    if (!resultData) return;

    const text = `Замер ЖД-цистерны\n` +
      `========================\n` +
      `Сотрудник: ${currentWorkday?.Name}\n` +
      `Вагон №: ${resultData.Number} (тип ${resultData.Type})\n` +
      `Средний уровень: ${resultData.Average_Level} мм\n` +
      `Плотность: ${resultData.Density} г/см³ | Темп: ${resultData.Temperature} °C\n` +
      `Объем: ${resultData.Volume} л.\n` +
      `Масса: ${resultData.Mass} кг.\n` +
      `========================\n` +
      `Дата: ${resultData.Date}`;

    try {
      await navigator.clipboard.writeText(text);
      showToast('Данные замера скопированы!', 'success');
    } catch (err) {
      showToast('Ошибка копирования.', 'error');
    }
  };

  const handleShareTrain = async () => {
    const element = document.getElementById('train-result-modal');
    if (!element) return;

    try {
      // Small delay for rendering
      await new Promise(res => setTimeout(res, 100));
      const blob = await htmlToImage.toBlob(element, {
        quality: 0.95,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff'
      });

      if (!blob) return;

      const file = new File([blob], `Train_${resultData.Number}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Замер вагона: ${resultData.Number}` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Train_${resultData.Number}.png`;
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
    setTrainNumber('');
    setL1('');
    setL2('');
    setL3('');
    setDensity('');
    setTemp('');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center pt-16 pb-20 px-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 mb-2">
            Замер ЖД-цистерны
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Смена: {currentWorkday.Name} | {currentWorkday.Date}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="space-y-6">

            {/* Номер вагона */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Номер цистерны:
              </label>
              <input
                type="text"
                value={trainNumber}
                onChange={(e) => {
                  setTrainNumber(e.target.value);
                }}
                placeholder="Введите номер"
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900 dark:text-white transition-all font-medium"
              />
            </div>

            {/* Тип вагона (чипы) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Тип вагона (Калибровочная таблица):
              </label>
              <div className="flex flex-wrap gap-2 justify-between">
                {activeTrains.map((train) => (
                  <button
                    key={train.id}
                    onClick={() => setTrainType(train.Name)}
                    className={`flex-1 py-4 px-3 rounded-xl text-lg font-bold transition-all shadow-sm active:scale-95 ${trainType === train.Name
                      ? 'bg-blue-600 text-white shadow-md scale-105'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-transparent dark:border-slate-600'
                      }`}
                  >
                    {train.Name}
                  </button>
                ))}
              </div>
            </div>

            {/* Замеры */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Замер №1', value: l1, setter: setL1 },
                { label: 'Замер №2', value: l2, setter: setL2 },
                { label: 'Замер №3', value: l3, setter: setL3 }
              ].map((item, idx) => (
                <div key={idx}>
                  <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    {item.label}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    maxLength={4}
                    value={item.value}
                    onChange={(e) => {
                      item.setter(e.target.value.replace(/\D/g, ''));
                    }}
                    placeholder="мм."
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900 dark:text-white transition-all font-medium text-center"
                  />
                </div>
              ))}
            </div>

            {/* Плотность и Температура */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Плотность:
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
                  placeholder="г/см³"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900 dark:text-white transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Температура:
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={temp}
                  onChange={(e) => {
                    setTemp(e.target.value.replace(/[^0-9.,-]/g, ''));
                  }}
                  placeholder="°C"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-slate-500 text-slate-900 dark:text-white transition-all font-medium"
                />
              </div>
            </div>

            {/* Кнопки действий */}
            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={handleCalculateAndSave}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4.5 rounded-xl text-lg transition-all shadow-md active:scale-[0.98]"
              >
                Записать
              </button>
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

      {/* Модальное окно результатов */}
      {resultData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl flex flex-col items-center">

            <div id="train-result-modal" className="w-full bg-slate-900 border-none rounded-xl p-5 mb-6 text-white shadow-lg overflow-hidden relative">
              <h3 className="text-xl font-bold text-center mb-1 text-white">Замер Цистерны</h3>
              <p className="text-center text-slate-400 text-xs mb-5">
                Сотрудник: {currentWorkday?.Name} | {resultData.Date}
              </p>

              <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Номер вагона:</span>
                  <span className="font-bold text-white tracking-wide">{resultData.Number}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Тип вагона:</span>
                  <span className="font-bold text-white bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded text-xs">{resultData.Type}</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Средний уровень:</span>
                  <span className="font-mono font-medium text-white">{resultData.Average_Level} мм</span>
                </div>
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-slate-400 text-sm">Плотн. / Темп.:</span>
                  <span className="font-mono font-medium text-white">{resultData.Density} / {resultData.Temperature}</span>
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

              {/* Подложка-декорация (невидимая рамка/узор) */}
              <div className="absolute -bottom-8 -right-8 opacity-5">
                <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z" />
                </svg>
              </div>
            </div>

            <div className="w-full flex justify-between gap-3 mb-4">
              <button
                onClick={handleCopyTrain}
                className="flex-1 flex justify-center items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-4 rounded-xl text-base transition-all border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95"
              >
                <Copy className="w-5 h-5" />
                <span>Копия</span>
              </button>
              <button
                onClick={handleShareTrain}
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
