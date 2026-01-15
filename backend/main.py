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
    JobStatus, OracleObject, LogEntry
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
    
    # Initialize job state
    job = JobProgress(
        job_id=job_id,
        status=JobStatus.CREATED,
        created_at=datetime.datetime.now(),
        selected_objects=request.objects
    )
    jobs[job_id] = job
    job_logs[job_id] = [f"[{datetime.datetime.now()}] Job created."]
    
    # Create work directory structure
    job_dir = os.path.join(WORK_DIR, job_id)
    os.makedirs(os.path.join(job_dir, "logs"), exist_ok=True)
    os.makedirs(os.path.join(job_dir, "out"), exist_ok=True)
    os.makedirs(os.path.join(job_dir, "tmp"), exist_ok=True)
    
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
        
        작업 완료를 처리하고 상태를 업데이트하기 위한 콜백입니다.
        """
        jobs[job_id].status = status
        jobs[job_id].finished_at = datetime.datetime.now()
        jobs[job_id].message = message

    # Start the runner in the background
    jobs[job_id].status = JobStatus.RUNNING
    background_tasks.add_task(runner.run, job_id, request, on_log, on_complete)
    
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
