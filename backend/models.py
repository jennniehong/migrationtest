from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from enum import Enum
import uuid
import datetime

# ==========================================
# Enums & Constants
# ==========================================

class JobStatus(str, Enum):
    """
    Enum representing the lifecycle states of a migration job.
    
    마이그레이션 작업의 수명 주기 상태를 나타내는 열거형입니다.
    """
    CREATED = "CREATED"   # Job initialized but not started
    RUNNING = "RUNNING"   # Migration process is active (Docker running)
    DONE = "DONE"         # Migration completed successfully
    FAILED = "FAILED"     # Migration encountered a fatal error
    CANCELED = "CANCELED" # User manually stopped the job

# ==========================================
# Connection Models
# ==========================================

class OracleConnInfo(BaseModel):
    """
    Data model for Oracle Database connection parameters.
    Used for testing connections and configuring Ora2Pg.
    
    오라클 데이터베이스 연결 매개변수를 위한 데이터 모델입니다.
    연결 테스트 및 Ora2Pg 구성에 사용됩니다.
    """
    host: str
    port: int
    user: str
    password: str
    schema_name: str = Field(..., alias="schemaName")
    
    # Optional connection identifiers (SID or Service Name required)
    sid: Optional[str] = None
    service_name: Optional[str] = Field(None, alias="serviceName")
    
    # Advanced options
    use_thick_mode: bool = Field(False, alias="useThickMode") # For Oracle Client libraries
    lib_dir: Optional[str] = Field(None, alias="libDir")      # Path to Instant Client

    class Config:
        populate_by_name = True

# ==========================================
# Job & Object Models
# ==========================================

class OracleObject(BaseModel):
    """
    Represents a single database object to be migrated.
    
    마이그레이션 대상인 단일 데이터베이스 객체를 나타냅니다.
    """
    name: str
    type: str  # e.g., TABLE, VIEW, SEQUENCE, INDEX, TRIGGER, PROCEDURE, FUNCTION

class JobCreateRequest(BaseModel):
    """
    Payload for creating a new migration job.
    
    새로운 마이그레이션 작업을 생성하기 위한 페이로드입니다.
    """
    connection: OracleConnInfo
    objects: List[OracleObject]  # Objects selected by the user
    output_format: str = Field("ZIP", alias="outputFormat") # Desired output format: CSV, SQL

class JobProgress(BaseModel):
    """
    Response model for tracking job status.
    
    작업 상태 추적을 위한 응답 모델입니다.
    """
    job_id: str
    status: JobStatus
    created_at: datetime.datetime
    finished_at: Optional[datetime.datetime] = None
    message: Optional[str] = None
    selected_objects: Optional[List[OracleObject]] = None

class LogEntry(BaseModel):
    """
    Structure for a single log line (not fully used in current file-based logging).
    
    단일 로그 라인을 위한 구조체입니다 (현재 파일 기반 로깅에서는 완전히 사용되지 않음).
    """
    timestamp: datetime.datetime
    level: str
    message: str

# ==========================================
# DDL Comparison Models
# ==========================================

class DDLRequest(BaseModel):
    """
    Request model for fetching DDL of a specific object.
    
    특정 객체의 DDL을 가져오기 위한 요청 모델입니다.
    """
    connection: OracleConnInfo
    object_name: str = Field(..., alias="objectName")
    object_type: str = Field(..., alias="objectType")
    
    class Config:
        populate_by_name = True

class DDLComparison(BaseModel):
    """
    Response model for DDL comparison view.
    
    DDL 비교 뷰를 위한 응답 모델입니다.
    """
    object_name: str = Field(..., alias="objectName")
    object_type: str = Field(..., alias="objectType")
    source_ddl: str = Field(..., alias="sourceDDL")  # Oracle DDL
    converted_ddl: Optional[str] = Field(None, alias="convertedDDL")  # PostgreSQL DDL
    
    class Config:
        populate_by_name = True

# ==========================================
# Data Migration Models
# ==========================================

class DataMigrationRequest(BaseModel):
    """
    Request model for initiating data migration.
    
    데이터 마이그레이션 시작을 위한 요청 모델입니다.
    """
    connection: OracleConnInfo
    tables: List[str]  # List of table names to migrate data
    batch_size: int = 1000  # Number of rows per batch
