import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, Droplets, Scale, Copy, Share2, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import * as htmlToImage from 'html-to-image';

interface InventoryReportProps {
  onBack: () => void;
}

export default function InventoryReport({ onBack }: InventoryReportProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('Все');

  useEffect(() => {
    fetch('/api/inventory')
      .then(res => res.json())
      .then(data => {
        setRecords(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Ошибка загрузки инвентаризаций:', err);
        setLoading(false);
      });
  }, []);

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    records.forEach(r => {
      if (r.Date) {
        const parts = r.Date.split(' ')[0].split('.');
        if (parts.length === 3) {
          months.add(`${parts[1]}.${parts[2]}`);
        } else {
          months.add(r.Date.substring(0, 7));
        }
      }
    });
    return ['Все', ...Array.from(months)];
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      if (selectedMonth === 'Все') return true;
      if (!record.Date) return false;
      const parts = record.Date.split(' ')[0].split('.');
      const recordMonth = parts.length === 3 ? `${parts[1]}.${parts[2]}` : record.Date.substring(0, 7);
      return recordMonth === selectedMonth;
    });
  }, [records, selectedMonth]);

  const toggleExpand = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleCopy = async (record: any) => {
    // Формируем красивую шапку
    let text = `Инвентаризация за: ${record.Date}\n`;
    text += `Сотрудник: ${record.Name}\n`;
    text += `====================================\n`;
    text += `ИТОГОВЫЙ ОБЪЕМ: ${Number(record.Total_Volume).toFixed(2)} л.\n`;
    text += `ИТОГОВАЯ МАССА: ${Number(record.Total_Mass).toFixed(2)} кг.\n`;
    text += `====================================\n\n`;

    // Добавляем детализацию по каждому резервуару
    if (record.Details && Array.isArray(record.Details)) {
      record.Details.forEach((tank: any) => {
        const tName = tank.Tank_Name || tank.Tank_name || 'Резервуар';
        text += `[${tName}]\n`;
        text += `Уровни (1, 2, 3): ${tank.Level_1 || '-'}, ${tank.Level_2 || '-'}, ${tank.Level_3 || '-'}\n`;
        text += `Средний уровень: ${tank.Average_Level || '-'}\n`;
        text += `Плотность: ${tank.Density || '-'} | Температура: ${tank.Temperature || '-'}\n`;
        text += `Объем: ${tank.Volume || '-'} л. | Масса: ${tank.Mass || '-'} кг.\n`;
        text += `------------------------------------\n`;
      });
    }

    // Копируем в буфер обмена
    try {
      await navigator.clipboard.writeText(text);
      alert('Текст инвентаризации успешно скопирован! Можно вставлять в документ.');
    } catch (err) {
      console.error('Ошибка копирования:', err);
      alert('Не удалось скопировать текст. Проверьте разрешения браузера.');
    }
  };

  const handleShare = async (record: any, index: number) => {
    const targetId = `inventory-card-${index}`;
    const element = document.getElementById(targetId);

    if (!element) {
      alert(`Сбой: Не найден элемент с ID: ${targetId}`);
      return;
    }

    try {
      // Небольшая пауза, чтобы убедиться, что DOM полностью отрендерен
      await new Promise(resolve => setTimeout(resolve, 100));

      // Делаем скриншот через новую библиотеку
      const blob = await htmlToImage.toBlob(element, {
        quality: 0.95,
        backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff'
      });

      if (!blob) {
        alert('Ошибка: Картинка не сгенерировалась (Blob пуст).');
        return;
      }

      const file = new File([blob], `Inventory_${record.Date}.png`, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Инвентаризация за ${record.Date}`
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Inventory_${record.Date}.png`;
        a.click();
        URL.revokeObjectURL(url);
        alert('Скриншот скачан на устройство!');
      }
    } catch (error: any) {
      alert('Ошибка генерации картинки: ' + (error.message || error));
      console.error('Сбой html-to-image:', error);
    }
  };

  const handleDownloadExcel = (record: any) => {
    const wb = XLSX.utils.book_new();

    const wsData = [
      ['Резервуар', 'Ур.1', 'Ур.2', 'Ур.3', 'Ср.Ур', 'Плотность', 'Температура', 'Объем', 'Масса']
    ];

    if (record.Details && record.Details.length > 0) {
      record.Details.forEach((d: any) => {
        wsData.push([
          d.Tank_Name || d.Tank_name || '-',
          d.Level_1 !== undefined ? d.Level_1 : '-',
          d.Level_2 !== undefined ? d.Level_2 : '-',
          d.Level_3 !== undefined ? d.Level_3 : '-',
          d.Average_Level ?? d.Level ?? '-',
          d.Density !== undefined ? Number(d.Density).toFixed(4) : '-',
          d.Temperature !== undefined ? Number(d.Temperature).toFixed(1) : '-',
          d.Volume !== undefined ? Number(d.Volume).toFixed(2) : '-',
          d.Mass !== undefined ? Number(d.Mass).toFixed(2) : '-'
        ]);
      });
    }

    wsData.push([]);
    wsData.push(['ИТОГО', '', '', '', '', '', '', Number(record.Total_Volume).toFixed(2), Number(record.Total_Mass).toFixed(2)]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wscols = [
      { wch: 15 }, // Tank Name
      { wch: 8 },  // L1
      { wch: 8 },  // L2
      { wch: 8 },  // L3
      { wch: 8 },  // Avg L
      { wch: 12 }, // Density
      { wch: 12 }, // Temp
      { wch: 15 }, // Volume
      { wch: 15 }  // Mass
    ];
    ws['!cols'] = wscols;

    XLSX.utils.book_append_sheet(wb, ws, 'Детализация');
    XLSX.writeFile(wb, `Инвентаризация_${record.Date}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col py-8 px-4 font-sans transition-colors duration-200">
      <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-center mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            Отчеты
          </h1>
        </div>

        {/* Chips */}
        {!loading && records.length > 0 && (
          <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {uniqueMonths.map(month => (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={`whitespace-nowrap flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedMonth === month
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
              >
                {month === 'Все' ? 'Все отчеты' : month}
              </button>
            ))}
          </div>
        )}

        {/* Records */}
        {!loading && filteredRecords.length > 0 ? (
          <>
            <div className="flex flex-col gap-4">
              {filteredRecords.map((record, index) => (
                <div
                  key={record.id}
                  id={`inventory-card-${index}`}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-200"
                >
                  {/* Card Header (Clickable) */}
                  <div
                    className="p-5 sm:p-6 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    onClick={() => toggleExpand(record.id)}
                  >
                    <div className="flex flex-col gap-1">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {record.Date}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Ответственный: <span className="font-medium text-slate-700 dark:text-slate-300">{record.Name}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="hidden sm:flex gap-6 text-right">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1 justify-end">
                            <Droplets className="w-3 h-3" /> Объем
                          </span>
                          <span className="text-lg font-bold font-mono text-slate-700 dark:text-slate-300">
                            {Number(record.Total_Volume).toFixed(2)} л
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1 justify-end">
                            <Scale className="w-3 h-3" /> Масса
                          </span>
                          <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {Number(record.Total_Mass).toFixed(2)} кг
                          </span>
                        </div>
                      </div>

                      <div className="flex sm:hidden gap-4 text-left mr-auto">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                            <Droplets className="w-3 h-3" /> Объем
                          </span>
                          <span className="text-sm font-bold font-mono text-slate-700 dark:text-slate-300">
                            {Number(record.Total_Volume).toFixed(2)} л
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                            <Scale className="w-3 h-3" /> Масса
                          </span>
                          <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                            {Number(record.Total_Mass).toFixed(2)} кг
                          </span>
                        </div>
                      </div>

                      <div className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full shrink-0">
                        {expandedId === record.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedId === record.id && record.Details && record.Details.length > 0 && (
                    <div className="p-5 sm:p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 px-1">
                        Детализация по резервуарам
                      </h4>

                      {/* Desktop Table View */}
                      <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                        <table className="w-full text-sm text-left">
                          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="px-4 py-3 font-semibold">Резервуар</th>
                              <th className="px-4 py-3 font-semibold text-right">Уровень</th>
                              <th className="px-4 py-3 font-semibold text-right">Плотность</th>
                              <th className="px-4 py-3 font-semibold text-right">Темп.</th>
                              <th className="px-4 py-3 font-semibold text-right">Объем</th>
                              <th className="px-4 py-3 font-semibold text-right">Масса</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {record.Details.map((detail: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                  {detail.Tank_Name || detail.Tank_name || '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                  {detail.Average_Level ?? detail.Level ?? '-'} мм
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                  {detail.Density !== undefined ? Number(detail.Density).toFixed(4) : '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-slate-600 dark:text-slate-300">
                                  {detail.Temperature !== undefined ? Number(detail.Temperature).toFixed(1) : '-'} °C
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                                  {detail.Volume !== undefined ? Number(detail.Volume).toFixed(2) : '-'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                                  {detail.Mass !== undefined ? Number(detail.Mass).toFixed(2) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile Card View */}
                      <div className="sm:hidden flex flex-col gap-3">
                        {record.Details.map((detail: any, idx: number) => (
                          <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative overflow-hidden">
                            <div className="flex justify-between items-center mb-3">
                              <span className="font-semibold text-slate-800 dark:text-slate-100">
                                {detail.Tank_Name || detail.Tank_name || 'Неизвестно'}
                              </span>
                              {detail.Temperature !== undefined && (
                                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono px-2 py-1 rounded-md">
                                  {Number(detail.Temperature).toFixed(1)} °C
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Уровень</span>
                                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                  {detail.Average_Level ?? detail.Level ?? '-'} <span className="text-[10px] text-slate-400">мм</span>
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Плотность</span>
                                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                                  {detail.Density !== undefined ? Number(detail.Density).toFixed(4) : '-'}
                                </span>
                              </div>
                              <div className="flex flex-col border-t border-slate-100 dark:border-slate-800 pt-2 mt-1">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Объем</span>
                                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                                  {detail.Volume !== undefined ? Number(detail.Volume).toFixed(2) : '-'} <span className="text-[10px] text-slate-400">л</span>
                                </span>
                              </div>
                              <div className="flex flex-col border-t border-slate-100 dark:border-slate-800 pt-2 mt-1">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Масса</span>
                                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                                  {detail.Mass !== undefined ? Number(detail.Mass).toFixed(2) : '-'} <span className="text-[10px] text-slate-400">кг</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div className="mt-6 flex flex-wrap gap-2">
                        <button
                          onClick={() => handleCopy(record)}
                          className="flex items-center justify-center gap-2 flex-grow sm:flex-grow-0 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                          Копировать
                        </button>
                        <button
                          onClick={() => handleShare(record, index)}
                          className="flex items-center justify-center gap-2 flex-grow sm:flex-grow-0 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-medium transition-colors"
                        >
                          <Share2 className="w-4 h-4" />
                          Отправить
                        </button>
                        <button
                          onClick={() => handleDownloadExcel(record)}
                          className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Скачать Excel
                        </button>
                      </div>

                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={onBack}
              className="w-full py-4 mt-8 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium rounded-2xl transition-colors"
            >
              Назад
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
