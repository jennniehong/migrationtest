import React, { useState, useEffect, useCallback } from 'react';

/**
 * Structure of a toast notification message.
 * 
 * 토스트 알림 메시지의 구조입니다.
 */
export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

/**
 * Context type for the Toast system.
 * 
 * 토스트 시스템을 위한 컨텍스트 타입입니다.
 */
interface ToastContextType {
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const ToastContext = React.createContext<ToastContextType | null>(null);

/**
 * Provider component for Toast notifications.
 * Manages the state of active toasts and renders them in a fixed container.
 * 
 * 토스트 알림을 위한 Provider 컴포넌트입니다.
 * 활성 토스트의 상태를 관리하고 고정된 컨테이너에 렌더링합니다.
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000); // Auto dismiss after 4 seconds
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`toast toast-${toast.type}`}
          >
            <span>{toast.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="toast-close-btn"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

/**
 * Custom hook to use usage of the Toast system.
 * 
 * 토스트 시스템 사용을 위한 커스텀 훅입니다.
 */
export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
