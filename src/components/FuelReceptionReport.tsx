import React, { useState, useRef, useEffect } from 'react';
import { domToBlob } from 'modern-screenshot';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DayPicker } from 'react-day-picker';
import { format, parse } from 'date-fns';
import { ru } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';

import { WorkdayRecord } from '../data/WORKDAY';
import { FuelReceptionRecord } from '../data/Fuel_Reception';

interface FuelReceptionReportProps {
  currentWorkday: WorkdayRecord | null;
  onBack: () => void;
}

export default function FuelReceptionReport({ currentWorkday, onBack }: FuelReceptionReportProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [reportData, setReportData] = useState<FuelReceptionRecord[] | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const [res1, res2, res3] = await Promise.all([
            fetch('/api/fuel-reception'),
            fetch('/api/fuel-reception-auto'),
            fetch('/api/in-warehouse')
        ]);
        
        const data1 = res1.ok ? await res1.json() : [];
        const data2 = res2.ok ? await res2.json() : [];
        const data3 = res3.ok ? await res3.json() : [];

        // Transform transfers to look like reception records for the report
        const transfers = data3.map((t: any) => ({
          ...t,
          type: 'transfer', // ВОТ ЭТО БЫЛО ПРОПУЩЕНО
          Tank_Name: t.To_Tank, // It's reception INTO the target tank
          Gos_Number: `Перекачка из ${t.From_Tank}` 
        }));
        
        const combined = [...data1, ...data2, ...transfers];
        // Sort descending by id or Timestamp if available
        combined.sort((a, b) => b.id - a.id);
        
        setRecords(combined);
      } catch (error) {
        console.error("Ошибка при загрузке журнала приема:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecords();
  }, []);

  const handleGenerateReport = () => {
    if (selectedDates.length === 0) {
      alert('Выберите хотя бы одну дату');
      return;
    }

    // Convert selected dates to strings in format "dd.MM.yyyy"
    const selectedDateStrings = selectedDates.map(date => format(date, 'dd.MM.yyyy'));

    // Filter records from the server response
    const filteredRecords = records.filter(record => {
      // Record Date might be "dd.MM.yyyy" or "dd.MM.yyyy HH:mm"
      const recordDateOnly = record.Date ? record.Date.split(' ')[0] : '';
      return selectedDateStrings.includes(recordDateOnly);
    });

    setReportData(filteredRecords);
  };

  const handleShare = async () => {
    if (!resultRef.current) return;
    try {
      const blob = await domToBlob(resultRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
      });

      if (blob && navigator.share) {
        const file = new File([blob], `Отчет_по_приему_топлива.png`, { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: 'Отчет по приему топлива',
          text: `Отчет по приему топлива`
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
    const worksheet = workbook.addWorksheet('Отчет по приему');

    // 1. Настройка колонок
    worksheet.columns = [
      { header: 'Дата', key: 'date', width: 18 },
      { header: 'Сотрудник', key: 'name', width: 25 },
      { header: 'Из резервуара', key: 'fromTank', width: 20 },
      { header: 'В резервуар', key: 'toTank', width: 20 },
      { header: 'Счетчик ДО', key: 'counterBefore', width: 15 },
      { header: 'Счетчик ПОСЛЕ', key: 'counterAfter', width: 15 },
      { header: 'Плотность', key: 'density', width: 15 },
      { header: 'Температура', key: 'temperature', width: 15 },
      { header: 'Объем (л)', key: 'volume', width: 15 },
      { header: 'Масса (кг)', key: 'mass', width: 15 }
    ];

    // 2. Стилизация шапки
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    let totalVolume = 0;
    let totalMass = 0;

    // 3. Заполнение данными
    reportData.forEach((row: any) => {
      const vol = row.Volume ? Number(row.Volume) : 0;
      const mass = row.Mass ? Number(row.Mass) : 0;
      totalVolume += vol;
      totalMass += mass;

      const isTransfer = row.type === 'transfer';
      const fromLocation = isTransfer ? row.From_Tank : '';

      const newRow = worksheet.addRow({
        date: row.Date || '',
        name: row.Name || '',
        fromTank: fromLocation,
        toTank: isTransfer ? row.To_Tank : row.Tank_Name,
        counterBefore: row.Counter_Before || '-',
        counterAfter: row.Counter_After || '-',
        density: row.Density || '-',
        temperature: row.Temperature || '-',
        volume: vol,
        mass: mass
      });

      newRow.eachCell((cell, colNumber) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        let align: any = 'left';
        if (colNumber === 1) align = 'center';
        if (colNumber >= 5) align = 'right';
        cell.alignment = { horizontal: align, vertical: 'middle' };

        if (colNumber >= 5 && typeof cell.value === 'number') {
           cell.numFmt = '#,##0.00';
        }
      });
    });

    // 4. Добавление строки "Итого"
    const totalRow = worksheet.addRow(['', '', '', '', '', '', '', 'ИТОГО:', totalVolume, totalMass]);
    totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    // Стилизуем ячейки ИТОГО (последние 3 ячейки)
    totalRow.eachCell((cell, colNumber) => {
      if (colNumber >= 8) { // Исправлено с 9 на 8
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } }; // Темно-синий
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (colNumber > 8) cell.numFmt = '#,##0.00'; // Исправлено с 9 на 8
      }
    });

    // 5. Сохранение
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Отчет_по_приему_${new Date().toLocaleDateString('ru-RU')}.xlsx`);
  };

  const handleCopy = () => {
    if (!reportData) return;

    let text = 'Отчет по приему топлива\n\n';
    if (reportData.length === 0) {
      text += 'Нет данных за выбранные даты.\n';
    } else {
      reportData.forEach(row => {
        text += `Дата: ${row.Date}\n`;
        text += `Сотрудник: ${row.Name}\n`;
        text += `Резервуар: ${row.Tank_Name}\n`;
        text += `Плотность: ${row.Density} г/см³\n`;
        text += `Объем: ${row.Volume} л.\n`;
        text += `Масса: ${row.Mass} кг.\n`;
        text += `------------------------\n`;
      });
    }

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
            Отчет по приему топлива
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Выберите дату или несколько дат
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6 flex justify-center">
          <DayPicker
            mode="multiple"
            selected={selectedDates}
            onSelect={(dates) => setSelectedDates(dates as Date[])}
            locale={ru}
            modifiersClassNames={{
              selected: 'bg-indigo-600 text-white rounded-full',
              today: 'font-bold text-indigo-600 dark:text-indigo-400'
            }}
            className="font-sans dark:text-slate-200"
          />
        </div>

        {loading ? (
          <div className="text-center py-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 mb-6">
            <p className="text-slate-500 dark:text-slate-400 font-medium">Загрузка данных с Сервера...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
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

      {/* Модальное окно результатов */}
      {reportData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
          <div className="min-h-screen px-4 flex flex-col items-center py-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl text-left my-auto">

              {/* Блок для скриншота */}
              <div ref={resultRef} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center mb-6">Отчет по приему топлива</h3>

                {reportData.length === 0 ? (
                  <p className="text-center text-slate-500 dark:text-slate-400 py-8">Нет данных за выбранные даты</p>
                ) : (
                  <div className="space-y-4">
                    {reportData.map((record: any) => (
                      <div key={record.id} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-3 mb-3">
                          <span className="font-bold text-slate-800 dark:text-slate-100">{record.Date}</span>
                          <span className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700">
                            {record.type === 'transfer' ? `Перекачка: ${record.From_Tank} ➔ ${record.To_Tank}` : record.Tank_Name}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Сотрудник:</span> 
                            <span className="font-medium text-slate-800 dark:text-slate-200">{record.Name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Плотность:</span> 
                            <span className="font-mono text-slate-800 dark:text-slate-200">{record.Density} г/см³</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Температура:</span> 
                            <span className="font-mono text-slate-800 dark:text-slate-200">{record.Temperature} °C</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500 font-medium">Объем:</span> 
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{record.Volume} л</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                            <span className="font-bold text-slate-800 dark:text-slate-200">МАССА:</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">{record.Mass} кг</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleShare}
                  disabled={reportData.length === 0}
                  className="bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  Отправить
                </button>
                <button
                  onClick={handleExportExcel}
                  disabled={reportData.length === 0}
                  className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  Скачать
                </button>
                <button
                  onClick={handleCopy}
                  disabled={reportData.length === 0}
                  className={`${copied ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'} text-sm font-medium py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50`}
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
