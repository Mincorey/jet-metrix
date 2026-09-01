import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Send, Plus, Trash2, Bell, BellOff } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface TelegramSettingsProps {
    onBack: () => void;
}

interface TelegramSettingsData {
    telegram_bot_name: string;
    telegram_bot_token: string;
    telegram_is_active: boolean;
    telegram_chat_ids: string[];
}

export default function TelegramSettings({ onBack }: TelegramSettingsProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    
    const [settings, setSettings] = useState<TelegramSettingsData>({
        telegram_bot_name: '',
        telegram_bot_token: '',
        telegram_is_active: false,
        telegram_chat_ids: []
    });

    const [newChatId, setNewChatId] = useState('');

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/settings/telegram');
            if (response.ok) {
                const data = await response.json();
                setSettings(data);
            } else {
                showToast("Ошибка при загрузке настроек Telegram", "error");
            }
        } catch (error) {
            console.error('Error fetching telegram settings:', error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (saving) return;
        setSaving(true);
        try {
            const response = await fetch('/api/settings/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                showToast("Настройки Telegram успешно сохранены", "success");
            } else {
                showToast("Ошибка при сохранении настроек", "error");
            }
        } catch (error) {
            console.error('Error saving telegram settings:', error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (testing) return;
        setTesting(true);
        try {
            const response = await fetch('/api/settings/telegram/test', {
                method: 'POST'
            });
            const data = await response.json();

            if (response.ok) {
                showToast(data.message, "success");
            } else {
                showToast(data.error || "Ошибка при отправке тестового сообщения", "error");
            }
        } catch (error) {
            console.error('Error testing telegram settings:', error);
            showToast("Ошибка соединения с сервером", "error");
        } finally {
            setTesting(false);
        }
    };

    const addChatId = () => {
        if (!newChatId.trim()) return;
        if (settings.telegram_chat_ids.includes(newChatId.trim())) {
            showToast("Этот ID уже есть в списке", "error");
            return;
        }
        setSettings({
            ...settings,
            telegram_chat_ids: [...settings.telegram_chat_ids, newChatId.trim()]
        });
        setNewChatId('');
    };

    const removeChatId = (id: string) => {
        setSettings({
            ...settings,
            telegram_chat_ids: settings.telegram_chat_ids.filter(item => item !== id)
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center pt-16 pb-20 px-4 font-sans transition-colors duration-200">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center relative w-full">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                        Настройки Telegram
                    </h1>
                </div>

                {loading ? (
                    <div className="text-center py-12 text-slate-500">Загрузка настроек...</div>
                ) : (
                    <div className="flex flex-col gap-6 w-full">
                        {/* Status Toggle */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${settings.telegram_is_active ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-700/50 dark:text-slate-500'}`}>
                                        {settings.telegram_is_active ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800 dark:text-slate-100">Статус уведомлений</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{settings.telegram_is_active ? 'ВКЛЮЧЕНЫ' : 'ВЫКЛЮЧЕНЫ'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSettings({ ...settings, telegram_is_active: !settings.telegram_is_active })}
                                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${settings.telegram_is_active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <span
                                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${settings.telegram_is_active ? 'translate-x-6' : 'translate-x-1'}`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Bot Configuration */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                                🤖 Конфигурация бота
                            </h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                                        Название бота
                                    </label>
                                    <input
                                        type="text"
                                        value={settings.telegram_bot_name}
                                        onChange={(e) => setSettings({ ...settings, telegram_bot_name: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                        placeholder="Например: JetMetrix_Bot"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1.5 ml-1">
                                        API-ключ (Token)
                                    </label>
                                    <input
                                        type="password"
                                        value={settings.telegram_bot_token}
                                        onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-mono"
                                        placeholder="1234567890:ABCdefGHI..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Recipients */}
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                                👥 Получатели (Chat ID)
                            </h2>

                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newChatId}
                                    onChange={(e) => setNewChatId(e.target.value.replace(/[^0-9-]/g, ''))}
                                    onKeyPress={(e) => e.key === 'Enter' && addChatId()}
                                    className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                                    placeholder="Введите Chat ID"
                                />
                                <button
                                    onClick={addChatId}
                                    className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all active:scale-95"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                                {settings.telegram_chat_ids.length === 0 ? (
                                    <div className="text-center py-4 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl">
                                        <p className="text-xs text-slate-400">Список пуст</p>
                                    </div>
                                ) : (
                                    settings.telegram_chat_ids.map(id => (
                                        <div key={id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 group">
                                            <span className="text-sm font-mono text-slate-600 dark:text-slate-300">{id}</span>
                                            <button
                                                onClick={() => removeChatId(id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={`w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-600/20 active:scale-95 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Save className="w-5 h-5" />
                                {saving ? "Сохранение..." : "Сохранить настройки"}
                            </button>

                            <button
                                onClick={handleTest}
                                disabled={testing || !settings.telegram_bot_token || settings.telegram_chat_ids.length === 0}
                                className={`w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold py-4 rounded-2xl transition-all shadow-sm active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed`}
                            >
                                <Send className="w-5 h-5" />
                                {testing ? "Отправка..." : "Отправить тестовое сообщение"}
                            </button>
                        </div>

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
    );
}
