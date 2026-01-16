export interface OracleObject {
  name: string;
  type: string;
}

export interface JobProgress {
  job_id: string;
  status: string;
  created_at: string;
  finished_at?: string;
  message?: string;
  selected_objects?: OracleObject[];
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
