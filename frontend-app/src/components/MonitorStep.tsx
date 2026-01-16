/**
 * @fileoverview Migration Monitor Step Component
 * Displays real-time job progress, logs, and object status during migration.
 * 
 * 마이그레이션 모니터 단계 컴포넌트
 * 마이그레이션 중 실시간 작업 진행 상황, 로그 및 객체 상태를 표시합니다.
 */
import React, { useEffect, useRef } from 'react';
import { ConnectionInfo, JobProgress, OracleObject } from '../types';

/** API base URL / API 기본 URL */
const API_BASE = "http://localhost:8080/api";

/**
 * Props for the MonitorStep component.
 * MonitorStep 컴포넌트의 Props입니다.
 */
interface MonitorStepProps {
  /** Current job ID / 현재 작업 ID */
  jobId: string;
  /** Job progress and status / 작업 진행 상태 */
  jobStatus: JobProgress | null;
  /** Elapsed time in seconds / 경과 시간 (초) */
  elapsed: number;
  /** Array of log messages / 로그 메시지 배열 */
  logs: string[];
  /** Active tab in monitor view ('overview' or 'logs') / 모니터 뷰의 활성 탭 */
  activeTabMonitor: string;
  /** Callback to change active tab / 활성 탭 변경 콜백 */
  setActiveTabMonitor: (tab: string) => void;
  /** List of selected objects being processed / 처리 중인 선택된 객체 목록 */
  selectedObjects: OracleObject[];
  /** Oracle connection info / Oracle 연결 정보 */
  connInfo: ConnectionInfo;
  /** Callback to start a new session / 새 세션 시작 콜백 */
  onNewSession: () => void;
  /** Callback to go back to selection view / 선택 뷰로 돌아가기 콜백 */
  onBackToSelection: () => void;
  /** Optional callback to cancel running job / 실행 중인 작업 취소용 선택적 콜백 */
  onCancel?: () => void;
}

/**
 * Migration Monitor Step Component
 * Provides real-time monitoring of migration jobs with progress tracking,
 * log viewing, and action buttons for job control.
 * 
 * 마이그레이션 모니터 단계 컴포넌트
 * 진행 상황 추적, 로그 보기, 작업 제어 버튼을 통한
 * 마이그레이션 작업의 실시간 모니터링을 제공합니다.
 * 
 * @param props - Component props / 컴포넌트 props
 * @returns JSX element / JSX 요소
 */
export const MonitorStep: React.FC<MonitorStepProps> = ({
  jobId,
  jobStatus,
  elapsed,
  logs,
  activeTabMonitor,
  setActiveTabMonitor,
  selectedObjects,
  connInfo,
  onNewSession,
  onBackToSelection,
  onCancel
}) => {
  // Ref for auto-scrolling log container / 로그 컨테이너 자동 스크롤용 Ref
  const logContainerRef = useRef<HTMLDivElement>(null);

  /**
   * Auto-scroll log container to bottom when new logs arrive.
   * 새 로그가 도착하면 로그 컨테이너를 자동으로 맨 아래로 스크롤합니다.
   */
  useEffect(() => {
    if (logContainerRef.current && activeTabMonitor === 'logs') {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, activeTabMonitor]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card monitor-card">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-border">
        <div>
          <h2 className="text-xl m-0">Migration Job: {jobId.substring(0, 8)}...</h2>
          <p className="text-sm text-muted">Created at {jobStatus?.created_at ? new Date(jobStatus.created_at).toLocaleString() : '...'}</p>
        </div>
        {jobStatus && (
          <span className={`status-badge status-${jobStatus.status.toLowerCase()}`}>
            {jobStatus.status}
          </span>
        )}
      </div>

      <div className="tabs-nav">
        <button className={`tab-btn ${activeTabMonitor === 'overview' ? 'active' : ''}`} onClick={() => setActiveTabMonitor('overview')}>Overview</button>
        <button className={`tab-btn ${activeTabMonitor === 'logs' ? 'active' : ''}`} onClick={() => setActiveTabMonitor('logs')}>CloudWatch Logs</button>
      </div>
      
      {activeTabMonitor === 'overview' && (
        <div>
          <div className="progress-container">
            <div 
              className="progress-bar-striped" 
              style={{ 
                width: jobStatus?.status === 'DONE' ? '100%' : (jobStatus?.status === 'RUNNING' ? '66%' : '10%'),
                backgroundColor: jobStatus?.status === 'FAILED' ? 'var(--error)' : 'var(--primary)'
              }} 
            />
          </div>

          <div className="progress-steps mb-8">
            <div className={`step ${jobStatus?.status !== 'CREATED' ? 'done' : 'active'}`}>
              <div className="step-circle">{jobStatus?.status !== 'CREATED' ? '✓' : '1'}</div>
              <label>SCANNING</label>
            </div>
            <div className={`step ${['DONE', 'FAILED'].includes(jobStatus?.status || '') ? 'done' : (jobStatus?.status === 'RUNNING' ? 'active' : '')}`}>
              <div className="step-circle">{['DONE', 'FAILED'].includes(jobStatus?.status || '') ? '✓' : '2'}</div>
              <label>MIGRATE DATA</label>
            </div>
            <div className={`step ${jobStatus?.status === 'DONE' ? 'done' : ''}`}>
              <div className="step-circle">{jobStatus?.status === 'DONE' ? '✓' : '3'}</div>
              <label>PACKAGING</label>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <label>Source Type</label>
              <div className="value">Oracle Database</div>
              <p className="text-xs text-muted mt-1">{connInfo.host}:{connInfo.port}</p>
            </div>
            <div className="summary-card">
              <label>Schema</label>
              <div className="value">{connInfo.schemaName}</div>
              <p className="text-xs text-muted mt-1">{selectedObjects.length} objects selected</p>
            </div>
            <div className="summary-card">
              <label>Job Status</label>
              <div className="value" style={jobStatus?.status === 'DONE' ? { color: 'var(--success)' } : {}}>{jobStatus?.status}</div>
              {jobStatus?.message && <p className="text-xs text-muted mt-1">{jobStatus.message}</p>}
            </div>
            <div className="summary-card">
              <label>Elapsed Time</label>
              <div className="value">{formatTime(elapsed)}</div>
              <p className="text-xs text-muted mt-1">Job duration</p>
            </div>
          </div>

          <div className="execution-details-box">
            <h3 className="text-sm mb-4 uppercase">Selected Objects Execution</h3>
            <div className="execution-table-wrapper">
              <table className="execution-table">
                <thead>
                  <tr>
                    <th>Object Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedObjects.slice(0, 10).map(obj => {
                    const objNameUpper = obj.name.toUpperCase();
                    const isCompleted = jobStatus?.completed_objects?.includes(objNameUpper) 
                      || (jobStatus?.status === 'DONE' && !jobStatus?.failed_objects?.includes(objNameUpper));
                    const isFailed = jobStatus?.failed_objects?.includes(objNameUpper);
                    const isCurrent = jobStatus?.current_object?.toUpperCase() === objNameUpper;
                    const isJobRunning = jobStatus?.status === 'RUNNING';
                    
                    let statusText = 'Pending';
                    let statusColor = 'rgba(255, 255, 255, 0.2)';
                    let statusIcon = '';
                    
                    if (isFailed) {
                      statusText = 'Failed';
                      statusColor = 'var(--error)';
                      statusIcon = '✗';
                    } else if (isCompleted) {
                      statusText = 'Completed';
                      statusColor = 'var(--success)';
                      statusIcon = '✓';
                    } else if (isCurrent) {
                      statusText = 'In Progress';
                      statusColor = 'var(--primary)';
                    } else if (isJobRunning) {
                      statusText = 'Pending';
                      statusColor = 'rgba(255, 255, 255, 0.4)';
                    }

                    return (
                      <tr key={obj.name} className="border-top">
                        <td>{obj.name}</td>
                        <td>
                          <span style={{ 
                            color: statusColor, 
                            fontWeight: (isCompleted || isCurrent || isFailed) ? 'bold' : 'normal',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            {isCurrent && <div className="loading-spinner-small" style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--primary)' }}></div>}
                            {statusIcon && <span>{statusIcon}</span>}
                            {statusText}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {selectedObjects.length > 10 && <tr><td colSpan={2} className="p-2 text-center text-muted">... and {selectedObjects.length - 10} more</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTabMonitor === 'logs' && (
        <div 
          ref={logContainerRef}
          className="log-container"
        >
          {logs.length === 0 && <div className="log-empty">Waiting for logs...</div>}
          {logs.map((log, i) => (
            <div key={i} className="log-item">
              <span className="log-index">{i + 1}</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center gap-4 mt-8">
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={onBackToSelection}>
            ← Back to Selection
          </button>
          <button className="btn-secondary" onClick={onNewSession}>
            New Session
          </button>
        </div>
        <div className="flex gap-3">
          {jobStatus?.status === 'RUNNING' && onCancel && (
            <button 
              className="btn-secondary" 
              onClick={onCancel}
              style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
            >
              ✗ Cancel Job
            </button>
          )}
          {(jobStatus?.status === 'DONE' || jobStatus?.status === 'PARTIAL_DONE') && (
            <>
              <a 
                href={`${API_BASE}/jobs/${jobId}/download`}
                className="btn-primary download-btn"
              >
                📥 Download Results (ZIP)
              </a>
            </>
          )}
          {jobStatus?.status === 'PARTIAL_DONE' && jobStatus?.failed_objects && jobStatus.failed_objects.length > 0 && (
            <button 
              className="btn-secondary"
              style={{ borderColor: 'var(--warning)', color: 'var(--warning)' }}
              onClick={async () => {
                try {
                  const res = await fetch(`${API_BASE}/jobs/${jobId}/retry`, { method: 'POST' });
                  if (res.ok) {
                    const data = await res.json();
                    alert(`Retry initiated for ${data.retry_objects?.length || 0} objects. Refresh to see progress.`);
                  } else {
                    const err = await res.json();
                    alert(`Retry failed: ${err.detail || 'Unknown error'}`);
                  }
                } catch (e) {
                  alert('Error initiating retry');
                }
              }}
            >
              🔄 Retry Failed ({jobStatus.failed_objects.length})
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
