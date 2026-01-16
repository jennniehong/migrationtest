export interface OracleObject {
  name: string;
  type: string;
}

export type JobStatus = 'CREATED' | 'RUNNING' | 'DONE' | 'PARTIAL_DONE' | 'FAILED' | 'CANCELED';

export interface JobProgress {
  job_id: string;
  status: JobStatus;
  created_at: string;
  finished_at?: string;
  message?: string;
  selected_objects?: OracleObject[];
  completed_objects?: string[];
  failed_objects?: string[];
  current_object?: string;
}

export interface ConnectionInfo {
  host: string;
  port: number;
  user: string;
  password: string;
  schemaName: string;
  sid: string;
  serviceName: string;
  useThickMode: boolean;
  libDir: string;
  pgVersion: number; // Target PostgreSQL version (11-16)
}

export interface DDLComparison {
  objectName: string;
  objectType: string;
  sourceDDL: string;
  convertedDDL: string | null;
}
