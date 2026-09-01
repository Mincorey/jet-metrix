import React, { useState, useEffect, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { useToast } from '../context/ToastContext';
import { Pencil, Trash2 } from 'lucide-react';

interface TechLine {
    id: number;
    Name: string;
    Volume: number;
}

interface Tank {
    id: number;
    Name: string;
    Status: string;
    Category?: string; // 'tank' or 'train'
}

interface CalibrationRecord {
    level: number;
    volume: number;
}

export default function TanksConstructor({ onBack }: { onBack: () => void }) {
    const { showToast } = useToast();
    const [tanks, setTanks] = useState<Tank[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newCategory, setNewCategory] = useState('tank');
    const [calibrationData, setCalibrationData] = useState<CalibrationRecord[]>([]);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [isTanksExpanded, setIsTanksExpanded] = useState(false);
    const [isTrainsExpanded, setIsTrainsExpanded] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Tech Lines state
    const [techLines, setTechLines] = useState<TechLine[]>([]);
    const [isTechExpanded, setIsTechExpanded] = useState(false);
    const [showTechModal, setShowTechModal] = useState(false);
    const [editingTech, setEditingTech] = useState<TechLine | null>(null);
    const [techName, setTechName] = useState('');
    const [techVolume, setTechVolume] = useState('');
    const [techLineToDelete, setTechLineToDelete] = useState<number | null>(null);

    useEffect(() => {
        fetchTanks();
        fetchTechLines();
    }, []);

    const fetchTechLines = async () => {
        try {
            const response = await fetch('/api/tech-lines');
            if (response.ok) {
                const data = await response.json();
                setTechLines(data);
            }
        } catch (error) {
            console.error('Error fetching tech lines:', error);
        }
    };

    const fetchTanks = async () => {
        try {
            const response = await fetch('/api/tanks');
            if (response.ok) {
                const data = await response.json();
                setTanks(data);
            } else {
                console.error('Failed to fetch tanks');
            }
        } catch (error) {
            console.error('Error fetching tanks:', error);
        }
    };

    const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const data = evt.target?.result;
            if (!data) return;

            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];

            const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            const cleanData = rows
                .filter(r => r[0] != null && r[1] != null && !isNaN(Number(r[0])) && !isNaN(Number(r[1])))
                .map(r => ({ level: Number(r[0]), volume: Number(r[1]) }));

            setCalibrationData(cleanData);
        };

        reader.readAsArrayBuffer(file);
    };

    const handleSave = async () => {
        if (isSaving) return;
        if (!newName.trim() || calibrationData.length === 0) {
            showToast("Введите имя и загрузите таблицу!", "error");
            return;
        }

        setIsSaving(true);
        try {
            const response = await fetch('/api/tanks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Name: newName, Calibration: calibrationData, Category: newCategory })
            });

            if (response.ok) {
                await fetchTanks();
                setShowModal(false);
                setNewName('');
                setCalibrationData([]);
                showToast("Резервуар успешно добавлен!", "success");
            } else {
                const err = await response.json();
                console.error(err);
                showToast("Ошибка при сохранении", "error");
            }
        } catch (error) {
            console.error("Error saving tank:", error);
            showToast("Ошибка при сохранении", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveTechLine = async () => {
        if (isSaving) return;
        if (!techName.trim() || !techVolume.trim()) {
            showToast("Заполните все поля!", "error");
            return;
        }

        const volumeNum = parseFloat(techVolume.replace(',', '.'));
        if (isNaN(volumeNum)) {
            showToast("Объем должен быть числом!", "error");
            return;
        }

        setIsSaving(true);
        try {
            const url = editingTech
                ? `/api/tech-lines/${editingTech.id}`
                : '/api/tech-lines';
            const method = editingTech ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Name: techName, Volume: volumeNum })
            });

            if (response.ok) {
                await fetchTechLines();
                setShowTechModal(false);
                setTechName('');
                setTechVolume('');
                setEditingTech(null);
                showToast(editingTech ? "Тех. линия обновлена!" : "Тех. линия добавлена!", "success");
            } else {
                showToast("Ошибка при сохранении", "error");
            }
        } catch (error) {
            console.error("Error saving tech line:", error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTechLine = async () => {
        if (isSaving) return;
        if (!techLineToDelete) return;
        setIsSaving(true);
        try {
            const response = await fetch(`/api/tech-lines/${techLineToDelete}`, { method: 'DELETE' });
            if (response.ok) {
                await fetchTechLines();
                showToast("Тех. линия удалена!", "success");
            } else {
                showToast("Ошибка при удалении", "error");
            }
        } catch (error) {
            console.error("Error deleting tech line:", error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setTechLineToDelete(null);
            setIsSaving(false);
        }
    };

    const openEditTechModal = (tech: TechLine) => {
        setEditingTech(tech);
        setTechName(tech.Name);
        setTechVolume(tech.Volume.toString());
        setShowTechModal(true);
    };

    const handleToggleStatus = async (id: number, currentStatus: string) => {
        if (isSaving) return;
        const newStatus = currentStatus === 'active' ? 'archived' : 'active';
        setIsSaving(true);
        try {
            const response = await fetch(`/api/tanks/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (response.ok) {
                await fetchTanks();
            } else {
                console.error('Failed to toggle status');
            }
        } catch (error) {
            console.error('Error toggling status:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const executeClearAll = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const response = await fetch('/api/tanks/all', { method: 'DELETE' });
            if (response.ok) {
                await fetchTanks();
                setShowClearConfirm(false);
            } else {
                console.error('Failed to reset directory');
            }
        } catch (error) {
            console.error("Ошибка при очистке:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col py-8 px-4 font-sans transition-colors duration-200 pb-20">
            <div className="w-full max-w-2xl flex flex-col items-center">
                <div className="mb-8 text-center flex flex-col items-center relative w-full">
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                        Управление резервуарами (Конструктор)
                    </h1>
                </div>

                {/* storage tanks view */}
                <div className="w-full bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-6">
                    <div
                        className="flex justify-between items-center mb-4 cursor-pointer bg-slate-100 dark:bg-slate-700/50 p-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        onClick={() => setIsTanksExpanded(!isTanksExpanded)}
                    >
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Резервуары склада</h3>
                        <span className="text-slate-500">{isTanksExpanded ? '▲' : '▼'}</span>
                    </div>

                    {isTanksExpanded && (
                        <>
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => { setShowModal(true); setNewCategory('tank'); }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm active:scale-95"
                                >
                                    + Добавить резервуар
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                {tanks.filter(t => t.Category === 'tank' || !t.Category).length === 0 ? (
                                    <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">В базе данных пока нет резервуаров (РГС).</p>
                                    </div>
                                ) : (
                                    tanks.filter(t => t.Category === 'tank' || !t.Category).map((tank) => (
                                        <div key={tank.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className={`w-3 h-3 rounded-full flex-shrink-0 ${tank.Status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}
                                                ></span>
                                                <span className="font-medium text-slate-800 dark:text-slate-100">
                                                    {tank.Name}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleToggleStatus(tank.id, tank.Status)}
                                                className="text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ml-4"
                                            >
                                                {tank.Status === 'active' ? 'В архив' : 'Восстановить'}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* train tanks view */}
                <div className="w-full bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-6">
                    <div
                        className="flex justify-between items-center mb-4 cursor-pointer bg-slate-100 dark:bg-slate-700/50 p-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        onClick={() => setIsTrainsExpanded(!isTrainsExpanded)}
                    >
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Градуировочные таблицы вагонов</h3>
                        <span className="text-slate-500">{isTrainsExpanded ? '▲' : '▼'}</span>
                    </div>

                    {isTrainsExpanded && (
                        <>
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => { setShowModal(true); setNewCategory('train'); }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2.5 px-4 rounded-xl transition-all shadow-sm active:scale-95"
                                >
                                    + Добавить вагон
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                {tanks.filter(t => t.Category === 'train').length === 0 ? (
                                    <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">В базе данных пока нет таблиц вагонов.</p>
                                    </div>
                                ) : (
                                    tanks.filter(t => t.Category === 'train').map((tank) => (
                                        <div key={tank.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                                            <div className="flex items-center gap-3">
                                                <span
                                                    className={`w-3 h-3 rounded-full flex-shrink-0 ${tank.Status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}
                                                ></span>
                                                <span className="font-medium text-slate-800 dark:text-slate-100">
                                                    {tank.Name}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleToggleStatus(tank.id, tank.Status)}
                                                className="text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100 bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 ml-4"
                                            >
                                                {tank.Status === 'active' ? 'В архив' : 'Восстановить'}
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* tech lines view */}
                <div className="w-full bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm mb-6">
                    <div
                        className="flex justify-between items-center mb-4 cursor-pointer bg-slate-100 dark:bg-slate-700/50 p-3 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        onClick={() => setIsTechExpanded(!isTechExpanded)}
                    >
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Технологические линии резервуара</h3>
                        <span className="text-slate-500">{isTechExpanded ? '▲' : '▼'}</span>
                    </div>

                    {isTechExpanded && (
                        <>
                            <div className="flex justify-end mb-4">
                                <button
                                    onClick={() => { setShowTechModal(true); setEditingTech(null); setTechName(''); setTechVolume(''); }}
                                    className="w-10 h-10 flex items-center justify-center bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-xl font-light"
                                >
                                    +
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                {techLines.length === 0 ? (
                                    <div className="text-center py-8 px-4 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                                        <p className="text-slate-500 dark:text-slate-400 text-sm">В базе данных пока нет технологических линий.</p>
                                    </div>
                                ) : (
                                    techLines.map((line) => (
                                        <div key={line.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-200 dark:border-slate-600 flex-wrap gap-2">
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold text-slate-800 dark:text-slate-100">{line.Name}</span>
                                                <span className="text-sm font-medium text-slate-500 dark:text-slate-400 font-mono">
                                                    V: <span className="text-slate-700 dark:text-slate-300">{line.Volume} л.</span>
                                                </span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => openEditTechModal(line)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors flex-shrink-0"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setTechLineToDelete(line.id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors flex-shrink-0"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Очистить БД кнопка */}
                <button
                    onClick={() => setShowClearConfirm(true)}
                    className="mt-4 mb-4 px-4 py-3 bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-200 dark:hover:bg-rose-900/50 w-full max-w-xs mx-auto font-medium transition-colors flex justify-center items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    Очистить справочник
                </button>

                <button 
                    onClick={onBack}
                    className="w-full py-4 mt-8 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium rounded-2xl transition-colors"
                >
                    Назад
                </button>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
                    <div className="min-h-screen px-4 flex flex-col items-center py-8">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl my-auto">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">{newCategory === 'tank' ? 'Новый резервуар' : 'Новая ЖД-цистерна'}</h3>

                            <div className="flex flex-col gap-5">                                <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Имя {newCategory === 'train' ? 'вагона (Тип)' : 'резервуара'}
                                </label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                                    placeholder={newCategory === 'train' ? 'Например: Тип 73' : 'Например: РГС-50 №1'}
                                />
                            </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Градуировочная таблица (.xlsx, .xls)
                                    </label>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleFileUpload}
                                        className="w-full text-sm text-slate-500 dark:text-slate-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-slate-100 file:text-slate-700
                      hover:file:bg-slate-200
                      dark:file:bg-slate-700 dark:file:text-slate-200
                      dark:hover:file:bg-slate-600"
                                    />
                                    {calibrationData.length > 0 && (
                                        <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                            Загружено строк: {calibrationData.length}
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-3 mt-2">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className={`flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {isSaving ? 'Сохранение...' : 'Сохранить'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowModal(false);
                                            setNewName('');
                                            setCalibrationData([]);
                                        }}
                                        disabled={isSaving}
                                        className={`flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        Отмена
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showTechModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
                    <div className="min-h-screen px-4 flex flex-col items-center py-8">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-xl my-auto">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">
                                {editingTech ? 'Редактировать Тех. Линию' : 'Новая Тех. Линия'}
                            </h3>

                            <div className="flex flex-col gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Название
                                    </label>
                                    <input
                                        type="text"
                                        value={techName}
                                        onChange={(e) => setTechName(e.target.value)}
                                        className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                                        placeholder="Например: Труба №5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Объем (литры)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={techVolume}
                                        onChange={(e) => setTechVolume(e.target.value)}
                                        className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 font-mono [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        style={{ MozAppearance: 'textfield' }}
                                        placeholder="0.00"
                                    />
                                </div>

                                <div className="flex gap-3 mt-2">
                                    <button
                                        onClick={handleSaveTechLine}
                                        disabled={isSaving}
                                        className={`flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {isSaving ? 'Сохранение...' : 'Сохранить'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowTechModal(false);
                                            setTechName('');
                                            setTechVolume('');
                                            setEditingTech(null);
                                        }}
                                        disabled={isSaving}
                                        className={`flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        Отмена
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {techLineToDelete !== null && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl transform transition-all">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
                                <span className="text-rose-600 dark:text-rose-400 text-xl">⚠️</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Удалить тех. линию?</h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                            Вы уверены, что хотите удалить эту технологическую линию?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleDeleteTechLine}
                                disabled={isSaving}
                                className={`flex-1 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors shadow-sm active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSaving ? 'Удаление...' : 'Да, удалить'}
                            </button>
                            <button
                                onClick={() => setTechLineToDelete(null)}
                                disabled={isSaving}
                                className={`flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium py-2.5 rounded-xl transition-colors active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showClearConfirm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl transform transition-all">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
                                <span className="text-rose-600 dark:text-rose-400 text-xl">⚠️</span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Очистить базу?</h3>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
                            Вы уверены, что хотите удалить ВСЕ резервуары и вагоны? Это действие необратимо, и вам придется загружать градуировочные таблицы заново.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={executeClearAll}
                                disabled={isSaving}
                                className={`flex-1 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors shadow-sm active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {isSaving ? 'Удаление...' : 'Да, удалить всё'}
                            </button>
                            <button
                                onClick={() => setShowClearConfirm(false)}
                                disabled={isSaving}
                                className={`flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium py-2.5 rounded-xl transition-colors active:scale-95 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
