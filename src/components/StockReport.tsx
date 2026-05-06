import React, { useState, useRef, useEffect } from 'react';
import { domToBlob } from 'modern-screenshot';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { WorkdayRecord } from '../data/WORKDAY';

const RGS_50_TANKS = [
  'РГС-50 №1', 'РГС-50 №2', 'РГС-50 №3', 'РГС-50 №4',
  'РГС-50 №5', 'РГС-50 №6', 'РГС-50 №7', 'РГС-50 №8'
];

const RGS_100_TANKS = [
  'РГС-100 №1', 'РГС-100 №2', 'РГС-100 №3', 'РГС-100 №4'
];


interface StockReportProps {
  currentWorkday: WorkdayRecord | null;
  onBack: () => void;
}

interface ReportData {
  Tank_Name: string;
  Date: string;
  Average_Level: number | string;
  Density: number | string;
  Temperature: number | string;
  Volume: number | string;
  Mass: number | string;
}

export default function StockReport({ currentWorkday, onBack }: StockReportProps) {
  const [selectionMode, setSelectionMode] = useState<'none' | 'all' | 'all-rgs50' | 'all-rgs100' | 'custom'>('none');
  const [selectedTanks, setSelectedTanks] = useState<string[]>([]);
  const [reportData, setReportData] = useState<ReportData[] | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const response = await fetch('/api/stock');
        const data = await response.json();
        setRecords(data);
      } catch (error) {
        console.error("Ошибка при загрузке остатков:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, []);

  const handleAllClick = () => {
    if (selectionMode === 'all') {
      setSelectionMode('none');
      setSelectedTanks([]);
    } else {
      setSelectionMode('all');
      setSelectedTanks([...RGS_50_TANKS, ...RGS_100_TANKS]);
    }
  };

  const handleAllRGS50Click = () => {
    if (selectionMode === 'all-rgs50') {
      setSelectionMode('none');
      setSelectedTanks([]);
    } else {
      setSelectionMode('all-rgs50');
      setSelectedTanks([...RGS_50_TANKS]);
    }
  };

  const handleAllRGS100Click = () => {
    if (selectionMode === 'all-rgs100') {
      setSelectionMode('none');
      setSelectedTanks([]);
    } else {
      setSelectionMode('all-rgs100');
      setSelectedTanks([...RGS_100_TANKS]);
    }
  };

  const handleTankClick = (tank: string) => {
    if (selectionMode === 'all' || selectionMode === 'all-rgs50' || selectionMode === 'all-rgs100') return;

    let newSelected = [...selectedTanks];
    if (newSelected.includes(tank)) {
      newSelected = newSelected.filter(t => t !== tank);
    } else {
      newSelected.push(tank);
    }

    setSelectedTanks(newSelected);
    setSelectionMode(newSelected.length > 0 ? 'custom' : 'none');
  };

  const handleGenerateReport = () => {
    if (selectedTanks.length === 0) {
      alert('Выберите хотя бы один резервуар');
      return;
    }

    const data: ReportData[] = selectedTanks.map(tank => {
      const serverRecord = records.find(r => r.Tank_Name === tank);

      if (serverRecord) {
        return {
          Tank_Name: tank,
          Date: serverRecord.Date,
          Average_Level: serverRecord.Average_Level ?? '-',
          Density: serverRecord.Density,
          Temperature: serverRecord.Temperature ?? '-',
          Volume: serverRecord.Volume,
          Mass: serverRecord.Mass
        };
      } else {
        return {
          Tank_Name: tank,
          Date: 'Нет данных',
          Average_Level: '-',
          Density: '-',
          Temperature: '-',
          Volume: '-',
          Mass: '-'
        };
      }
    });

    setReportData(data);
  };

  const handleShare = async () => {
    if (!resultRef.current) return;
    try {
      const blob = await domToBlob(resultRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      if (blob && navigator.share) {
        const file = new File([blob], `Остатки_на_складе.png`, { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: 'Остатки на складе',
          text: `Отчет по остаткам на складе`
        });
      } else {
        alert('Функция "Поделиться" не поддерживается');
      }
    } catch (err) {
      console.error('Share error:', err);
      alert('Ошибка при подготовке изображения');
    }
  };

  const handleExportExcel = async () => {
    if (!reportData) return;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Остатки на складе');

    // 1. Настройка ширины и названий колонок
    worksheet.columns = [
      { header: 'Дата', key: 'date', width: 15 },
      { header: 'Номер резервуара', key: 'tankName', width: 20 },
      { header: 'Средний уровень (мм)', key: 'level', width: 25 },
      { header: 'Плотность (г/см³)', key: 'density', width: 20 },
      { header: 'Температура (°C)', key: 'temp', width: 20 },
      { header: 'Объем (л)', key: 'volume', width: 18 },
      { header: 'Масса (кг)', key: 'mass', width: 18 }
    ];

    // 2. Стилизация шапки (светло-голубой фон, жирный шрифт, центрирование, границы)
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFBDD7EE' } 
      };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    let totalVolume = 0;
    let totalMass = 0;

    // 3. Заполнение данными
    reportData.forEach((row) => {
      // Подстраиваемся под ключи БД из server.cjs
      const rowData = {
        date: row.Date || 'Нет данных',
        tankName: row.Tank_Name || '',
        level: row.Average_Level !== '-' ? Number(row.Average_Level) : '-',
        density: row.Density !== '-' ? Number(row.Density) : '-',
        temp: row.Temperature !== '-' ? Number(row.Temperature) : '-',
        volume: row.Volume !== '-' ? Number(row.Volume) : '-',
        mass: row.Mass !== '-' ? Number(row.Mass) : '-'
      };

      if (row.Volume !== '-') totalVolume += Number(row.Volume);
      if (row.Mass !== '-') totalMass += Number(row.Mass);

      const newRow = worksheet.addRow(rowData);

      // Стилизация строк с данными (границы, выравнивание, формат чисел)
      newRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        
        cell.alignment = { 
          horizontal: colNumber <= 2 ? 'center' : 'right', 
          vertical: 'middle' 
        };

        // Дроби для объемов и массы
        if (colNumber === 6 || colNumber === 7) {
          if (typeof cell.value === 'number') cell.numFmt = '#,##0.00';
        }
      });
    });

    // 4. Добавление строки "Итого"
    const totalRow = worksheet.addRow({
      date: '',
      tankName: '',
      level: '',
      density: '',
      temp: 'Итого:',
      volume: totalVolume,
      mass: totalMass
    });

    totalRow.font = { bold: true };
    totalRow.eachCell((cell, colNumber) => {
      if (colNumber >= 5) { 
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF5B9BD5' } // Темно-синий фон для итогов
        };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (colNumber > 5) cell.numFmt = '#,##0.00';
      }
    });

    // 5. Сохранение файла
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Остатки_на_складе_${new Date().toLocaleDateString('ru-RU')}.xlsx`);
  };

  const handleCopy = () => {
    if (!reportData) return;

    let text = 'Остатки на складе\n\n';
    reportData.forEach(row => {
      text += `Резервуар: ${row.Tank_Name}\n`;
      text += `Дата: ${row.Date}\n`;
      text += `Уровень: ${row.Average_Level} мм\n`;
      text += `Плотность: ${row.Density} г/см³\n`;
      text += `Температура: ${row.Temperature} °C\n`;
      text += `Объем: ${row.Volume} л.\n`;
      text += `Масса: ${row.Mass} кг.\n\n`;
    });

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center pt-12 pb-20 px-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100 mb-2">
            Остатки на складе
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Выбор резервуаров
          </p>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-3">
            <button
              onClick={handleAllClick}
              disabled={selectionMode === 'all-rgs50' || selectionMode === 'all-rgs100' || selectionMode === 'custom'}
              className={`py-3 px-4 rounded-xl text-sm font-medium transition-all shadow-sm ${selectionMode === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
            >
              По всем резервуарам
            </button>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleAllRGS50Click}
                disabled={selectionMode === 'all' || selectionMode === 'all-rgs100' || selectionMode === 'custom'}
                className={`py-3 px-4 rounded-xl text-sm font-medium transition-all shadow-sm ${selectionMode === 'all-rgs50'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
              >
                По всем РГС-50
              </button>
              <button
                onClick={handleAllRGS100Click}
                disabled={selectionMode === 'all' || selectionMode === 'all-rgs50' || selectionMode === 'custom'}
                className={`py-3 px-4 rounded-xl text-sm font-medium transition-all shadow-sm ${selectionMode === 'all-rgs100'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
              >
                По всем РГС-100
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-1">РГС-50</h3>
            <div className="grid grid-cols-2 gap-3">
              {RGS_50_TANKS.map(tank => (
                <button
                  key={tank}
                  onClick={() => handleTankClick(tank)}
                  disabled={selectionMode === 'all' || selectionMode === 'all-rgs50' || selectionMode === 'all-rgs100'}
                  className={`py-3 px-4 rounded-xl text-sm font-medium transition-all shadow-sm ${selectedTanks.includes(tank) && selectionMode === 'custom'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                >
                  {tank}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 px-1">РГС-100</h3>
            <div className="grid grid-cols-2 gap-3">
              {RGS_100_TANKS.map(tank => (
                <button
                  key={tank}
                  onClick={() => handleTankClick(tank)}
                  disabled={selectionMode === 'all' || selectionMode === 'all-rgs50' || selectionMode === 'all-rgs100'}
                  className={`py-3 px-4 rounded-xl text-sm font-medium transition-all shadow-sm ${selectedTanks.includes(tank) && selectionMode === 'custom'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                >
                  {tank}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mt-6">
              <p className="text-slate-500 dark:text-slate-400 font-medium">Загрузка данных с Сервера...</p>
            </div>
          ) : (
            <div className="pt-4 flex flex-col gap-3">
              <button
                onClick={handleGenerateReport}
                className="w-full bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition-all shadow-md active:scale-[0.98]"
              >
                Сформировать отчет
              </button>
              <button
                onClick={onBack}
                className="w-full py-4 mt-8 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium rounded-2xl transition-colors"
              >
                Назад
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно результатов */}
      {reportData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen px-4 flex flex-col items-center py-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl text-left my-auto">

              {/* Блок для скриншота */}
              <div ref={resultRef} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center mb-4">Остатки на складе</h3>

                <div className="space-y-6">
                  {reportData.map((row, idx) => (
                    <div key={idx} className="border-b border-slate-200 dark:border-slate-700 pb-4 last:border-0 last:pb-0">
                      <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-xl mb-3">{row.Tank_Name}</h4>
                      {row.Date === 'Нет данных' ? (
                        <p className="text-base text-slate-500 dark:text-slate-400 pl-2">Нет данных о замерах</p>
                      ) : (
                        <div className="space-y-2 pl-2 border-l-2 border-indigo-100 dark:border-slate-700">
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-500 dark:text-slate-400 text-base">Дата:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 text-base">{row.Date}</span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-500 dark:text-slate-400 text-base">Уровень:</span>
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-base">{row.Average_Level} {row.Average_Level !== '-' && 'мм'}</span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-500 dark:text-slate-400 text-base">Плотность:</span>
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-base">{row.Density} {row.Density !== '-' && 'г/см³'}</span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-500 dark:text-slate-400 text-base">Температура:</span>
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-base">{row.Temperature} {row.Temperature !== '-' && '°C'}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 bg-slate-50 dark:bg-slate-800/50 rounded px-1 -mx-1">
                            <span className="text-slate-500 dark:text-slate-400 text-base font-semibold">Объем:</span>
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-lg">{row.Volume} {row.Volume !== '-' && 'л.'}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 bg-slate-50 dark:bg-slate-800/50 rounded px-1 -mx-1">
                            <span className="text-slate-500 dark:text-slate-400 font-semibold text-base">Масса:</span>
                            <span className="font-mono font-bold text-[#059669] text-lg">{row.Mass} {row.Mass !== '-' && 'кг.'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleShare}
                  className="bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  Отправить
                </button>
                <button
                  onClick={handleExportExcel}
                  className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  Скачать
                </button>
                <button
                  onClick={handleCopy}
                  className={`${copied ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'} text-sm font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2`}
                >
                  {copied ? 'Скопировано!' : 'Копировать'}
                </button>
                <button
                  onClick={() => setReportData(null)}
                  className="bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  Назад
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
