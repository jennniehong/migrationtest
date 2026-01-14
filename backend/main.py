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

app = FastAPI(title="Oracle to Postgres Migration Tool")

# CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store for PoC
jobs: Dict[str, JobProgress] = {}
job_logs: Dict[str, List[str]] = {}

WORK_DIR = "work"
runner = DockerRunner(WORK_DIR)

@app.on_event("startup")
def startup_event():
    if not os.path.exists(WORK_DIR):
        os.makedirs(WORK_DIR)

@app.post("/api/connections/test")
def test_connection(info: OracleConnInfo):
    try:
        OracleService.test_connection(info)
        return {"status": "success", "message": "Connection successful"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/oracle/objects", response_model=List[OracleObject])
def list_objects(info: OracleConnInfo):
    try:
        return OracleService.list_objects(info)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/oracle/schemas", response_model=List[str])
def list_schemas(info: OracleConnInfo):
    try:
        return OracleService.list_schemas(info)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/jobs")
async def create_job(request: JobCreateRequest, background_tasks: BackgroundTasks):
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
    
    # Create work directory
    job_dir = os.path.join(WORK_DIR, job_id)
    os.makedirs(os.path.join(job_dir, "logs"), exist_ok=True)
    os.makedirs(os.path.join(job_dir, "out"), exist_ok=True)
    os.makedirs(os.path.join(job_dir, "tmp"), exist_ok=True)
    
    def on_log(msg: str):
        job_logs[job_id].append(f"[{datetime.datetime.now()}] {msg}")

    def on_complete(status: JobStatus, message: str):
        jobs[job_id].status = status
        jobs[job_id].finished_at = datetime.datetime.now()
        jobs[job_id].message = message

    # Start background task
    jobs[job_id].status = JobStatus.RUNNING
    background_tasks.add_task(runner.run, job_id, request, on_log, on_complete)
    
    return {"jobId": job_id}

@app.get("/api/jobs", response_model=List[JobProgress])
async def list_jobs():
    # Return jobs sorted by creation time (newest first)
    return sorted(jobs.values(), key=lambda x: x.created_at, reverse=True)

@app.get("/api/jobs/{jobId}", response_model=JobProgress)
async def get_job(jobId: str):
    if jobId not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[jobId]

@app.delete("/api/jobs/{jobId}")
async def delete_job(jobId: str):
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
    if jobId not in job_logs:
        raise HTTPException(status_code=404, detail="Logs not found")
    
    all_logs = job_logs[jobId]
    # Return last 'limit' logs
    return {"logs": all_logs[-limit:] if limit > 0 else all_logs}

@app.post("/api/jobs/{jobId}/cancel")
async def cancel_job(jobId: str):
    if jobId not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Cancel the running process
    runner.cancel_job(jobId)
    jobs[jobId].status = JobStatus.CANCELED
    job_logs[jobId].append(f"[{datetime.datetime.now()}] Job canceled by user.")
    return {"status": "canceled"}

@app.get("/api/jobs/{jobId}/download")
async def download_result(jobId: str):
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
