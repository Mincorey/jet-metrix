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

interface TrainRecord {
    id: number;
    Date: string;
    Name: string;
    Number: string;
    Type: string;
    Level_1: number;
    Level_2: number;
    Level_3: number;
    Average_Level: number;
    Density: number;
    Temperature: number;
    Volume: number;
    Mass: number;
    Density_20?: number | null;
}

interface TrainMeasurementReportProps {
    currentWorkday: WorkdayRecord | null;
    onBack: () => void;
}

export default function TrainMeasurementReport({ currentWorkday, onBack }: TrainMeasurementReportProps) {
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [reportData, setReportData] = useState<TrainRecord[] | null>(null);
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const resultRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchRecords = async () => {
            try {
                const response = await fetch('/api/train-report');
                const data = await response.json();
                setRecords(data);
            } catch (error) {
                console.error("Ошибка при загрузке журнала ЖД-цистерн:", error);
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

        const selectedDateStrings = selectedDates.map(date => format(date, 'dd.MM.yyyy'));

        const filteredRecords = records.filter(record => {
            // Игнорируем время, берем только дату "dd.MM.yyyy" из строки "dd.MM.yyyy HH:mm:ss"
            const datePart = record.Date.split(' ')[0];
            return selectedDateStrings.includes(datePart);
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
                const file = new File([blob], `Отчет_по_ЖДЦ.png`, { type: 'image/png' });
                await navigator.share({
                    files: [file],
                    title: 'Отчет по ЖД-цистернам',
                    text: `Отчет по ЖД-цистернам`
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
        const worksheet = workbook.addWorksheet('Отчет по ЖДЦ');

        // 1. Настройка колонок
        worksheet.columns = [
            { header: 'Дата', key: 'date', width: 15 },
            { header: 'Сотрудник', key: 'name', width: 25 },
            { header: '№ вагона', key: 'wagonNum', width: 15 },
            { header: 'Тип', key: 'type', width: 10 },
            { header: 'Замер (мм)', key: 'level', width: 15 },
            { header: 'Плотность (г/см³)', key: 'density', width: 20 },
            { header: 'Темп. (°C)', key: 'temp', width: 15 },
            { header: 'Пл. при 20° (кг/м³)', key: 'density20', width: 22 },
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
                wagonNum: row.Number || '-',
                type: row.Type || '-',
                level: row.Average_Level || '-',
                density: row.Density ? Number(row.Density) : '-',
                temp: row.Temperature ? Number(row.Temperature) : '-',
                density20: row.Density_20 != null ? Number(row.Density_20) : '-',
                volume: vol,
                mass: mass
            });

            // Стилизация строк с данными
            newRow.eachCell((cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                
                let align = 'center'; // Дата (1)
                if (colNumber >= 2 && colNumber <= 4) align = 'left'; // Сотрудник, № вагона, Тип (2, 3, 4)
                if (colNumber >= 5) align = 'right'; // Замер, Плотность, Темп, Объем, Масса (5+)
                
                cell.alignment = { horizontal: align as any, vertical: 'middle' };

                // Форматирование чисел
                if (typeof cell.value === 'number') {
                    if (colNumber === 6) cell.numFmt = '0.0000'; // Плотность
                    else if (colNumber === 7) cell.numFmt = '0.0'; // Температура
                    else if (colNumber === 8) cell.numFmt = '0.0'; // Плотность при 20°
                    else if (colNumber >= 9) cell.numFmt = '#,##0.00'; // Объем и масса
                }
            });
        });

        // 4. Добавление строки "Итого"
        const totalRow = worksheet.addRow({
            date: '', name: '', wagonNum: '', type: '', level: '', density: '',
            temp: 'ИТОГО:',
            volume: totalVolume,
            mass: totalMass
        });

        totalRow.font = { bold: true };
        totalRow.eachCell((cell, colNumber) => {
            if (colNumber >= 7) { // Начинаем заливку с колонки Темп (7)
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF5B9BD5' } };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                if (colNumber >= 9) cell.numFmt = '#,##0.00';
            }
        });

        // 5. Сохранение
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Отчет_по_ЖДЦ_${new Date().toLocaleDateString('ru-RU')}.xlsx`);
    };

    const handleCopy = () => {
        if (!reportData) return;

        let text = 'Отчет по ЖД-цистернам\n\n';
        let totalVolume = 0;
        let totalMass = 0;

        if (reportData.length === 0) {
            text += 'Нет данных за выбранные даты.\n';
        } else {
            reportData.forEach(row => {
                text += `Дата: ${row.Date}\n`;
                text += `Сотрудник: ${row.Name}\n`;
                text += `№ вагона: ${row.Number}\n`;
                text += `Тип: ${row.Type}\n`;
                text += `Замер: ${row.Average_Level} мм\n`;
                text += `Плотность: ${row.Density} г/см³\n`;
                text += `Температура: ${row.Temperature} °C\n`;
                text += `Плотность при 20°С: ${row.Density_20 != null ? row.Density_20 + ' кг/м³' : 'н/д'}\n`;
                text += `Объем: ${row.Volume} л.\n`;
                text += `Масса: ${row.Mass} кг.\n`;
                text += `------------------------\n`;

                totalVolume += row.Volume || 0;
                totalMass += row.Mass || 0;
            });

            text += `ИТОГО:\n`;
            text += `Объем: ${totalVolume} л.\n`;
            text += `Масса: ${totalMass} кг.\n`;
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
                        Отчет по ЖД-цистернам
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

            {reportData && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
                    <div className="min-h-screen px-4 flex flex-col items-center py-8">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl text-left my-auto">

                            <div ref={resultRef} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 text-center mb-4">Отчет по ЖД-цистернам</h3>

                                <div className="space-y-6">
                                    {reportData.length === 0 ? (
                                        <p className="text-center text-slate-500 dark:text-slate-400 py-4">Нет данных за выбранные даты</p>
                                    ) : (
                                        reportData.map((row, idx) => (
                                            <div key={idx} className="border-b border-slate-200 dark:border-slate-700 pb-4 last:border-0 last:pb-0">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{row.Date.split(' ')[0]}</span>
                                                    <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md">№ {row.Number}</span>
                                                </div>
                                                <div className="space-y-1.5 pl-2 border-l-2 border-indigo-100">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400 text-xs">Сотрудник:</span>
                                                        <span className="font-medium text-slate-700 dark:text-slate-300 text-xs text-right max-w-[150px] truncate">{row.Name}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400 text-xs">Тип:</span>
                                                        <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">{row.Type}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400 text-xs">Замер:</span>
                                                        <span className="font-medium text-slate-700 dark:text-slate-300 text-xs">{row.Average_Level} мм</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400 text-xs">Плотность / Темп.:</span>
                                                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-xs">{row.Density} г/см³ / {row.Temperature}°C</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-slate-500 dark:text-slate-400 text-xs">Плотность при 20°С:</span>
                                                        <span className="font-mono font-medium text-slate-700 dark:text-slate-300 text-xs">{row.Density_20 != null ? `${row.Density_20} кг/м³` : '—'}</span>
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
                                    {reportData.length > 0 && (
                                        <div className="pt-4 border-t-2 border-slate-800 dark:border-slate-100">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-slate-800 dark:text-slate-200">ИТОГО:</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500 dark:text-slate-400 text-sm">Объем:</span>
                                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{reportData.reduce((acc, row) => acc + (row.Volume || 0), 0)} л.</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-500 dark:text-slate-400 text-sm">Масса:</span>
                                                <span className="font-mono font-bold text-[#059669] text-base">{reportData.reduce((acc, row) => acc + (row.Mass || 0), 0)} кг.</span>
                                            </div>
                                        </div>
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
