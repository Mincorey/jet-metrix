import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ToastContextType {
    showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000); // исчезает через 3 секунды
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast && (
                <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 transition-all text-white text-sm animate-bounce-short ${
                    toast.type === 'success' ? 'bg-emerald-600' : 
                    toast.type === 'warning' ? 'bg-amber-500' : 
                    'bg-red-500'
                }`}>
                    <span className="text-base leading-none">
                        {toast.type === 'success' ? '✅' : toast.type === 'warning' ? '⚠️' : '❌'}
                    </span>
                    <span className="font-medium leading-snug">{toast.message}</span>
                </div>
            )}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within ToastProvider');
    return context;
};
