import React, { useState, useRef, useEffect } from 'react';
import { X, Share2, Copy } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { domToBlob, domToDataUrl } from 'modern-screenshot';
import { WorkdayRecord } from '../data/WORKDAY';
import { RGSMeasurement } from '../data/MeasurementTypes';
import { addDailyMeasurementDB } from '../data/Daily_Measurements';
import { useToast } from '../context/ToastContext';
import { saveToQueue } from '../utils/offlineQueue';
import { normalizeDensity } from '../utils/densityHelper';
import { getVolumeFromCalibration } from '../utils/calibrationHelper';
import { getTankLimits, TankValidationResult } from '../utils/tankLimits';
import TankLimitErrorModal from './TankLimitErrorModal';

interface FuelMeasurementProps {
  currentWorkday: WorkdayRecord;
  onBack: () => void;
}

export default function FuelMeasurement({ currentWorkday, onBack }: FuelMeasurementProps) {
  const { showToast } = useToast();
  const [activeTanks, setActiveTanks] = useState<any[]>([]);
  const [selectedTank, setSelectedTank] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<TankValidationResult | null>(null);

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

  // Form state
  const [l1, setL1] = useState('');
  const [l2, setL2] = useState('');
  const [l3, setL3] = useState('');
  const [density, setDensity] = useState('');
  const [temp, setTemp] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Result state
  const [result, setResult] = useState<RGSMeasurement | null>(null);
  const [resultData, setResultData] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const handleTankClick = (tank: string) => {
    setSelectedTank(tank);
    setL1(''); setL2(''); setL3(''); setDensity(''); setTemp('');
    setResult(null);
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (!l1.trim() || !l2.trim() || !l3.trim() || !density.trim() || !temp.trim()) {
      showToast('Заполните все поля!', 'error');
      return;
    }

    const level1 = parseInt(l1, 10);
    const level2 = parseInt(l2, 10);
    const level3 = parseInt(l3, 10);
    const avgLevel = Math.round((level1 + level2 + level3) / 3);

    const parsedDensity = normalizeDensity(density);
    const parsedTemp = parseFloat(temp.replace(',', '.'));

    if (isNaN(parsedDensity) || parsedDensity <= 0 || isNaN(parsedTemp)) {
      showToast('Укажите корректную плотность (> 0) и температуру!', 'error');
      return;
    }

    const selectedTankData = activeTanks.find(t => t.Name === selectedTank);
    if (!selectedTankData || !selectedTankData.Calibration) {
      showToast('Таблица градуировки не найдена', 'error');
      return;
    }

    const calculatedVolume = getVolumeFromCalibration(selectedTankData.Calibration, avgLevel, selectedTankData.Category || 'tank');
    if (calculatedVolume <= 0) {
      showToast(`Объем для уровня ${avgLevel} мм не найден в таблице!`, "error");
      return;
    }

    const volume = Number(calculatedVolume.toFixed(2));

    setIsSaving(true);
    try {
      // Проверка предельного наполнения резервуара
      const limits = getTankLimits(selectedTank!);
      if (limits.hasLimits && volume > limits.maxVolume) {
        const overflow = volume - limits.maxVolume;
        setValidationError({
          isValid: false,
          errorType: 'overflow',
          title: 'Превышение предела наполнения резервуара!',
          message: `Введенный замер уровня (средний уровень: ${avgLevel} мм) соответствует объему ${Math.round(volume).toLocaleString('ru-RU')} л, что превышает максимально допустимый предел наполнения (${limits.maxVolume.toLocaleString('ru-RU')} л) на ${Math.round(overflow).toLocaleString('ru-RU')} л. Проверьте правильность введенных замеров уровня (мм).`,
          tankName: selectedTank!,
          currentVolume: 0,
          operationVolume: Math.round(volume),
          projectedVolume: Math.round(volume),
          limitVolume: limits.maxVolume,
          diffVolume: Math.round(overflow),
        });
        return;
      }

      const mass = parseFloat((volume * parsedDensity).toFixed(2));
      const currentDate = new Date().toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');

      const measurement = {
        Workday_ID: currentWorkday.id,
        Date: currentDate,
        Name: currentWorkday.Name,
        Tank_Name: selectedTank!,
        Level_1: level1,
        Level_2: level2,
        Level_3: level3,
        Average_Level: avgLevel,
        Density: parsedDensity,
        Temperature: parsedTemp,
        Volume: volume,
        Mass: mass
      };

      let result = false;
      let tempId: number | null = null;
      let savedSuccessfully = false;

      if (navigator.onLine) {
        const dbResult = await addDailyMeasurementDB(measurement);
        if (dbResult) {
          result = true;
          savedSuccessfully = true;
        }
      }

      if (!savedSuccessfully) {
        tempId = Date.now();
        await saveToQueue('/api/daily-measurements', measurement);
        showToast('Сеть недоступна или запрос не удался. Данные сохранены локально и будут отправлены позже.', 'warning');
        result = true;
      }

      if (result) {
        // Update local state for display
        const localMeasurement: RGSMeasurement = {
          id: tempId || Date.now(),
          Date: currentDate,
          Level_1: level1,
          Level_2: level2,
          Level_3: level3,
          Average_Level: avgLevel,
          Density: parsedDensity,
          Temperature: parsedTemp,
          Volume: volume,
          Mass: mass
        };

        setResult(localMeasurement);
        setResultData({ ...measurement, id: tempId || Date.now() }); // Показываем модалку с чеком
      } else {
        showToast('Ошибка при сохранении замера на Сервере.', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyTank = async () => {
    if (!resultData) return;

    const text = `ЗАМЕР РЕЗЕРВУАРА: ${resultData.Tank_Name} \n` +
      `========================\n` +
      `Сотрудник: ${currentWorkday?.Name}\n` +
      `Уровни(1, 2, 3): ${resultData.Level_1}, ${resultData.Level_2}, ${resultData.Level_3} \n` +
      `Средний уровень: ${resultData.Average_Level} мм\n` +
      `Плотность: ${resultData.Density} | Темп: ${resultData.Temperature} \n` +
      `Объем: ${resultData.Volume} л.\n` +
      `Масса: ${resultData.Mass} кг.\n` +
      `======================== `;

    try {
      await navigator.clipboard.writeText(text);
      showToast('Данные замера скопированы!', 'success');
    } catch (err) {
      showToast('Ошибка копирования.', 'error');
    }
  };

  const handleShareTank = async () => {
    const element = document.getElementById('tank-result-modal');
    if (!element) return;

    try {
      await new Promise(res => setTimeout(res, 100));
      const blob = await htmlToImage.toBlob(element, {
        quality: 0.95,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#334155' : '#f8fafc'
      });

      if (!blob) return;

      const file = new File([blob], `Tank_${resultData.Tank_Name}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `Замер: ${resultData.Tank_Name} ` });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Tank_${resultData.Tank_Name}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Скриншот чека скачан!', 'success');
      }
    } catch (err) {
      showToast('Ошибка создания скриншота.', 'error');
    }
  };

  const handleShare = async () => {
    if (!resultRef.current) return;
    try {
      const blob = await domToBlob(resultRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      if (blob && navigator.share) {
        try {
          const file = new File([blob], `Замер_${selectedTank}.png`, { type: 'image/png' });
          await navigator.share({
            files: [file],
            title: 'Результаты замера',
            text: `Замер ${selectedTank} от ${currentWorkday.Date} `
          });
        } catch (shareErr) {
          if ((shareErr as Error).name !== 'AbortError') {
            console.error('Share failed:', shareErr);
            showToast('Не удалось отправить файл', 'error');
          }
        }
      } else {
        showToast('Функция "Поделиться" не поддерживается на вашем устройстве или браузере', 'error');
      }
    } catch (err) {
      console.error('Error sharing:', err);
      showToast('Ошибка при подготовке изображения', 'error');
    }
  };

  const handleDownload = async () => {
    if (!resultRef.current) return;
    try {
      const dataUrl = await domToDataUrl(resultRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = dataUrl;
      link.download = `Замер_${selectedTank}_${currentWorkday.Date}.png`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
    } catch (err) {
      console.error('Error downloading:', err);
      showToast('Ошибка при скачивании изображения', 'error');
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = `Резервуар: ${selectedTank}
Уровень: ${result.Average_Level} мм.
  Плотность: ${result.Density} г / см.куб.
    Температура: ${result.Temperature} гр.Ц.
      Объем: ${result.Volume} л.
        Масса: ${result.Mass} кг.`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Copy failed:', err);
      showToast('Не удалось скопировать текст', 'error');
    });
  };

  const sortedTanks = [...activeTanks].sort((a, b) => a.Name.localeCompare(b.Name, undefined, { numeric: true }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center pt-16 pb-20 px-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 mb-2">
            Выбор резервуара для замера
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6 w-full max-w-md mx-auto">
          {sortedTanks.map(tank => (
            <button
              key={tank.id}
              type="button"
              onClick={() => handleTankClick(tank.Name)}
              className={`w-full py-5 px-3 rounded-2xl text-lg font-bold transition-all shadow-sm active:scale-95 ${selectedTank === tank.Name
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
                }`}
            >
              {tank.Name}
            </button>
          ))}
        </div>

        <div className="w-full max-w-xs h-px bg-slate-200 dark:bg-slate-700 my-4"></div>

        <div className="flex flex-col w-full sm:w-64 gap-3">
        <button
          onClick={onBack}
          className="w-full py-4 mt-8 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium rounded-2xl transition-colors"
        >
          Назад
        </button>
        </div>
      </div>

      {/* Модальное окно ввода замеров */}
      {selectedTank && !resultData && !result && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Введите данные замеров</h3>
              <button onClick={() => setSelectedTank(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <span className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1 rounded-full text-sm font-medium">
                  {selectedTank}
                </span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Замер №1 в мм.
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={l1}
                  onChange={(e) => { setL1(e.target.value.replace(/\D/g, '')); }}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                  placeholder="0000"
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Замер №2 в мм.
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={l2}
                  onChange={(e) => { setL2(e.target.value.replace(/\D/g, '')); }}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                  placeholder="0000"
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Замер №3 в мм.
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={l3}
                  onChange={(e) => { setL3(e.target.value.replace(/\D/g, '')); }}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                  placeholder="0000"
                  inputMode="decimal"
                />
              </div>

              <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-1"></div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Плотность, г/см.куб.
                </label>
                <input
                  type="text"
                  value={density}
                  onChange={(e) => { setDensity(e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '')); }}
                  onFocus={(e) => !e.target.value && setDensity('0.')}
                  maxLength={6}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                  placeholder="0.0000"
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Температура, гр. Ц
                </label>
                <input
                  type="text"
                  value={temp}
                  onChange={(e) => { setTemp(e.target.value.replace(/[^0-9.,-]/g, '')); }}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                  placeholder="00.0"
                  inputMode="decimal"
                />
              </div>

              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSaving ? 'Запись...' : 'Записать'}
                </button>
                <button
                  onClick={() => setSelectedTank(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-base font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Выскакивающий "Чек" результата */}
      {resultData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl flex flex-col items-center">

            <div id="tank-result-modal" className="w-full bg-slate-50 dark:bg-slate-700/50 rounded-xl p-5 border border-slate-200 dark:border-slate-600 mb-6" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? '#334155' : '#f8fafc' }}>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-1">
                Результаты: {resultData.Tank_Name}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-4">
                Сотрудник: {currentWorkday?.Name}
              </p>

              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-600 pb-2">
                  <span className="text-slate-500 dark:text-slate-400 text-sm">Средний уровень:</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{resultData.Average_Level} мм</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-600 pb-2">
                  <span className="text-slate-500 dark:text-slate-400 text-sm">Плотность / Темп:</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{resultData.Density} / {resultData.Temperature}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-600 pb-2">
                  <span className="text-slate-500 dark:text-slate-400 text-sm">Объем:</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">{resultData.Volume} л</span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Масса:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-lg">{resultData.Mass} кг</span>
                </div>
              </div>
            </div>

            <div className="w-full flex justify-between gap-3">
              <button
                onClick={handleCopyTank}
                className="flex-1 flex justify-center items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-4 rounded-xl text-base transition-all border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95"
              >
                <Copy className="w-5 h-5" />
                <span>Копия</span>
              </button>
              <button
                onClick={handleShareTank}
                className="flex-1 flex justify-center items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-4 rounded-xl text-base transition-all border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95"
              >
                <Share2 className="w-5 h-5" />
                <span>Скрин</span>
              </button>
            </div>

            <button
              onClick={() => {
                setResultData(null);
                setSelectedTank(null); // Закрываем все модалки
              }}
              className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4.5 rounded-xl text-lg transition-all shadow-md active:scale-95"
            >
              ОК
            </button>
          </div>
        </div>
      )}

      {/* MODAL ПРЕДУПРЕЖДЕНИЯ О ЛИМИТАХ РЕЗЕРВУАРА */}
      <TankLimitErrorModal 
        validation={validationError} 
        onClose={() => setValidationError(null)} 
      />
    </div>
  );
}
