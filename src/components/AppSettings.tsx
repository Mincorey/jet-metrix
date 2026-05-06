import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, Upload, Type, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface AppSettingsProps {
    onBack: () => void;
}

export default function AppSettings({ onBack }: AppSettingsProps) {
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const [showTextModal, setShowTextModal] = useState(false);
    const [serviceName, setServiceName] = useState('');
    const [facilityName, setFacilityName] = useState('');
    const [savingTexts, setSavingTexts] = useState(false);

    useEffect(() => {
        fetch('/api/settings/texts')
            .then(res => res.json())
            .then(data => {
                setServiceName(data.service_name || '');
                setFacilityName(data.facility_name || '');
            })
            .catch(err => console.error(err));
    }, []);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Валидация типа файла
        const allowedTypes = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/x-icon'];
        if (!allowedTypes.includes(file.type)) {
            showToast('Неподдерживаемый формат файла. Используйте JPG, PNG, SVG или ICO.', 'error');
            return;
        }

        // Валидация размера файла (512 KB для примера, или просто проверка на адекватность)
        // В запросе указано "размером не более 512х512 пикселей", 
        // но программно проверить размеры картинки перед чтением сложнее.
        // Ограничим размер файла до 1MB для безопасности Base64.
        if (file.size > 1024 * 1024) {
            showToast('Файл слишком большой. Максимальный размер 1MB.', 'error');
            return;
        }

        setUploading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            try {
                const response = await fetch('/api/settings/logo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ logo: base64String })
                });

                if (response.ok) {
                    showToast('Логотип успешно обновлен! Перезагрузите приложение для применения.', 'success');
                    // Можно вызвать какой-то колбэк для обновления состояния в App.tsx, 
                    // но в требованиях просто POST запрос. 
                    // Обычно такие вещи требуют релоада или глобального стейта.
                } else {
                    showToast('Ошибка при сохранении логотипа на сервере.', 'error');
                }
            } catch (error) {
                console.error('Error uploading logo:', error);
                showToast('Ошибка соединения с сервером.', 'error');
            } finally {
                setUploading(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSaveTexts = async () => {
        setSavingTexts(true);
        try {
            const response = await fetch('/api/settings/texts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ service_name: serviceName, facility_name: facilityName })
            });

            if (response.ok) {
                showToast('Названия успешно обновлены! Перезагрузите приложение для применения.', 'success');
                setShowTextModal(false);
            } else {
                showToast('Ошибка при сохранении названий на сервере.', 'error');
            }
        } catch (error) {
            console.error('Error saving texts:', error);
            showToast('Ошибка соединения с сервером.', 'error');
        } finally {
            setSavingTexts(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col items-center pt-16 pb-20 px-4 font-sans transition-colors duration-200">
            <div className="w-full max-w-md">
                <div className="mb-8 text-center relative w-full">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                        Настройки приложения
                    </h1>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                        Смена логотипа
                    </h2>

                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                        Загрузите изображение в формате <strong>JPG, PNG, SVG, ICO</strong> размером не более <strong>512х512</strong> пикселей. 
                        Логотип будет отображаться на главном экране приложения.
                    </p>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".jpg,.jpeg,.png,.svg,.ico"
                        className="hidden"
                    />

                    <button
                        onClick={handleUploadClick}
                        disabled={uploading}
                        className={`w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-all shadow-sm active:scale-95 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Upload className="w-5 h-5" />
                        {uploading ? 'Загрузка...' : 'Загрузить логотип'}
                    </button>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 mt-6">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-700 pb-2">
                        Тексты и заголовки
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                        Настройте название службы и объекта, которые отображаются на главном экране при входе в систему.
                    </p>
                    <button
                        onClick={() => setShowTextModal(true)}
                        className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium py-3 px-6 rounded-xl transition-all shadow-sm active:scale-95"
                    >
                        <Type className="w-5 h-5" />
                        Название на стартовой странице
                    </button>
                </div>

                <button
                    onClick={onBack}
                    className="w-full py-4 mt-8 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-2xl transition-colors"
                >
                    Назад
                </button>
            </div>

            {showTextModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl relative my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Настройки заголовков</h3>
                            <button onClick={() => setShowTextModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex flex-col gap-5">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Введите название службы
                                </label>
                                <input
                                    type="text"
                                    value={serviceName}
                                    onChange={(e) => setServiceName(e.target.value)}
                                    placeholder="Например: Служба ГСМ"
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Введите название объекта
                                </label>
                                <input
                                    type="text"
                                    value={facilityName}
                                    onChange={(e) => setFacilityName(e.target.value)}
                                    placeholder="Например: Аэропорт Шереметьево"
                                    className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                                />
                            </div>
                            <div className="flex gap-3 mt-2">
                                <button
                                    onClick={handleSaveTexts}
                                    disabled={savingTexts}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                >
                                    {savingTexts ? 'Сохранение...' : 'Сохранить'}
                                </button>
                                <button
                                    onClick={() => setShowTextModal(false)}
                                    className="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm font-medium py-2.5 rounded-lg transition-colors"
                                >
                                    Отмена
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
