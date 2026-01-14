import React, { useState, useEffect, useRef } from 'react';

interface OracleObject {
  name: string;
  type: string;
}

interface JobProgress {
  job_id: string;
  status: string;
  created_at: string;
  message?: string;
}

const API_BASE = "http://localhost:8000/api";

function App() {
  const [connInfo, setConnInfo] = useState({
    host: '',
    port: 1521,
    user: '',
    password: '',
    schemaName: '',
    sid: '',
    serviceName: '',
    useThickMode: false,
    libDir: ''
  });

  const [schemas, setSchemas] = useState<string[]>([]);

  const [objects, setObjects] = useState<OracleObject[]>([]);
  const [selectedObjects, setSelectedObjects] = useState<OracleObject[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('connect'); // connect, select, monitor
  const [activeTabMonitor, setActiveTabMonitor] = useState('overview'); // overview, logs
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<JobProgress[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/jobs`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error("Failed to fetch history", e);
    }
  };

  useEffect(() => {
    fetchHistory();
    // Refresh history periodically
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setConnInfo(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : (name === 'port' ? parseInt(value) : value) 
    }));
  };

  const testConnection = async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 sec timeout

    try {
      const res = await fetch(`${API_BASE}/connections/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connInfo),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      if (res.ok) {
        alert("Connection Successful!");
        await fetchSchemas();
      }
      else alert("Error: " + data.detail);
    } catch (e: any) {
      if (e.name === 'AbortError') {
        alert("Connection timed out. Please check your host/port settings and firewall.");
      } else {
        alert("Failed to connect to backend");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSchemas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/oracle/schemas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connInfo)
      });
      if (res.ok) {
        const data = await res.json();
        setSchemas(data);
        // Automatically set the first schema if none selected
        if (data.length > 0 && !connInfo.schemaName) {
          setConnInfo(prev => ({ ...prev, schemaName: data[0] }));
        }
      }
    } catch (e) {
      console.error("Failed to fetch schemas", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobDetails = async (id: string) => {
    try {
      const statusRes = await fetch(`${API_BASE}/jobs/${id}`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setJobStatus(statusData);
        // Enhance: Restore selected objects if available
        if (statusData.selected_objects) {
          setSelectedObjects(statusData.selected_objects);
          // If we want to show the full list, we might need to fetch objects again or 
          // just show selected ones. For now, let's just set selected so they appear in summary.
          // Ideally we should also setObjects(statusData.selected_objects) so the table renders?
          // Or at least have them available for the 'Selected Objects Execution' view.
        }
      }
      const logsRes = await fetch(`${API_BASE}/jobs/${id}/logs?limit=1000`);
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs);
      }
    } catch (e) {
      console.error("Failed to fetch job details", e);
    }
  };

  const handleSelectJob = (id: string) => {
    // 1. Reset state to avoid stale data
    setJobId(id);
    setJobStatus(null);
    setLogs([]);
    setSelectedObjects([]); 
    setActiveTab('monitor');
    setActiveTabMonitor('overview');

    // 2. Fetch immediately
    fetchJobDetails(id);
  };

  const handleDeleteJob = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering selection
    if (!window.confirm("Are you sure you want to delete this session?")) return;

    try {
      const res = await fetch(`${API_BASE}/jobs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        // Remove from history list
        setHistory(prev => prev.filter(job => job.job_id !== id));
        // If the deleted job was active, switch to new session
        if (jobId === id) {
          handleNewSession();
        }
      } else {
        alert("Failed to delete job");
      }
    } catch (e) {
      console.error("Delete error", e);
    }
  };

  const handleNewSession = () => {
    setJobId(null);
    setJobStatus(null);
    setLogs([]);
    setObjects([]);
    setSelectedObjects([]);
    setActiveTab('connect');
    setConnInfo({
      host: '',
      port: 1521,
      user: '',
      password: '',
      schemaName: '',
      sid: '',
      serviceName: '',
      useThickMode: false,
      libDir: ''
    });
  };

  const fetchObjects = async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 sec timeout

    try {
      const res = await fetch(`${API_BASE}/oracle/objects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connInfo),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setObjects(data);
        setActiveTab('select');
      } else {
        const data = await res.json();
        alert("Error: " + data.detail);
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        alert("Fetching objects timed out. The network might be slow or the schema has too many objects.");
      } else {
        alert("Failed to fetch objects");
      }
    } finally {
      setLoading(false);
    }
  };

  const startJob = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection: connInfo,
          objects: selectedObjects,
          outputFormat: 'ZIP'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setJobId(data.jobId);
        setActiveTab('monitor');
        // Refresh history immediately so the new job appears in sidebar
        fetchHistory();
      }
    } catch (e) {
      alert("Failed to start job");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer: any;
    if (jobStatus?.status === 'RUNNING') {
      timer = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    } else if (jobStatus?.status === 'CREATED') {
      setElapsed(0);
    }
    return () => clearInterval(timer);
  }, [jobStatus?.status]);

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

  useEffect(() => {
    let interval: any;
    if (jobId && activeTab === 'monitor') {
      interval = setInterval(async () => {
        try {
          // When polling status, also ensure we get selected_objects if not already set? 
          // Usually status doesn't change objects list, but good to be consistent.
          // For efficiency, standard status poll is fine.
          const statusRes = await fetch(`${API_BASE}/jobs/${jobId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setJobStatus(statusData);
          }
          const logsRes = await fetch(`${API_BASE}/jobs/${jobId}/logs?limit=1000`);
          if (logsRes.ok) {
            const logsData = await logsRes.json();
            setLogs(logsData.logs);
          }
        } catch (e) {
          console.error("Polling error", e);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [jobId, activeTab]);

  return (
    <div className="app-layout">
      <div className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{ background: 'var(--primary)', color: 'white', padding: '0.5rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '1rem' }}>O2P</div>
            <h1 style={{ fontSize: '1.125rem', margin: 0, fontWeight: 700 }}>Ora2Pg Tool</h1>
          </div>
          <button className="new-session-btn" onClick={handleNewSession}>
            <span>+</span> New Migration
          </button>
        </div>
        <div className="sidebar-content">
          <label style={{ padding: '0 0.5rem', display: 'block', marginBottom: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recent Sessions</label>
          {history.length === 0 && (
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', opacity: 0.5 }}>No sessions yet</div>
          )}
          {history.map(job => (
            <div 
              key={job.job_id} 
              className={`history-item ${jobId === job.job_id ? 'active' : ''}`}
              onClick={() => handleSelectJob(job.job_id)}
              style={{ position: 'relative', paddingRight: '2rem' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="id">#{job.job_id.substring(0, 8)}</span>
                <span className={`status-badge status-${job.status.toLowerCase()}`} style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
                  {job.status}
                </span>
              </div>
              <span className="time">{new Date(job.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} · {new Date(job.created_at).toLocaleDateString()}</span>
              
              <button 
                onClick={(e) => handleDeleteJob(job.job_id, e)}
                style={{ 
                  position: 'absolute', 
                  right: '0.5rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--text-muted)', 
                  cursor: 'pointer',
                  fontSize: '1rem',
                  opacity: 0.6,
                  padding: '0.25rem'
                }}
                title="Delete Session"
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="main-content">
        {loading && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div className="step-circle active" style={{ width: '3rem', height: '3rem', fontSize: '1.5rem', border: 'none', background: 'transparent' }}>↻</div>
              <p style={{ fontWeight: 500 }}>Working on it...</p>
            </div>
          </div>
        )}

        <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: 0, fontWeight: 700 }}>{jobId ? 'Migration Details' : 'New Migration Session'}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {jobId ? `Monitoring session ${jobId}` : 'Connect to Oracle and select objects to begin a new conversion'}
            </p>
          </div>
        </header>

        {activeTab === 'connect' && !jobId && (
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>1. Database Connection</h2>
          <div className="grid-2">
            <div className="form-group">
              <label>Host</label>
              <input name="host" value={connInfo.host} onChange={handleInputChange} placeholder="127.0.0.1" />
            </div>
            <div className="form-group">
              <label>Port</label>
              <input name="port" type="number" value={connInfo.port} onChange={handleInputChange} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>Username</label>
              <input name="user" value={connInfo.user} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input name="password" type="password" value={connInfo.password} onChange={handleInputChange} />
            </div>
          </div>
          <div className="form-group">
            <label>Schema Name</label>
            {schemas.length > 0 ? (
              <select 
                name="schemaName" 
                value={connInfo.schemaName} 
                onChange={(e) => setConnInfo(prev => ({ ...prev, schemaName: e.target.value }))}
              >
                <option value="">-- Select a Schema --</option>
                {schemas.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <input name="schemaName" value={connInfo.schemaName} onChange={handleInputChange} placeholder="Type or test connection to list" />
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Tip: Click 'Test Connection' to load available schemas.
            </p>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label>SID (Optional)</label>
              <input name="sid" value={connInfo.sid} onChange={handleInputChange} />
            </div>
            <div className="form-group">
              <label>Service Name (Optional)</label>
              <input name="serviceName" value={connInfo.serviceName} onChange={handleInputChange} />
            </div>
          </div>
          
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input 
              type="checkbox" 
              name="useThickMode" 
              checked={connInfo.useThickMode} 
              onChange={handleInputChange}
              style={{ width: 'auto' }}
            />
            <label style={{ margin: 0 }}>Use Thick Mode (Oracle Instant Client)</label>
          </div>

          {connInfo.useThickMode && (
            <div className="form-group">
              <label>Instant Client Library Path (lib_dir)</label>
              <input 
                name="libDir" 
                value={connInfo.libDir} 
                onChange={handleInputChange} 
                placeholder="C:\oracle\instantclient_19_8" 
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Required for certain Oracle features or older versions.
              </p>
            </div>
          )}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn-secondary" onClick={testConnection} disabled={loading}>Test Connection</button>
            <button className="btn-primary" onClick={fetchObjects} disabled={loading}>
              {loading ? 'Fetching...' : 'Continue to selection'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'select' && (
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>2. Select Objects</h2>
          <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>
                    <input type="checkbox" onChange={(e) => {
                      if (e.target.checked) setSelectedObjects([...objects]);
                      else setSelectedObjects([]);
                    }} />
                  </th>
                  <th style={{ padding: '0.75rem' }}>Name</th>
                  <th style={{ padding: '0.75rem' }}>Type</th>
                </tr>
              </thead>
              <tbody>
                {objects.map(obj => (
                  <tr key={obj.name} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedObjects.some(o => o.name === obj.name)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedObjects([...selectedObjects, obj]);
                          else setSelectedObjects(selectedObjects.filter(o => o.name !== obj.name));
                        }}
                      />
                    </td>
                    <td style={{ padding: '0.75rem' }}>{obj.name}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className="status-badge" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>{obj.type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button className="btn-secondary" onClick={() => setActiveTab('connect')}>Back</button>
            <button className="btn-primary" onClick={startJob} disabled={loading || selectedObjects.length === 0}>
              Start Conversion ({selectedObjects.length} selected)
            </button>
          </div>
        </div>
      )}

      {activeTab === 'monitor' && jobId && (
        <div className="card" style={{ maxWidth: '1000px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Migration Job: {jobId.substring(0, 8)}...</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Created at {jobStatus?.created_at ? new Date(jobStatus.created_at).toLocaleString() : '...'}</p>
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

              <div className="progress-steps" style={{ marginBottom: '3rem' }}>
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
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>{connInfo.host}:{connInfo.port}</p>
                </div>
                <div className="summary-card">
                  <label>Schema</label>
                  <div className="value">{connInfo.schemaName}</div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>{selectedObjects.length} objects selected</p>
                </div>
                <div className="summary-card">
                  <label>Job Status</label>
                  <div className="value" style={{ color: jobStatus?.status === 'DONE' ? 'var(--success)' : '' }}>{jobStatus?.status}</div>
                  {jobStatus?.message && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>{jobStatus.message}</p>}
                </div>
                <div className="summary-card">
                  <label>Elapsed Time</label>
                  <div className="value">{formatTime(elapsed)}</div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>Job duration</p>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: '0.875rem', marginBottom: '1rem', textTransform: 'uppercase' }}>Selected Objects Execution</h3>
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.875rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.5rem 0' }}>Object Name</th>
                        <th style={{ padding: '0.5rem 0' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedObjects.slice(0, 10).map(obj => (
                        <tr key={obj.name} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem 0' }}>{obj.name}</td>
                          <td style={{ padding: '0.5rem 0' }}>
                            <span style={{ color: jobStatus?.status === 'DONE' ? 'var(--success)' : 'var(--primary)' }}>
                              {jobStatus?.status === 'DONE' ? 'Completed' : (jobStatus?.status === 'RUNNING' ? 'In Progress' : 'Pending')}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {selectedObjects.length > 10 && <tr><td colSpan={2} style={{ padding: '0.5rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>... and {selectedObjects.length - 10} more</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTabMonitor === 'logs' && (
            <div 
              ref={logContainerRef}
              style={{ background: '#000', borderRadius: '0.5rem', padding: '1rem', height: '450px', overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid #333' }}
            >
              {logs.length === 0 && <div style={{ color: '#444', fontStyle: 'italic' }}>Waiting for logs...</div>}
              {logs.map((log, i) => (
                <div key={i} style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: '#10b981', marginBottom: '0.25rem', display: 'flex', gap: '1rem' }}>
                  <span style={{ color: '#444', userSelect: 'none' }}>{i + 1}</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
             {jobStatus?.status === 'DONE' && (
               <a 
                href={`${API_BASE}/jobs/${jobId}/download`}
                className="btn-primary"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}
               >
                Download Migration Report (ZIP)
               </a>
             )}
             <button className="btn-secondary" onClick={() => { setJobId(null); setActiveTab('connect'); }}>New Session</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default App;
