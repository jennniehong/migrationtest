/**
 * @fileoverview Database Connection Step Component
 * Provides a form for configuring Oracle database connection settings.
 * 
 * 데이터베이스 연결 단계 컴포넌트
 * Oracle 데이터베이스 연결 설정을 구성하는 양식을 제공합니다.
 */
import React from 'react';
import { ConnectionInfo } from '../types';

/**
 * Props for the ConnectionStep component.
 * ConnectionStep 컴포넌트의 Props입니다.
 */
interface ConnectionStepProps {
  /** Current connection info state / 현재 연결 정보 상태 */
  connInfo: ConnectionInfo;
  /** State setter for connection info / 연결 정보 상태 설정자 */
  setConnInfo: React.Dispatch<React.SetStateAction<ConnectionInfo>>;
  /** Available schemas from database / 데이터베이스에서 사용 가능한 스키마 목록 */
  schemas: string[];
  /** Loading state indicator / 로딩 상태 표시 */
  loading: boolean;
  /** Callback to test connection / 연결 테스트 콜백 */
  onTestConnection: () => void;
  /** Callback to fetch objects after connection / 연결 후 객체 조회 콜백 */
  onFetchObjects: () => void;
}

/**
 * Database Connection Step Component
 * Renders a form with input fields for Oracle database connection configuration.
 * Supports both SID and Service Name connection methods.
 * 
 * 데이터베이스 연결 단계 컴포넌트
 * Oracle 데이터베이스 연결 구성을 위한 입력 필드가 있는 양식을 렌더링합니다.
 * SID 및 서비스 이름 연결 방식을 모두 지원합니다.
 * 
 * @param props - Component props / 컴포넌트 props
 * @returns JSX element / JSX 요소
 */
export const ConnectionStep: React.FC<ConnectionStepProps> = ({
  connInfo,
  setConnInfo,
  schemas,
  loading,
  onTestConnection,
  onFetchObjects
}) => {
  /**
   * Handle input field changes and update connection info state.
   * 입력 필드 변경을 처리하고 연결 정보 상태를 업데이트합니다.
   * 
   * @param e - Change event from input element / 입력 요소의 변경 이벤트
   */
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
          <label>Target PostgreSQL Version</label>
          <select 
            name="pgVersion" 
            value={connInfo.pgVersion} 
            onChange={(e) => setConnInfo(prev => ({ ...prev, pgVersion: parseInt(e.target.value) }))}
            className="custom-select"
          >
            <option value="11">PostgreSQL 11</option>
            <option value="12">PostgreSQL 12</option>
            <option value="13">PostgreSQL 13</option>
            <option value="14">PostgreSQL 14</option>
            <option value="15">PostgreSQL 15 (Recommended)</option>
            <option value="16">PostgreSQL 16</option>
          </select>
          <p className="text-xs text-muted mt-1">
            Version for DDL conversion optimization
          </p>
        </div>
        <div></div> {/* Empty cell for grid alignment */}
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
