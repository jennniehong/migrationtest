/**
 * @fileoverview Type Definitions for the Migration Tool
 * Defines TypeScript interfaces and types for the entire application.
 * 
 * 마이그레이션 도구를 위한 타입 정의
 * 전체 애플리케이션에 대한 TypeScript 인터페이스와 타입을 정의합니다.
 */

/**
 * Represents an Oracle database object.
 * Oracle 데이터베이스 객체를 나타냅니다.
 */
export interface OracleObject {
  /** Object name / 객체 이름 */
  name: string;
  /** Object type (TABLE, VIEW, PROCEDURE, etc.) / 객체 타입 */
  type: string;
}

/**
 * Job status enumeration.
 * PARTIAL_DONE indicates some objects succeeded and some failed.
 * 
 * 작업 상태 열거형.
 * PARTIAL_DONE은 일부 객체는 성공하고 일부는 실패했음을 나타냅니다.
 */
export type JobStatus = 'CREATED' | 'RUNNING' | 'DONE' | 'PARTIAL_DONE' | 'FAILED' | 'CANCELED';

/**
 * Job progress and status tracking.
 * 작업 진행 상황 및 상태 추적.
 */
export interface JobProgress {
  /** Unique job identifier / 고유 작업 식별자 */
  job_id: string;
  /** Current job status / 현재 작업 상태 */
  status: JobStatus;
  /** Job creation timestamp / 작업 생성 시간 */
  created_at: string;
  /** Job completion timestamp / 작업 완료 시간 */
  finished_at?: string;
  /** Status message / 상태 메시지 */
  message?: string;
  /** List of objects selected for migration / 마이그레이션용으로 선택된 객체 목록 */
  selected_objects?: OracleObject[];
  /** Names of successfully processed objects / 성공적으로 처리된 객체 이름들 */
  completed_objects?: string[];
  /** Names of objects that failed processing / 처리 실패한 객체 이름들 */
  failed_objects?: string[];
  /** Name of object currently being processed / 현재 처리 중인 객체 이름 */
  current_object?: string;
}

/**
 * Oracle database connection configuration.
 * Oracle 데이터베이스 연결 구성.
 */
export interface ConnectionInfo {
  /** Database host address / 데이터베이스 호스트 주소 */
  host: string;
  /** Database port / 데이터베이스 포트 */
  port: number;
  /** Database username / 데이터베이스 사용자 이름 */
  user: string;
  /** Database password / 데이터베이스 비밀번호 */
  password: string;
  /** Schema name to connect to / 연결할 스키마 이름 */
  schemaName: string;
  /** Oracle SID (alternative to serviceName) / Oracle SID */
  sid: string;
  /** Oracle Service Name (alternative to SID) / Oracle 서비스 이름 */
  serviceName: string;
  /** Use thick mode for Oracle connection / Oracle 연결에 thick 모드 사용 */
  useThickMode: boolean;
  /** Oracle client library directory / Oracle 클라이언트 라이브러리 디렉토리 */
  libDir: string;
  /** Target PostgreSQL version (11-16) / 대상 PostgreSQL 버전 */
  pgVersion: number;
}

/**
 * DDL comparison result between Oracle and PostgreSQL.
 * Oracle과 PostgreSQL 간 DDL 비교 결과.
 */
export interface DDLComparison {
  /** Object name being compared / 비교 중인 객체 이름 */
  objectName: string;
  /** Object type (TABLE, VIEW, etc.) / 객체 타입 */
  objectType: string;
  /** Original Oracle DDL / 원본 Oracle DDL */
  sourceDDL: string;
  /** Converted PostgreSQL DDL (null if conversion failed) / 변환된 PostgreSQL DDL */
  convertedDDL: string | null;
}
