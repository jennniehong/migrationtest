import React from 'react';

/**
 * Props for the Modal component.
 * 
 * 모달 컴포넌트의 Props 인터페이스입니다.
 */
interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'info';
}

/**
 * A reusable Modal component for confirmations and alerts.
 * Displays a centered overlay with a title, message, and action buttons.
 * 
 * 확인 및 알림을 위한 재사용 가능한 모달 컴포넌트입니다.
 * 제목, 메시지 및 작업 버튼이 있는 중앙 오버레이를 표시합니다.
 */
export const Modal: React.FC<ModalProps> = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  type = 'info'
}) => {
  if (!isOpen) return null;

  return (
    <div className="overlay">
      <div className="card modal-card">
        <h3 className="modal-header">
          {type === 'danger' && <span className="text-error">⚠</span>}
          {title}
        </h3>
        <p className="modal-body">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
          <button 
            className="btn-primary" 
            onClick={onConfirm}
            style={type === 'danger' ? { backgroundColor: 'var(--error)', borderColor: 'var(--error)' } : {}}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
