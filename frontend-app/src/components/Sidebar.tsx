import React from 'react';
import { JobProgress } from '../types';

interface SidebarProps {
  history: JobProgress[];
  jobId: string | null;
  onSelectJob: (id: string) => void;
  onDeleteJob: (id: string, e: React.MouseEvent) => void;
  onNewSession: () => void;
}

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
