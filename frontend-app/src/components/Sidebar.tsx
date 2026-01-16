/**
 * @fileoverview Sidebar Navigation Component
 * Displays recent job sessions and provides navigation controls.
 * 
 * 사이드바 네비게이션 컴포넌트
 * 최근 작업 세션을 표시하고 탐색 컨트롤을 제공합니다.
 */
import React from 'react';
import { JobProgress } from '../types';

/**
 * Props for the Sidebar component.
 * Sidebar 컴포넌트의 Props입니다.
 */
interface SidebarProps {
  /** List of job history / 작업 이력 목록 */
  history: JobProgress[];
  /** Currently selected job ID / 현재 선택된 작업 ID */
  jobId: string | null;
  /** Callback when a job is selected / 작업 선택 시 콜백 */
  onSelectJob: (id: string) => void;
  /** Callback when a job is deleted / 작업 삭제 시 콜백 */
  onDeleteJob: (id: string, e: React.MouseEvent) => void;
  /** Callback to start new session / 새 세션 시작 콜백 */
  onNewSession: () => void;
}

/**
 * Sidebar Navigation Component
 * Displays application branding, new migration button, and recent session history.
 * 
 * 사이드바 네비게이션 컴포넌트
 * 애플리케이션 브랜딩, 새 마이그레이션 버튼 및 최근 세션 이력을 표시합니다.
 * 
 * @param props - Component props / 컴포넌트 props
 * @returns JSX element / JSX 요소
 */
export const Sidebar: React.FC<SidebarProps> = ({
  history,
  jobId,
  onSelectJob,
  onDeleteJob,
  onNewSession
}) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="flex items-center gap-3 mb-6">
          <div className="app-logo-badge">O2P</div>
          <h1 className="text-lg m-0 font-bold">Ora2Pg Tool</h1>
        </div>
        <button className="new-session-btn" onClick={onNewSession}>
          <span>+</span> New Migration
        </button>
      </div>
      <div className="sidebar-content">
        <label className="sidebar-section-label">Recent Sessions</label>
        {history.length === 0 && (
          <div className="empty-history">No sessions yet</div>
        )}
        {history.map(job => (
          <div 
            key={job.job_id} 
            className={`history-item ${jobId === job.job_id ? 'active' : ''}`}
            onClick={() => onSelectJob(job.job_id)}
          >
            <div className="flex justify-between items-start">
              <span className="id">#{job.job_id.substring(0, 8)}</span>
              <span className={`status-badge status-${job.status.toLowerCase()}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                {job.status}
              </span>
            </div>
            <span className="time">{new Date(job.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} · {new Date(job.created_at).toLocaleDateString()}</span>
            
            <button 
              onClick={(e) => onDeleteJob(job.job_id, e)}
              className="delete-session-btn"
              title="Delete Session"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
