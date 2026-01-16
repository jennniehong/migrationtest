import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './components/Modal';
import { ToastProvider, useToast } from './components/Toast';
import { Sidebar } from './components/Sidebar';
import { ConnectionStep } from './components/ConnectionStep';
import { SelectionStep } from './components/SelectionStep';
import { MonitorStep } from './components/MonitorStep';
import { ComparisonStep } from './components/ComparisonStep';
import { DataMigrationStep } from './components/DataMigrationStep';
import { ConnectionInfo, JobProgress, OracleObject } from './types';

const API_BASE = "http://localhost:8080/api";

function AppContent() {
  const { showToast } = useToast();
  
  // Session-specific state storage
  const [sessionStates, setSessionStates] = useState<Map<string, {
    connInfo: ConnectionInfo;
    objects: OracleObject[];
    selectedObjects: OracleObject[];
    schemas: string[];
  }>>(new Map());

  const [connInfo, setConnInfo] = useState<ConnectionInfo>({
    host: '',
    port: 1521,
    user: '',
    password: '',
    schemaName: '',
    sid: '',
    serviceName: '',
    useThickMode: false,
    libDir: '',
    pgVersion: 15  // Default PostgreSQL version
  });

  const [schemas, setSchemas] = useState<string[]>([]);
  const [objects, setObjects] = useState<OracleObject[]>([]);
  const [selectedObjects, setSelectedObjects] = useState<OracleObject[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobProgress | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('connect'); // connect, select, compare, monitor, data
  const [activeTabMonitor, setActiveTabMonitor] = useState('overview'); // overview, logs
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<JobProgress[]>([]);
  
  // Selection Filters
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set(['ALL']));
  const [searchTerm, setSearchTerm] = useState('');
  const [outputFormat, setOutputFormat] = useState('SQL'); // SQL, CSV
  
  const uniqueTypes = ['ALL', ...Array.from(new Set(objects.map(o => o.type))).sort()];
  
  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });

  const filteredObjects = objects.filter(o => {
    const typeMatch = filterTypes.has('ALL') || filterTypes.size === 0 || filterTypes.has(o.type);
    const nameMatch = o.name.toLowerCase().includes(searchTerm.toLowerCase());
    return typeMatch && nameMatch;
  });

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
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, []);

  const testConnection = async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); 

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
        showToast("Connection Successful!", "success");
        await fetchSchemas();
      }
      else showToast("Error: " + data.detail, "error");
    } catch (e: any) {
      if (e.name === 'AbortError') {
        showToast("Connection timed out. Please check your host/port settings and firewall.", "error");
      } else {
        showToast("Failed to connect to backend", "error");
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
        if (data.length > 0 && !connInfo.schemaName) {
          setConnInfo(prev => ({ ...prev, schemaName: data[0] }));
        }
      }
    } catch (e) {
      showToast("Failed to fetch schemas", "error");
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
        if (statusData.selected_objects) {
          setSelectedObjects(statusData.selected_objects);
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
    // Save current session state before switching (if we have a jobId)
    if (jobId && (connInfo.host || objects.length > 0)) {
      setSessionStates(prev => new Map(prev).set(jobId, {
        connInfo,
        objects,
        selectedObjects,
        schemas
      }));
    }

    // Load target session state if it exists
    const targetSessionState = sessionStates.get(id);
    if (targetSessionState) {
      setConnInfo(targetSessionState.connInfo);
      setObjects(targetSessionState.objects);
      setSelectedObjects(targetSessionState.selectedObjects);
      setSchemas(targetSessionState.schemas);
    } else {
      // If no saved state, reset to defaults (will be populated from API)
      setSelectedObjects([]);
    }

    setJobId(id);
    setJobStatus(null);
    setLogs([]);
    setActiveTab('monitor');
    setActiveTabMonitor('overview');
    fetchJobDetails(id);
  };

  const executeDeleteJob = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/jobs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHistory(prev => prev.filter(job => job.job_id !== id));
        if (jobId === id) {
          handleNewSession();
        }
        showToast("Session deleted successfully", "success");
      } else {
        showToast("Failed to delete job", "error");
      }
    } catch (e) {
      showToast("Error deleting job", "error");
    } finally {
      setModalConfig(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleDeleteJob = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalConfig({
      isOpen: true,
      title: 'Delete Session',
      message: 'Are you sure you want to delete this session? This action cannot be undone.',
      onConfirm: () => executeDeleteJob(id),
      type: 'danger'
    });
  };

  const handleNewSession = () => {
    // Save current session state before starting new one (if we have a jobId)
    if (jobId && (connInfo.host || objects.length > 0)) {
      setSessionStates(prev => new Map(prev).set(jobId, {
        connInfo,
        objects,
        selectedObjects,
        schemas
      }));
    }

    // Complete reset for a brand new migration session
    setJobId(null);
    setJobStatus(null);
    setLogs([]);
    setObjects([]);
    setSelectedObjects([]);
    setActiveTab('connect');
    setSchemas([]);
    // Reset connection info to start fresh
    setConnInfo({
      host: '',
      port: 1521,
      user: '',
      password: '',
      schemaName: '',
      sid: '',
      serviceName: '',
      useThickMode: false,
      libDir: '',
      pgVersion: 15
    });
  };

  const handleCancelJob = async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, {
        method: 'POST'
      });
      if (res.ok) {
        showToast('Job cancellation requested', 'info');
      } else {
        showToast('Failed to cancel job', 'error');
      }
    } catch (e) {
      showToast('Error canceling job', 'error');
    }
  };

  const fetchObjects = async () => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); 

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
        showToast("Error: " + data.detail, "error");
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        showToast("Fetching objects timed out. The network might be slow or the schema has too many objects.", "error");
      } else {
        showToast("Failed to fetch objects", "error");
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
          outputFormat: outputFormat
        })
      });
      if (res.ok) {
        const data = await res.json();
        setJobId(data.jobId);
        setActiveTab('monitor');
        fetchHistory();
        showToast("Migration job started successfully", "success");
      }
    } catch (e) {
      showToast("Failed to start job", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer: any;
    if (jobStatus) {
      const startTime = new Date(jobStatus.created_at).getTime();
      if (jobStatus.status === 'RUNNING') {
        setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
        timer = setInterval(() => {
          const now = Date.now();
          setElapsed(Math.max(0, Math.floor((now - startTime) / 1000)));
        }, 1000);
      } else if (jobStatus.finished_at) {
        const endTime = new Date(jobStatus.finished_at).getTime();
        setElapsed(Math.max(0, Math.floor((endTime - startTime) / 1000)));
      } else {
        setElapsed(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
      }
    } else {
      setElapsed(0);
    }
    return () => clearInterval(timer);
  }, [jobStatus]);

  useEffect(() => {
    let interval: any;
    if (jobId && activeTab === 'monitor') {
      interval = setInterval(async () => {
        try {
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
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [jobId, activeTab]);

  return (
    <div className="app-layout">
      {/* Modal Integration */}
      <Modal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        type={modalConfig.type}
      />

      <Sidebar 
        history={history}
        jobId={jobId}
        onSelectJob={handleSelectJob}
        onDeleteJob={handleDeleteJob}
        onNewSession={handleNewSession}
      />

      <div className="main-content">
        {loading && (
          <div className="overlay loading-overlay">
            <div className="flex flex-col items-center gap-4">
              <div className="step-circle active loading-spinner">↻</div>
              <p className="font-medium">Working on it...</p>
            </div>
          </div>
        )}

        <header className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl m-0 font-bold">{jobId ? 'Migration Details' : 'New Migration Session'}</h2>
            <p className="text-sm text-muted mt-1">
              {jobId ? `Monitoring session #${jobId.substring(0, 8)}` : 'Connect to Oracle and select objects to begin a new conversion'}
            </p>
          </div>
        </header>

        {/* Workflow Tabs - Show progression throughout entire workflow */}
        <div className="tabs-nav">
          {!jobId ? (
            <>
              <button 
                className={`tab-btn ${activeTab === 'connect' ? 'active' : ''}`}
                onClick={() => setActiveTab('connect')}
              >
                1. Connection
              </button>
              <button 
                className={`tab-btn ${activeTab === 'select' ? 'active' : ''}`}
                onClick={() => setActiveTab('select')}
                disabled={objects.length === 0}
                style={{ opacity: objects.length === 0 ? 0.5 : 1, cursor: objects.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                2. Selection
              </button>
              <button 
                className={`tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
                onClick={() => setActiveTab('compare')}
                disabled={selectedObjects.length === 0}
                style={{ opacity: selectedObjects.length === 0 ? 0.5 : 1, cursor: selectedObjects.length === 0 ? 'not-allowed' : 'pointer' }}
              >
                3. Comparison
              </button>
              <button 
                className="tab-btn"
                disabled={true}
                style={{ opacity: 0.5, cursor: 'not-allowed' }}
              >
                4. Monitor
              </button>
            </>
          ) : (
            <>
              <button 
                className={`tab-btn ${activeTab === 'connect' ? 'active' : ''}`}
                onClick={() => setActiveTab('connect')}
                style={{ opacity: 0.8 }}
                title="View connection details"
              >
                ✓ Connection
              </button>
              <button 
                className={`tab-btn ${activeTab === 'select' ? 'active' : ''}`}
                onClick={() => setActiveTab('select')}
                style={{ opacity: 0.8 }}
                title="View selected objects"
              >
                ✓ Selection
              </button>
              <button 
                className={`tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
                onClick={() => setActiveTab('compare')}
                disabled={selectedObjects.length === 0}
                style={{ opacity: selectedObjects.length === 0 ? 0.5 : 0.8, cursor: selectedObjects.length === 0 ? 'not-allowed' : 'pointer' }}
                title="View DDL comparison"
              >
                ✓ Comparison
              </button>
              <button 
                className={`tab-btn ${activeTab === 'monitor' ? 'active' : ''}`}
                onClick={() => setActiveTab('monitor')}
              >
                4. Monitor
              </button>
            </>
          )}
        </div>

        {activeTab === 'connect' && (
          <ConnectionStep 
            connInfo={connInfo}
            setConnInfo={setConnInfo}
            schemas={schemas}
            loading={loading}
            onTestConnection={testConnection}
            onFetchObjects={fetchObjects}
          />
        )}

        {activeTab === 'select' && (
          <SelectionStep 
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filterTypes={filterTypes}
            setFilterTypes={setFilterTypes}
            outputFormat={outputFormat}
            setOutputFormat={setOutputFormat}
            selectedObjects={selectedObjects}
            setSelectedObjects={setSelectedObjects}
            uniqueTypes={uniqueTypes}
            filteredObjects={filteredObjects}
            connInfo={connInfo}
            loading={loading}
            onStartJob={() => setActiveTab('compare')}
            onBack={() => setActiveTab('connect')}
          />
        )}

        {activeTab === 'compare' && (
          <ComparisonStep 
            connInfo={connInfo}
            selectedObjects={selectedObjects}
            onContinue={startJob}
            onBack={() => setActiveTab('select')}
          />
        )}

        {activeTab === 'data' && (
          <DataMigrationStep 
            connInfo={connInfo}
            objects={objects}
            onBack={() => setActiveTab('monitor')}
          />
        )}

        {activeTab === 'monitor' && jobId && (
          <MonitorStep 
            jobId={jobId}
            jobStatus={jobStatus}
            elapsed={elapsed}
            logs={logs}
            activeTabMonitor={activeTabMonitor}
            setActiveTabMonitor={setActiveTabMonitor}
            selectedObjects={selectedObjects}
            connInfo={connInfo}
            onNewSession={handleNewSession}
            onBackToComparison={() => setActiveTab('compare')}
            onDataMigration={() => setActiveTab('data')}
            onCancel={handleCancelJob}
          />
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;
