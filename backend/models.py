from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from enum import Enum
import uuid
import datetime

class JobStatus(str, Enum):
    CREATED = "CREATED"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"
    CANCELED = "CANCELED"

class OracleConnInfo(BaseModel):
    host: str
    port: int
    user: str
    password: str
    schema_name: str = Field(..., alias="schemaName")
    sid: Optional[str] = None
    service_name: Optional[str] = Field(None, alias="serviceName")
    use_thick_mode: bool = Field(False, alias="useThickMode")
    lib_dir: Optional[str] = Field(None, alias="libDir")

    class Config:
        populate_by_name = True

class OracleObject(BaseModel):
    name: str
    type: str  # TABLE, VIEW, SEQUENCE, INDEX, TRIGGER, PROCEDURE, FUNCTION

class JobCreateRequest(BaseModel):
    connection: OracleConnInfo
    objects: List[OracleObject]  # List of objects with names and types
    output_format: str = Field("ZIP", alias="outputFormat") # CSV, SQL, ZIP

class JobProgress(BaseModel):
    job_id: str
    status: JobStatus
    created_at: datetime.datetime
    finished_at: Optional[datetime.datetime] = None
    message: Optional[str] = None
    selected_objects: Optional[List[OracleObject]] = None

class LogEntry(BaseModel):
    timestamp: datetime.datetime
    level: str
    message: str
