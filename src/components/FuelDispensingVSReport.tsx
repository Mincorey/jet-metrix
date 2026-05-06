import React, { useState, useRef, useEffect } from 'react';
import { domToBlob } from 'modern-screenshot';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';

import { WorkdayRecord } from '../data/WORKDAY';
import { FuelDispensingVSRecord } from '../data/Fuel_Dispensing_VS';

interface FuelDispensingVSReportProps {
  currentWorkday: WorkdayRecord | null;
  onBack: () => void;
}

export default function FuelDispensingVSReport({ currentWorkday, onBack }: FuelDispensingVSReportProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [reportData, setReportData] = useState<FuelDispensingVSRecord[] | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const response = await fetch('/api/fuel-dispensing-vs');
        const data = await response.json();
        setRecords(data);
      } catch (error) {
        console.error("Ошибка при загрузке журнала ВС:", error);
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
      // Record Date is in "dd.MM.yyyy" format
      return selectedDateStrings.includes(record.Date);
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
        const file = new File([blob], `Отчет_по_выдаче_в_ВС.png`, { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: 'Отчет по выдаче в ВС',
          text: `Отчет по выдаче в ВС`
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
    const worksheet = workbook.addWorksheet('Выдача в ВС');

    // 1. Настройка колонок (всего 9 колонок)
    worksheet.columns = [
      { header: 'Дата', key: 'date', width: 15 },
      { header: 'Сотрудник', key: 'name', width: 25 },
      { header: 'ТЗА', key: 'tza', width: 15 },
      { header: 'Контрольный талон', key: 'controlNum', width: 20 },
      { header: '№ паспорта', key: 'passportNum', width: 15 },
      { header: 'Дата паспорта', key: 'passportDate', width: 15 },
      { header: 'Плотность (г/см³)', key: 'density', width: 20 },
      { header: 'Объем (л)', key: 'volume', width: 18 },
      { header: 'Масса (кг)', key: 'mass', width: 18 }
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
    reportData.forEach((row) => {
      const vol = row.Volume ? Number(row.Volume) : 0;
      const mass = row.Mass ? Number(row.Mass) : 0;
      totalVolume += vol;
      totalMass += mass;

      const newRow = worksheet.addRow({
        date: row.Date || '',
        name: row.Name || '',
        tza: row.TZA || '-',
        controlNum: row.Control_Number || '-',
        passportNum: row.Passport_Number || '-',
        passportDate: row.Passport_Date || '-',
        density: row.Density ? Number(row.Density) : '-',
        volume: vol,
        mass: mass
      });

      // Стилизация строк с данными
      newRow.eachCell((cell, colNumber) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        let align = 'center'; // Дата (1 колонка)
        if (colNumber >= 2 && colNumber <= 6) align = 'left'; // Сотрудник, ТЗА, Талон, № паспорта, Дата паспорта
        if (colNumber >= 7) align = 'right'; // Плотность, Объем, Масса
        
        cell.alignment = { horizontal: align as any, vertical: 'middle' };

        // Разное форматирование чисел
        if (typeof cell.value === 'number') {
          if (colNumber === 7) cell.numFmt = '0.0000'; // Плотность
          else if (colNumber >= 8) cell.numFmt = '#,##0.00'; // Объем и масса
        }
      });
    });

    // 4. Добавление строки "Итого"
    const totalRow = worksheet.addRow({
      date: '', name: '', tza: '', controlNum: '', passportNum: '', passportDate: '',
      density: 'ИТОГО:',
      volume: totalVolume,
      mass: totalMass
    });

    totalRow.font = { bold: true };
    totalRow.eachCell((cell, colNumber) => {
      if (colNumber >= 7) { // Начинаем заливку с колонки Плотности (7)
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
        if (colNumber >= 8) cell.numFmt = '#,##0.00';
      }
    });

    // 5. Сохранение
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Отчет_по_выдаче_в_ВС_${new Date().toLocaleDateString('ru-RU')}.xlsx`);
  };

  const handleCopy = () => {
    if (!reportData) return;

    let text = 'Отчет по выдаче в ВС\n\n';
    if (reportData.length === 0) {
      text += 'Нет данных за выбранные даты.\n';
    } else {
      reportData.forEach(row => {
        text += `Дата: ${row.Date}\n`;
        text += `Сотрудник: ${row.Name}\n`;
        text += `ТЗА: ${row.TZA}\n`;
        text += `Контрольный талон: ${row.Control_Number}\n`;
        if (row.Passport_Number) {
          text += `Паспорт: № ${row.Passport_Number} от ${row.Passport_Date}\n`;
        }
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
            Отчет по выдаче в ВС
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
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center mb-4">Отчет по выдаче в ВС</h3>

                <div className="space-y-6">
                  {reportData.length === 0 ? (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-4">Нет данных за выбранные даты</p>
                  ) : (
                    reportData.map((row, idx) => (
                      <div key={idx} className="border-b border-slate-200 dark:border-slate-700 pb-4 last:border-0 last:pb-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{row.Date}</span>
                          <span className="text-xs font-medium bg-sky-50 text-sky-700 px-2 py-1 rounded-md">ТЗА {row.TZA}</span>
                        </div>
                        <div className="space-y-1.5 pl-2 border-l-2 border-sky-100">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400 text-xs">Сотрудник:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 text-xs text-right max-w-[150px] truncate">{row.Name}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400 text-xs">Контрольный талон:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">{row.Control_Number}</span>
                          </div>
                          {(row.Passport_Number || row.Passport_Date) && (
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-slate-500 dark:text-slate-400 text-xs">Паспорт:</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300 text-xs text-right max-w-[150px] truncate leading-tight">№ {row.Passport_Number} <br />от {row.Passport_Date}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-slate-500 dark:text-slate-400 text-xs">Плотность:</span>
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-xs">{row.Density} г/см³</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400 text-xs">Объем:</span>
                            <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-xs">{row.Volume} л.</span>
                          </div>
                          <div className="flex justify-between items-center pt-1">
                            <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">Масса:</span>
                            <span className="font-mono font-bold text-[#059669] text-sm">{row.Mass} кг.</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
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
