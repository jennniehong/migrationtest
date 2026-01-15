import React, { useEffect, useRef } from 'react';
import { ConnectionInfo, JobProgress, OracleObject } from '../types';

// Assuming API_BASE is shared constant, but components shouldn't rely on it for download link if possible.
// We'll accept download URL generation or base as prop, or keep hardcoded if it was constant. 
// Ideally passed as prop, but 'API_BASE' was a constant in App.tsx. We'll reuse the string literal for simplicity or move it to constants.
const API_BASE = "http://localhost:8080/api";

interface MonitorStepProps {
  jobId: string;
  jobStatus: JobProgress | null;
  elapsed: number;
  logs: string[];
  activeTabMonitor: string;
  setActiveTabMonitor: (tab: string) => void;
  selectedObjects: OracleObject[];
  connInfo: ConnectionInfo;
  onNewSession: () => void;
  onBackToComparison: () => void;
  onDataMigration?: () => void;
}

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
  onBackToComparison,
  onDataMigration
}) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

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
                  {selectedObjects.slice(0, 10).map(obj => (
                    <tr key={obj.name} className="border-top">
                      <td>{obj.name}</td>
                      <td>
                        <span style={jobStatus?.status === 'DONE' ? { color: 'var(--success)' } : { color: 'var(--primary)' }}>
                          {jobStatus?.status === 'DONE' ? 'Completed' : (jobStatus?.status === 'RUNNING' ? 'In Progress' : 'Pending')}
                        </span>
                      </td>
                    </tr>
                  ))}
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
          <button className="btn-secondary" onClick={onBackToComparison}>
            ← Back to Comparison
          </button>
          <button className="btn-secondary" onClick={onNewSession}>
            New Session
          </button>
        </div>
        <div className="flex gap-3">
          {jobStatus?.status === 'DONE' && (
            <>
              <a 
                href={`${API_BASE}/jobs/${jobId}/download`}
                className="btn-primary download-btn"
              >
                📥 Download Results (ZIP)
              </a>
              {onDataMigration && (
                <button className="btn-primary" onClick={onDataMigration}>
                  Migrate Data →
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
