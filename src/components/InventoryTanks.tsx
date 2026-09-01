import React, { useState, useEffect } from 'react';
import { Share2, Copy } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { addInventoryRecord, inventoryTable } from '../data/Inventory';
import { WorkdayRecord } from '../data/WORKDAY';
import { useToast } from '../context/ToastContext';
import { saveToQueue } from '../utils/offlineQueue';
import { normalizeDensity } from '../utils/densityHelper';
import { getVolumeFromCalibration } from '../utils/calibrationHelper';

// Константы больше не нужны, так как трубопроводы теперь - Тех. Линии в БД

interface InventoryTanksProps {
  currentWorkday: WorkdayRecord | null;
  onBack: () => void;
}

export default function InventoryTanks({ currentWorkday, onBack }: InventoryTanksProps) {
  const { showToast } = useToast();
  const [activeTanks, setActiveTanks] = useState<any[]>([]);
  const [selectedTank, setSelectedTank] = useState<string | null>(null);
  const [level1, setLevel1] = useState('');
  const [level2, setLevel2] = useState('');
  const [level3, setLevel3] = useState('');
  const [density, setDensity] = useState('');
  const [temperature, setTemperature] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [tzasList, setTzasList] = useState<any[]>([]);
  const [techLinesList, setTechLinesList] = useState<any[]>([]);

  const totalTzaVolume = tzasList.reduce((sum, tza) => sum + (Number(tza.Volume) || 0), 0);
  const totalTechVolume = techLinesList.reduce((sum, line) => sum + (Number(line.Volume) || 0), 0);
  const DYNAMIC_TOTAL_CONSTANTS = totalTzaVolume + totalTechVolume;

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

    const fetchTzas = async () => {
      try {
        const res = await fetch('/api/tza');
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        setTzasList(data);
        localStorage.setItem('cached_tza', JSON.stringify(data));
      } catch (error) {
        console.error('Error fetching TZAs:', error);
        const cached = localStorage.getItem('cached_tza');
        if (cached) {
          setTzasList(JSON.parse(cached));
        }
      }
    };

    const fetchTechLines = async () => {
      try {
        const res = await fetch('/api/tech-lines');
        if (!res.ok) throw new Error('Network response was not ok');
        const data = await res.json();
        setTechLinesList(data);
        localStorage.setItem('cached_tech_lines', JSON.stringify(data));
      } catch (error) {
        console.error('Error fetching Tech Lines:', error);
        const cached = localStorage.getItem('cached_tech_lines');
        if (cached) {
          setTechLinesList(JSON.parse(cached));
        }
      }
    };

    fetchTanks();
    fetchTzas();
    fetchTechLines();
  }, []);

  const handleTankClick = (tank: string) => {
    setSelectedTank(tank);
    setLevel1('');
    setLevel2('');
    setLevel3('');
    setDensity('');
    setTemperature('');
  };

  const handleSave = () => {
    if (!level1 || !level2 || !level3 || !density || !temperature) {
      showToast('Заполните все поля', 'error');
      return;
    }

    const l1 = parseInt(level1, 10);
    const l2 = parseInt(level2, 10);
    const l3 = parseInt(level3, 10);

    if (isNaN(l1) || isNaN(l2) || isNaN(l3)) {
      showToast('Замеры должны быть числами', 'error');
      return;
    }

    const tempStr = temperature.replace(',', '.');
    const den = normalizeDensity(density);
    const temp = parseFloat(tempStr);

    if (isNaN(den) || den <= 0 || isNaN(temp)) {
      showToast('Укажите корректную плотность (> 0) и температуру!', 'error');
      return;
    }

    const avgLevel = Math.round((l1 + l2 + l3) / 3);

    const targetTank = activeTanks.find(t => t.Name === selectedTank);
    if (!targetTank || !targetTank.Calibration) {
      showToast('Таблица градуировки не найдена', 'error');
      return;
    }

    const calculatedVolume = getVolumeFromCalibration(targetTank.Calibration, avgLevel, targetTank.Category || 'tank');
    if (calculatedVolume <= 0) {
      showToast(`Объем для уровня ${avgLevel} мм не найден в таблице!`, "error");
      return;
    }

    const volume: number = Number(calculatedVolume.toFixed(2));
    const mass = volume * den;

    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;

    addInventoryRecord({
      date: formattedDate,
      Tank_name: selectedTank!,
      Level_1: l1,
      Level_2: l2,
      Level_3: l3,
      Average_Level: avgLevel,
      Density: den,
      Temperature: temp,
      Volume: Number(volume.toFixed(2)),
      Mass: Number(mass.toFixed(2)),
    });

    setSelectedTank(null);
  };

  const handleSaveInventoryAct = async () => {
    if (isSaving) return;
    setIsSaving(true);
    let payload: any = null;
    try {
      // Считаем суммы ТОЛЬКО по самим 13 резервуарам
      const tanksTotalVolume = inventoryTable.reduce((sum, r) => sum + (Number(r.Volume) || 0), 0);
      const tanksTotalMass = inventoryTable.reduce((sum, r) => sum + (Number(r.Mass) || 0), 0);

      // Рассчитываем средневзвешенную плотность всего склада
      const averageDensity = tanksTotalVolume > 0 ? tanksTotalMass / tanksTotalVolume : 0;

      // Вычисляем финальные ИТОГИ (резервуары + TZA + Линии)
      const finalTotalVolume = tanksTotalVolume + DYNAMIC_TOTAL_CONSTANTS;
      const finalTotalMass = tanksTotalMass + (DYNAMIC_TOTAL_CONSTANTS * averageDensity);

      payload = {
        Workday_ID: currentWorkday?.id || null,
        Date: currentWorkday?.Date || new Date().toLocaleDateString('ru-RU'),
        Name: currentWorkday?.Name || 'Старший авиатехник',
        Total_Volume: finalTotalVolume,
        Total_Mass: finalTotalMass,
        Details: inventoryTable
      };

      let savedSuccessfully = false;
      if (navigator.onLine) {
        const response = await fetch('/api/inventory', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          showToast('Инвентаризация успешно сохранена!', 'success');
          savedSuccessfully = true;
        } else {
          showToast('Ошибка при сохранении на сервере.', 'error');
        }
      }

      if (!savedSuccessfully && !navigator.onLine) {
        await saveToQueue('/api/inventory', payload);
        showToast('Сеть недоступна. Данные сохранены локально и будут отправлены позже.', 'warning');
        savedSuccessfully = true;
      }

      if (savedSuccessfully) {
        inventoryTable.length = 0; // Очищаем локальные данные после успешного сохранения
        onBack();
      }
    } catch (error) {
      console.error(error);
      await saveToQueue('/api/inventory', payload);
      showToast('Сбой сети. Данные сохранены локально на устройстве.', 'warning');
      inventoryTable.length = 0; // Очищаем локальные данные после успешного сохранения
      onBack();
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyTank = async () => {
    // В данном окне мы вычисляем параметры налету, но для копирования нам нужно
    // сначала рассчитать объем и массу, как мы это делаем в handleSave.

    const l1 = parseInt(level1, 10);
    const l2 = parseInt(level2, 10);
    const l3 = parseInt(level3, 10);
    const den = normalizeDensity(density);
    const temp = parseFloat(temperature.replace(',', '.'));

    let avgLevel = isNaN(l1) || isNaN(l2) || isNaN(l3) ? '-' : Math.round((l1 + l2 + l3) / 3);
    let volume: number | string = '-';
    let mass: number | string = '-';

    if (typeof avgLevel === 'number') {
      const targetTank = activeTanks.find(t => t.Name === selectedTank);
      if (targetTank && targetTank.Calibration) {
        const parsedCalibration = targetTank.Calibration;
        const getLevel = (rec: any) => Number((rec.Level ?? rec.level) || 0);
        const getVol = (rec: any) => {
          const v = rec.Volume ?? rec.volume;
          return typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
        };

        const maxLevel = Math.max(...parsedCalibration.map(getLevel));
        const scaleFactor = maxLevel < 1000 ? 10 : 1;
        const targetLevel = avgLevel / scaleFactor;

        let calculatedVolume = 0;
        const exactMatch = parsedCalibration.find((r: any) => getLevel(r) === targetLevel);

        if (exactMatch) {
          calculatedVolume = getVol(exactMatch);
        } else {
          const sorted = [...parsedCalibration].sort((a, b) => getLevel(a) - getLevel(b));
          const lower = sorted.filter((r: any) => getLevel(r) < targetLevel).pop();
          const upper = sorted.filter((r: any) => getLevel(r) > targetLevel).shift();

          if (lower && upper) {
            const lL = getLevel(lower);
            const uL = getLevel(upper);
            const lV = getVol(lower);
            const uV = getVol(upper);
            calculatedVolume = lV + (uV - lV) * ((targetLevel - lL) / (uL - lL));
          } else if (lower) {
            calculatedVolume = getVol(lower);
          } else if (upper) {
            calculatedVolume = getVol(upper);
          }
        }

        if (calculatedVolume > 0) {
          volume = Number(calculatedVolume.toFixed(2));
        }
      }

      if (typeof volume === 'number' && !isNaN(den)) {
        mass = Number((volume * den).toFixed(2));
      }
    }

    const text = `ЗАМЕР РЕЗЕРВУАРА: ${selectedTank || 'Неизвестно'}\n` +
      `========================\n` +
      `Уровни (1, 2, 3): ${l1 || '-'}, ${l2 || '-'}, ${l3 || '-'}\n` +
      `Средний уровень: ${avgLevel}\n` +
      `Плотность: ${density || '-'} | Темп: ${temperature || '-'}\n` +
      `Объем: ${volume} л.\n` +
      `Масса: ${mass} кг.\n` +
      `========================`;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Параметры резервуара скопированы!', 'success');
    } catch (err) {
      showToast('Ошибка копирования. Проверьте разрешения браузера.', 'error');
    }
  };

  const handleShareTank = async () => {
    const element = document.getElementById('tank-measurement-modal');
    if (!element) return;

    try {
      await new Promise(res => setTimeout(res, 100)); // Ждем окончания рендера
      const blob = await htmlToImage.toBlob(element, {
        quality: 0.95,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff'
      });

      if (!blob) {
        showToast('Ошибка создания скриншота (пустой Blob)', 'error');
        return;
      }

      const file = new File([blob], `Tank_${selectedTank}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Замер: ${selectedTank}`
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Tank_${selectedTank}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Скриншот замера скачан на устройство!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Ошибка создания скриншота.', 'error');
    }
  };

  // Вычисляем значения для отображения "ИТОГО" на экране до сохранения (реактивно)
  const currentTanksTotalVolume = inventoryTable.reduce((sum, r) => sum + (Number(r.Volume) || 0), 0);
  const currentTanksTotalMass = inventoryTable.reduce((sum, r) => sum + (Number(r.Mass) || 0), 0);
  const currentAverageDensity = currentTanksTotalVolume > 0 ? currentTanksTotalMass / currentTanksTotalVolume : 0;
  const currentFinalTotalVolume = currentTanksTotalVolume + DYNAMIC_TOTAL_CONSTANTS;
  const currentFinalTotalMass = currentTanksTotalMass + (DYNAMIC_TOTAL_CONSTANTS * currentAverageDensity);

  const sortedTanks = [...activeTanks].sort((a, b) => a.Name.localeCompare(b.Name, undefined, { numeric: true }));

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center pt-16 pb-20 px-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-md flex flex-col items-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 mb-8 text-center">
          Инвентаризация
        </h1>

        <div className="w-full grid grid-cols-2 gap-3 mb-8">
          {sortedTanks.map(tank => {
            const isMeasured = inventoryTable.some(r => r.Tank_name === tank.Name);
            return (
              <button
                key={tank.id}
                onClick={() => handleTankClick(tank.Name)}
                className={`py-5 px-3 rounded-2xl text-lg font-bold transition-all shadow-sm active:scale-95 text-center ${isMeasured
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
              >
                {tank.Name}
                {isMeasured && <span className="block text-xs mt-1 opacity-80">(Измерен)</span>}
              </button>
            );
          })}
        </div>

        <div className="w-full bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-200 dark:border-slate-700 mb-6 flex flex-col items-center">
          <h3 className="text-slate-500 dark:text-slate-400 font-semibold mb-2">ИТОГО (Склад + ТЗА + Линии)</h3>
          <div className="flex gap-4 items-center mb-1">
            <span className="text-slate-700 dark:text-slate-300">Объем:</span>
            <span className="font-mono text-xl font-bold text-slate-900 dark:text-white">{currentFinalTotalVolume.toFixed(2)} л.</span>
          </div>
          <div className="flex gap-4 items-center">
            <span className="text-slate-700 dark:text-slate-300">Масса:</span>
            <span className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">{currentFinalTotalMass.toFixed(2)} кг.</span>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3 items-center">
          <button
            onClick={handleSaveInventoryAct}
            disabled={isSaving}
            className="w-full sm:w-64 bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold py-4 px-6 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {isSaving ? 'Сохранение...' : 'Завершить инвентаризацию'}
          </button>

          <button
            onClick={onBack}
            className="w-full py-4 mt-8 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium rounded-2xl transition-colors"
          >
            Назад
          </button>
        </div>
      </div>

      {/* Модальное окно ввода замеров */}
      {selectedTank && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen px-4 flex flex-col items-center py-8">
            <div id="tank-measurement-modal" className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-xs shadow-xl my-auto">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1 text-center">Введите данные замеров</h3>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-6 text-center">{selectedTank}</p>

              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Замер №1 в мм.</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={level1}
                    onChange={(e) => setLevel1(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                    placeholder="0000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Замер №2 в мм.</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={level2}
                    onChange={(e) => setLevel2(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                    placeholder="0000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Замер №3 в мм.</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={level3}
                    onChange={(e) => setLevel3(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                    placeholder="0000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Плотность, г/см.куб.</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={density}
                    onChange={(e) => setDensity(e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, ''))}
                    onFocus={(e) => !e.target.value && setDensity('0.')}
                    maxLength={6}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                    placeholder="0.0000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Температура, гр. Ц</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value.replace(/[^\d.,-]/g, ''))}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white transition-all font-medium"
                    placeholder="00.0"
                  />
                </div>
              </div>



              <div className="flex flex-col gap-3">
                <button
                  onClick={handleSave}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95"
                >
                  Записать
                </button>
                <button
                  onClick={() => setSelectedTank(null)}
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-4 rounded-xl transition-all shadow-sm active:scale-95"
                >
                  Отмена
                </button>

                <div className="flex justify-between gap-3 mt-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                  <button
                    onClick={handleCopyTank}
                    className="flex-1 flex justify-center items-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-3 rounded-xl text-base transition-all border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95"
                    title="Копировать замер"
                  >
                    <Copy className="w-5 h-5" />
                    <span>Копия</span>
                  </button>
                  <button
                    onClick={handleShareTank}
                    className="flex-1 flex justify-center items-center gap-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold py-3 rounded-xl text-base transition-all border border-slate-200 dark:border-slate-600 shadow-sm active:scale-95"
                    title="Скриншот замера"
                  >
                    <Share2 className="w-5 h-5" />
                    <span>Скрин</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
