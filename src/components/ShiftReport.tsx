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

interface ShiftReportProps {
  currentWorkday: WorkdayRecord | null;
  onBack: () => void;
}

export default function ShiftReport({ currentWorkday, onBack }: ShiftReportProps) {
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [reportData, setReportData] = useState<WorkdayRecord[] | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const response = await fetch('/api/workdays');
        const data = await response.json();
        setRecords(data);
      } catch (error) {
        console.error("Ошибка при загрузке журнала смен:", error);
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
        const file = new File([blob], `Сменный_отчет.png`, { type: 'image/png' });
        await navigator.share({
          files: [file],
          title: 'Сменный отчет',
          text: `Сменный отчет`
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
    const worksheet = workbook.addWorksheet('Сменный отчет');

    // 1. Настройка колонок
    worksheet.columns = [
      { header: 'Дата', key: 'date', width: 15 },
      { header: 'Сотрудник', key: 'name', width: 25 },
      { header: 'Принято (л)', key: 'recL', width: 15 },
      { header: 'Принято (кг)', key: 'recKg', width: 15 },
      { header: 'Выдано в ТЗА (л)', key: 'tzaL', width: 20 },
      { header: 'Выдано в ТЗА (кг)', key: 'tzaKg', width: 20 },
      { header: 'Выдано в ВС (л)', key: 'vsL', width: 18 },
      { header: 'Выдано в ВС (кг)', key: 'vsKg', width: 18 },
      { header: 'Статус', key: 'status', width: 15 }
    ];

    // 2. Стилизация шапки
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // Белый текст
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF604A7B' } }; // Фиолетовый фон
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // 3. Заполнение данными
    reportData.forEach((row) => {
      const isClosed = row.Workday_Status === 'Closed';
      const statusText = isClosed ? 'Закрыта' : 'Открыта';

      const newRow = worksheet.addRow({
        date: row.Date || '',
        name: row.Name || '',
        recL: row.Fuel_Received_L ? Number(row.Fuel_Received_L) : '',
        recKg: row.Fuel_Received_KG ? Number(row.Fuel_Received_KG) : '',
        tzaL: row.Fuel_Issued_TZA_L ? Number(row.Fuel_Issued_TZA_L) : '',
        tzaKg: row.Fuel_Issued_TZA_KG ? Number(row.Fuel_Issued_TZA_KG) : '',
        vsL: row.Fuel_Issued_VS_L ? Number(row.Fuel_Issued_VS_L) : '',
        vsKg: row.Fuel_Issued_VS_KG ? Number(row.Fuel_Issued_VS_KG) : '',
        status: statusText
      });

      // Стилизация строк с данными
      newRow.eachCell((cell, colNumber) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        
        let align = 'center'; // Дата и Статус (1, 9)
        if (colNumber === 2) align = 'left'; // Сотрудник
        if (colNumber >= 3 && colNumber <= 8) align = 'right'; // Цифры
        
        cell.alignment = { horizontal: align as any, vertical: 'middle' };

        // Форматирование чисел для объемов и масс
        if (typeof cell.value === 'number') {
          cell.numFmt = '0.##'; 
        }

        // Цветовое кодирование для колонки Статус (9)
        if (colNumber === 9) {
          if (cell.value === 'Открыта') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }; // Ярко-красный
          } else if (cell.value === 'Закрыта') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } }; // Светло-зеленый
          }
        }
      });
    });

    // 4. Сохранение файла
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Сменный_отчет_${new Date().toLocaleDateString('ru-RU')}.xlsx`);
  };

  const handleCopy = () => {
    if (!reportData) return;

    let text = 'Сменный отчет\n\n';
    if (reportData.length === 0) {
      text += 'Нет данных за выбранные даты.\n';
    } else {
      reportData.forEach(row => {
        text += `Дата: ${row.Date}\n`;
        text += `Сотрудник: ${row.Name}\n`;
        text += `Принято: ${row.Fuel_Received_L} л / ${row.Fuel_Received_KG} кг\n`;
        text += `Выдано в ТЗА: ${row.Fuel_Issued_TZA_L} л / ${row.Fuel_Issued_TZA_KG} кг\n`;
        text += `Выдано в ВС: ${row.Fuel_Issued_VS_L} л / ${row.Fuel_Issued_VS_KG} кг\n`;
        text += `Статус: ${row.Workday_Status === 'Open' ? 'Открыта' : 'Закрыта'}\n`;
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
            Сменный отчет
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
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center mb-4">Сменный отчет</h3>

                <div className="space-y-6">
                  {reportData.length === 0 ? (
                    <p className="text-center text-slate-500 dark:text-slate-400 py-4">Нет данных за выбранные даты</p>
                  ) : (
                    reportData.map((row, idx) => (
                      <div key={idx} className="border-b border-slate-200 dark:border-slate-700 pb-4 last:border-0 last:pb-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{row.Date}</span>
                          <span className={`text-xs font-medium px-2 py-1 rounded-md ${row.Workday_Status === 'Open' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                            {row.Workday_Status === 'Open' ? 'Открыта' : 'Закрыта'}
                          </span>
                        </div>
                        <div className="space-y-1.5 pl-2 border-l-2 border-slate-200 dark:border-slate-700">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 dark:text-slate-400 text-xs">Сотрудник:</span>
                            <span className="font-medium text-slate-700 dark:text-slate-300 text-xs text-right max-w-[150px] truncate">{row.Name}</span>
                          </div>

                          <div className="pt-2">
                            <p className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1">Принято:</p>
                            <div className="flex justify-between items-center pl-2">
                              <span className="text-slate-500 dark:text-slate-400 text-xs">Объем / Масса:</span>
                              <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-xs">{row.Fuel_Received_L} л / {row.Fuel_Received_KG} кг</span>
                            </div>
                          </div>

                          <div className="pt-2">
                            <p className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1">Выдано в ТЗА:</p>
                            <div className="flex justify-between items-center pl-2">
                              <span className="text-slate-500 dark:text-slate-400 text-xs">Объем / Масса:</span>
                              <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-xs">{row.Fuel_Issued_TZA_L} л / {row.Fuel_Issued_TZA_KG} кг</span>
                            </div>
                          </div>

                          <div className="pt-2">
                            <p className="text-slate-800 dark:text-slate-200 font-semibold text-xs mb-1">Выдано в ВС:</p>
                            <div className="flex justify-between items-center pl-2">
                              <span className="text-slate-500 dark:text-slate-400 text-xs">Объем / Масса:</span>
                              <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-xs">{row.Fuel_Issued_VS_L} л / {row.Fuel_Issued_VS_KG} кг</span>
                            </div>
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
