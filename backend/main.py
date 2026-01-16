from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict
import uuid
import datetime
import os
import shutil
import zipfile

from models import (
    OracleConnInfo, JobCreateRequest, JobProgress, 
    JobStatus, OracleObject, LogEntry,
    DDLRequest, DDLComparison, DataMigrationRequest
)
from oracle_service import OracleService
from runner import DockerRunner

# ==========================================
# App Initialization
# ==========================================

app = FastAPI(title="Oracle to Postgres Migration Tool")

# CORS setup to allow the frontend (running on different port) to access the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# State Management (In-Memory)
# ==========================================

# Job Store: Keeps track of job status in memory.
# In a production environment, this should be replaced with a database (SQLite/Postgres).
jobs: Dict[str, JobProgress] = {}

# Log Store: Keeps track of logs for each job.
job_logs: Dict[str, List[str]] = {}

WORK_DIR = "work"
runner = DockerRunner(WORK_DIR)

@app.on_event("startup")
def startup_event():
    """
    Ensure the working directory exists on startup.
    
    앱 시작 시 작업 디렉토리가 존재하는지 확인합니다.
    """
    if not os.path.exists(WORK_DIR):
        os.makedirs(WORK_DIR)

# ==========================================
# API Endpoints: Connection & Metadata
# ==========================================

@app.post("/api/connections/test")
def test_connection(info: OracleConnInfo):
    """
    Test connectivity to the Oracle database using provided credentials.
    
    제공된 자격 증명을 사용하여 오라클 데이터베이스 연결을 테스트합니다.
    """
    try:
        OracleService.test_connection(info)
        return {"status": "success", "message": "Connection successful"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/oracle/objects", response_model=List[OracleObject])
def list_objects(info: OracleConnInfo):
    """
    List eligible migration objects (Tables, Views, etc.) from the given schema.
    
    주어진 스키마에서 마이그레이션 가능한 객체(테이블, 뷰 등)를 나열합니다.
    """
    try:
        return OracleService.list_objects(info)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/oracle/schemas", response_model=List[str])
def list_schemas(info: OracleConnInfo):
    """
    List available schemas (users) in the target database.
    
    대상 데이터베이스에서 사용 가능한 스키마(사용자)를 나열합니다.
    """
    try:
        return OracleService.list_schemas(info)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ==========================================
# API Endpoints: Job Management
# ==========================================

@app.post("/api/jobs")
async def create_job(request: JobCreateRequest, background_tasks: BackgroundTasks):
    """
    Create a new migration job.
    Initializes job state and spawns a background task for execution.
    
    새로운 마이그레이션 작업을 생성합니다.
    작업 상태를 초기화하고 실행을 위한 백그라운드 작업을 생성합니다.
    """
    job_id = str(uuid.uuid4())
    
    # Initialize job state in memory (fast)
    job = JobProgress(
        job_id=job_id,
        status=JobStatus.RUNNING,  # Set to RUNNING immediately
        created_at=datetime.datetime.now(),
        selected_objects=request.objects
    )
    jobs[job_id] = job
    job_logs[job_id] = [f"[{datetime.datetime.now()}] Job created."]
    
    # Callback to capture logs from the runner
    def on_log(msg: str):
        """
        Callback to handle log messages from the runner.
        
        러너로부터 로그 메시지를 처리하기 위한 콜백입니다.
        """
        job_logs[job_id].append(f"[{datetime.datetime.now()}] {msg}")

    # Callback to update status on completion
    def on_complete(status: JobStatus, message: str):
        """
        Callback to handle job completion and update status.
        Determines PARTIAL_DONE if some objects failed.
        """
        jobs[job_id].finished_at = datetime.datetime.now()
        jobs[job_id].current_object = None
        
        # Determine final status based on results
        if status == JobStatus.DONE:
            if jobs[job_id].failed_objects:
                if jobs[job_id].completed_objects:
                    jobs[job_id].status = JobStatus.PARTIAL_DONE
                    jobs[job_id].message = f"Completed {len(jobs[job_id].completed_objects)}, Failed {len(jobs[job_id].failed_objects)}"
                else:
                    jobs[job_id].status = JobStatus.FAILED
                    jobs[job_id].message = "All objects failed"
            else:
                jobs[job_id].status = JobStatus.DONE
                jobs[job_id].message = "Success"
        else:
            jobs[job_id].status = status
            jobs[job_id].message = message

    def on_progress(progress_msg: str):
        """
        Callback to handle progress updates for individual objects.
        Supports START:/DONE:/FAIL: prefixes.
        """
        if progress_msg.startswith("START:"):
            jobs[job_id].current_object = progress_msg[6:]
        elif progress_msg.startswith("DONE:"):
            obj_name = progress_msg[5:]
            if obj_name not in jobs[job_id].completed_objects:
                jobs[job_id].completed_objects.append(obj_name)
            if jobs[job_id].current_object == obj_name:
                jobs[job_id].current_object = None
        elif progress_msg.startswith("FAIL:"):
            obj_name = progress_msg[5:]
            if obj_name not in jobs[job_id].failed_objects:
                jobs[job_id].failed_objects.append(obj_name)
            if jobs[job_id].current_object == obj_name:
                jobs[job_id].current_object = None

    # Start the runner in the background (directory creation happens there)
    background_tasks.add_task(runner.run, job_id, request, on_log, on_complete, on_progress)
    
    # Return immediately without waiting for filesystem operations
    return {"jobId": job_id}

@app.get("/api/jobs", response_model=List[JobProgress])
async def list_jobs():
    """
    Get a list of all jobs, sorted by creation date (newest first).
    
    모든 작업 목록을 생성일자 기준 내림차순(최신순)으로 조회합니다.
    """
    return sorted(jobs.values(), key=lambda x: x.created_at, reverse=True)

@app.get("/api/jobs/{jobId}", response_model=JobProgress)
async def get_job(jobId: str):
    """
    Get the status and details of a specific job.
    
    특정 작업의 상태와 상세 정보를 조회합니다.
    """
    if jobId not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[jobId]

@app.delete("/api/jobs/{jobId}")
async def delete_job(jobId: str):
    """
    Delete a job and its associated workspace files.
    Cancels the job first if it is currently running.
    
    작업과 관련 워크스페이스 파일을 삭제합니다.
    작업이 실행 중이라면 먼저 취소합니다.
    """
    if jobId not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Try to cancel if running
    runner.cancel_job(jobId)
    
    # Remove from memory
    del jobs[jobId]
    if jobId in job_logs:
        del job_logs[jobId]
        
    # Remove from disk
    job_dir = os.path.join(WORK_DIR, jobId)
    if os.path.exists(job_dir):
        try:
            shutil.rmtree(job_dir)
        except Exception as e:
            print(f"Error removing directory {job_dir}: {e}")
            
    return {"status": "deleted"}

@app.get("/api/jobs/{jobId}/logs")
async def get_job_logs(jobId: str, limit: int = 1000):
    """
    Get runtime logs for a job.
    
    작업의 실행 로그를 조회합니다.
    """
    if jobId not in job_logs:
        raise HTTPException(status_code=404, detail="Logs not found")
    
    all_logs = job_logs[jobId]
    # Return last 'limit' logs
    return {"logs": all_logs[-limit:] if limit > 0 else all_logs}

@app.post("/api/jobs/{jobId}/cancel")
async def cancel_job(jobId: str):
    """
    Cancel an ongoing job.
    
    진행 중인 작업을 취소합니다.
    """
    if jobId not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Cancel the running process
    runner.cancel_job(jobId)
    jobs[jobId].status = JobStatus.CANCELED
    job_logs[jobId].append(f"[{datetime.datetime.now()}] Job canceled by user.")
    return {"status": "canceled"}

@app.post("/api/jobs/{jobId}/retry")
async def retry_failed_objects(jobId: str, background_tasks: BackgroundTasks):
    """
    Retry migration for failed objects in a job.
    
    작업에서 실패한 객체들에 대해 마이그레이션을 재시도합니다.
    """
    if jobId not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[jobId]
    if not job.failed_objects:
        raise HTTPException(status_code=400, detail="No failed objects to retry")
    
    if job.status == JobStatus.RUNNING:
        raise HTTPException(status_code=400, detail="Job is already running")
    
    # Get the original request info from selected_objects
    if not job.selected_objects:
        raise HTTPException(status_code=400, detail="Cannot retry: original objects not found")
    
    # Filter to only failed objects
    failed_names = set(job.failed_objects)
    retry_objects = [obj for obj in job.selected_objects if obj.name.upper() in failed_names]
    
    if not retry_objects:
        raise HTTPException(status_code=400, detail="Failed objects not found in original selection")
    
    # Reset job state for retry
    job.status = JobStatus.RUNNING
    job.finished_at = None
    job.message = f"Retrying {len(retry_objects)} failed objects..."
    job.current_object = None
    # Move failed to pending, keep completed
    job.failed_objects = []
    
    job_logs[jobId].append(f"[{datetime.datetime.now()}] Retrying {len(retry_objects)} failed objects...")
    
    # We need connection info - this is stored in the original request but not in JobProgress
    # For now, we'll need to get it from the stored session or require it in the request
    # This is a limitation of the current architecture - we don't persist connection info
    # For workaround, we'll return an error suggesting to use the frontend retry flow
    
    # TODO: Implement proper retry by storing connection info in job metadata
    # For now, return the list of failed objects for frontend to handle
    return {
        "status": "retry_initiated",
        "retry_objects": [{"name": obj.name, "type": obj.type} for obj in retry_objects],
        "message": "Please use the frontend to retry with connection info"
    }

# ==========================================
# API Endpoints: DDL Comparison
# ==========================================

@app.post("/api/oracle/ddl", response_model=DDLComparison, response_model_by_alias=True)
async def get_ddl(request: DDLRequest):
    """
    Fetch the Oracle DDL for a specific object.
    
    특정 객체에 대한 오라클 DDL을 가져옵니다.
    """
    try:
        source_ddl = OracleService.get_ddl(
            request.connection, 
            request.object_type, 
            request.object_name
        )
        return DDLComparison(
            object_name=request.object_name,
            object_type=request.object_type,
            source_ddl=source_ddl
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/convert/ddl", response_model=DDLComparison, response_model_by_alias=True)
async def convert_ddl(request: DDLRequest, background_tasks: BackgroundTasks):
    """
    Convert Oracle DDL to PostgreSQL using ora2pg.
    Runs a quick conversion for a single object.
    
    ora2pg를 사용하여 오라클 DDL을 PostgreSQL로 변환합니다.
    단일 객체에 대한 빠른 변환을 실행합니다.
    """
    try:
        # Create temporary job for DDL conversion
        job_id = f"ddl_{uuid.uuid4()}"
        job_dir = os.path.join(WORK_DIR, job_id)
        os.makedirs(job_dir, exist_ok=True)
        
        print(f"[DDL Conversion] Starting conversion for {request.object_type}: {request.object_name}")
        print(f"[DDL Conversion] Working directory: {job_dir}")
        
        # Check if object type is supported by ora2pg
        # INDEX, CONSTRAINT, and some other types are not directly convertible
        unsupported_types = {
            'INDEX': 'Indexes are automatically included when converting their parent TABLE.',
            'CONSTRAINT': 'Constraints are automatically included when converting their parent TABLE.',
            'TRIGGER': 'Note: Trigger syntax may require manual adjustment for PostgreSQL.'
        }
        
        if request.object_type.upper() in unsupported_types:
            # Get source DDL but provide info message for conversion
            source_ddl = OracleService.get_ddl(
                request.connection,
                request.object_type,
                request.object_name
            )
            info_message = unsupported_types[request.object_type.upper()]
            converted_ddl = f"-- {info_message}\n-- Oracle Source DDL is shown in the comparison view.\n-- For INDEX objects, convert the parent TABLE to get all associated indexes."
            
            return DDLComparison(
                object_name=request.object_name,
                object_type=request.object_type,
                source_ddl=source_ddl,
                converted_ddl=converted_ddl
            )
        
        # Create a minimal ora2pg.conf for single object
        config_path = os.path.join(job_dir, "ora2pg.conf")
        with open(config_path, "w") as f:
            dsn = f"dbi:Oracle:host={request.connection.host};sid={request.connection.sid or ''};service_name={request.connection.service_name or ''};port={request.connection.port}"
            f.write(f"ORACLE_DSN {dsn}\n")
            f.write(f"ORACLE_USER {request.connection.user}\n")
            f.write(f"ORACLE_PWD {request.connection.password}\n")
            f.write(f"SCHEMA {request.connection.schema_name}\n")
            f.write(f"TYPE {request.object_type}\n")
            f.write(f"ALLOW {request.object_name}\n")
            f.write(f"OUTPUT {job_id}_converted.sql\n")
            f.write(f"OUTPUT_DIR /data\n")  # Docker internal path
            f.write(f"PG_VERSION {request.connection.pg_version}\n")  # User-selected PostgreSQL version
        
        print(f"[DDL Conversion] ora2pg.conf created")
        
        # Run ora2pg in Docker
        import subprocess
        cmd = [
            "docker", "run", "--rm",
            "-v", f"{os.path.abspath(job_dir)}:/data",
            "ora2pg-runner",
            "ora2pg", "-c", "/data/ora2pg.conf"
        ]
        
        print(f"[DDL Conversion] Running Docker command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        print(f"[DDL Conversion] Docker exit code: {result.returncode}")
        if result.stdout:
            print(f"[DDL Conversion] Docker stdout: {result.stdout}")
        if result.stderr:
            print(f"[DDL Conversion] Docker stderr: {result.stderr}")
        
        # Read converted DDL
        output_file = os.path.join(job_dir, f"{job_id}_converted.sql")
        converted_ddl = ""
        
        if os.path.exists(output_file):
            with open(output_file, "r", encoding='utf-8') as f:
                converted_ddl = f.read()
            print(f"[DDL Conversion] Converted DDL file found, size: {len(converted_ddl)} bytes")
        else:
            print(f"[DDL Conversion] Output file not found: {output_file}")
            print(f"[DDL Conversion] Files in job_dir: {os.listdir(job_dir)}")
        
        # Also fetch source DDL for comparison
        source_ddl = OracleService.get_ddl(
            request.connection,
            request.object_type,
            request.object_name
        )
        
        # Prepare error message if conversion failed
        if not converted_ddl:
            error_msg = "Conversion failed or produced no output."
            if result.returncode != 0:
                error_msg += f"\nDocker exit code: {result.returncode}"
            if result.stderr:
                error_msg += f"\nError: {result.stderr[:500]}"  # First 500 chars
            converted_ddl = error_msg
        
        # Cleanup
        shutil.rmtree(job_dir, ignore_errors=True)
        
        return DDLComparison(
            object_name=request.object_name,
            object_type=request.object_type,
            source_ddl=source_ddl,
            converted_ddl=converted_ddl
        )
    except subprocess.TimeoutExpired:
        print(f"[DDL Conversion] Docker command timed out after 30 seconds")
        raise HTTPException(status_code=500, detail="DDL conversion timed out after 30 seconds")
    except Exception as e:
        print(f"[DDL Conversion] Exception: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"DDL conversion failed: {str(e)}")

# ==========================================
# API Endpoints: Data Migration
# ==========================================

@app.post("/api/jobs/data-migration")
async def create_data_migration_job(request: DataMigrationRequest, background_tasks: BackgroundTasks):
    """
    Create a data migration job for selected tables.
    Similar to regular migration but uses DATA export type.
    
    선택한 테이블에 대한 데이터 마이그레이션 작업을 생성합니다.
    일반 마이그레이션과 유사하지만 DATA 내보내기 유형을 사용합니다.
    """
    job_id = str(uuid.uuid4())
    
    # Initialize job state
    job = JobProgress(
        job_id=job_id,
        status=JobStatus.CREATED,
        created_at=datetime.datetime.now(),
        selected_objects=None  # Tables are in request.tables
    )
    jobs[job_id] = job
    job_logs[job_id] = [f"[{datetime.datetime.now()}] Data migration job created for {len(request.tables)} tables."]
    
    # Create work directory
    job_dir = os.path.join(WORK_DIR, job_id)
    os.makedirs(os.path.join(job_dir, "logs"), exist_ok=True)
    os.makedirs(os.path.join(job_dir, "out"), exist_ok=True)
    
    def on_log(msg: str):
        job_logs[job_id].append(f"[{datetime.datetime.now()}] {msg}")
    
    def on_complete(status: JobStatus, message: str):
        jobs[job_id].finished_at = datetime.datetime.now()
        jobs[job_id].current_object = None
        if status == JobStatus.DONE:
            if jobs[job_id].failed_objects:
                if jobs[job_id].completed_objects:
                    jobs[job_id].status = JobStatus.PARTIAL_DONE
                    jobs[job_id].message = f"Completed {len(jobs[job_id].completed_objects)}, Failed {len(jobs[job_id].failed_objects)}"
                else:
                    jobs[job_id].status = JobStatus.FAILED
                    jobs[job_id].message = "All objects failed"
            else:
                jobs[job_id].status = JobStatus.DONE
                jobs[job_id].message = "Success"
        else:
            jobs[job_id].status = status
            jobs[job_id].message = message

    def on_progress(progress_msg: str):
        if progress_msg.startswith("START:"):
            jobs[job_id].current_object = progress_msg[6:]
        elif progress_msg.startswith("DONE:"):
            obj_name = progress_msg[5:]
            if obj_name not in jobs[job_id].completed_objects:
                jobs[job_id].completed_objects.append(obj_name)
            if jobs[job_id].current_object == obj_name:
                jobs[job_id].current_object = None
        elif progress_msg.startswith("FAIL:"):
            obj_name = progress_msg[5:]
            if obj_name not in jobs[job_id].failed_objects:
                jobs[job_id].failed_objects.append(obj_name)
            if jobs[job_id].current_object == obj_name:
                jobs[job_id].current_object = None
    
    # Start data migration in background
    jobs[job_id].status = JobStatus.RUNNING
    
    # Convert table names to OracleObject format for runner
    table_objects = [OracleObject(name=t, type="TABLE") for t in request.tables]
    
    # Create a modified request that focuses on DATA export
    migration_request = JobCreateRequest(
        connection=request.connection,
        objects=table_objects,
        outputFormat="COPY"  # Use COPY for data migration
    )
    
    def on_progress(obj_name: str):
        if obj_name.startswith("START:"):
            jobs[job_id].current_object = obj_name[6:]
        else:
            if obj_name not in jobs[job_id].completed_objects:
                jobs[job_id].completed_objects.append(obj_name)
            if jobs[job_id].current_object == obj_name:
                jobs[job_id].current_object = None
    
    background_tasks.add_task(runner.run, job_id, migration_request, on_log, on_complete, on_progress)
    
    return {"jobId": job_id}

# ==========================================
# API Endpoints: Downloads
# ==========================================


@app.get("/api/jobs/{jobId}/download")
async def download_result(jobId: str):
    """
    Download the migration results (ZIP file).
    
    마이그레이션 결과(ZIP 파일)를 다운로드합니다.
    """
    if jobId not in jobs or jobs[jobId].status != JobStatus.DONE:
        raise HTTPException(status_code=400, detail="Job not completed or not found")
    
    zip_path = os.path.join(WORK_DIR, jobId, f"result_{jobId}.zip")
    if not os.path.exists(zip_path):
        raise HTTPException(status_code=404, detail="Result file not found")
        
    return FileResponse(
        zip_path, 
        filename=f"migration_result_{jobId}.zip",
        media_type="application/zip"
    )
