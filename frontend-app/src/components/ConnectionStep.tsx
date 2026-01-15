import React from 'react';
import { ConnectionInfo } from '../types';

interface ConnectionStepProps {
  connInfo: ConnectionInfo;
  setConnInfo: React.Dispatch<React.SetStateAction<ConnectionInfo>>;
  schemas: string[];
  loading: boolean;
  onTestConnection: () => void;
  onFetchObjects: () => void;
}

export const ConnectionStep: React.FC<ConnectionStepProps> = ({
  connInfo,
  setConnInfo,
  schemas,
  loading,
  onTestConnection,
  onFetchObjects
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setConnInfo(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : (name === 'port' ? parseInt(value) : value) 
    }));
  };

  return (
    <div className="card">
      <h2 className="text-xl mb-6">1. Database Connection</h2>
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
      
      <div className="form-group checkbox-group mb-6">
        <input 
          type="checkbox" 
          name="useThickMode" 
          checked={connInfo.useThickMode} 
          onChange={handleInputChange}
          className="w-auto"
        />
        <label className="m-0">Use Thick Mode (Oracle Instant Client)</label>
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
          <p className="text-xs text-muted mt-1">
            Required for certain Oracle features or older versions.
          </p>
        </div>
      )}
            <div className="form-group">
        <label>Schema Name</label>
        {schemas.length > 0 ? (
          <select 
            name="schemaName" 
            value={connInfo.schemaName} 
            onChange={(e) => setConnInfo(prev => ({ ...prev, schemaName: e.target.value }))}
            className="custom-select"
          >
            <option value="">-- Select a Schema --</option>
            {schemas.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <input name="schemaName" value={connInfo.schemaName} onChange={handleInputChange} placeholder="Type or test connection to list" />
        )}
        <p className="text-xs text-muted mt-1">
          Tip: Click 'Test Connection' to load available schemas.
        </p>
      </div>
      <div className="flex justify-between items-center gap-4 mt-4 pt-4 border-t border-border">
        <div></div> {/* Empty left side for first step */}
        <div className="flex gap-3">
          <button className="btn-secondary" onClick={onTestConnection} disabled={loading}>Test Connection</button>
          <button className="btn-primary" onClick={onFetchObjects} disabled={loading}>
            {loading ? 'Fetching...' : 'Continue to Selection →'}
          </button>
        </div>
      </div>
    </div>
  );
};
