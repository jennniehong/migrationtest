import subprocess
import os
import threading
import datetime
import zipfile
import time
import re
from typing import List, Callable, Dict
from models import JobStatus, JobCreateRequest

class BaseRunner:
    """
    Abstract base class for migration runners.
    Use DockerRunner for production; LocalRunner could be implemented for direct shell execution.
    
    마이그레이션 실행기를 위한 추상 기본 클래스입니다.
    프로덕션에는 DockerRunner를 사용하십시오. LocalRunner는 셸에서 직접 실행하기 위해 구현될 수 있습니다.
    """
    def run(self, job_id: str, request: JobCreateRequest, on_log: Callable[[str], None], on_complete: Callable[[JobStatus, str], None], on_progress: Callable[[str], None]):
        """
        Executes the migration job.
        
        Args:
            job_id: Unique identifier for the job.
            request: Job parameters including connection and selected objects.
            on_log: Callback to stream log messages to the main application.
            on_complete: Callback to signal job completion or failure.
            
        마이그레이션 작업을 실행합니다.
        
        인자:
            job_id: 작업의 고유 식별자.
            request: 연결 및 선택된 객체를 포함한 작업 매개변수.
            on_log: 메인 애플리케이션으로 로그 메시지를 스트리밍하는 콜백.
            on_complete: 작업 완료 또는 실패를 알리는 콜백.
        """
        pass

class DockerRunner(BaseRunner):
    """
    Executes Ora2Pg migrations using a Docker container.
    This ensures environment isolation and consistent dependency management.
    
    Docker 컨테이너를 사용하여 Ora2Pg 마이그레이션을 실행합니다.
    이를 통해 환경 격리 및 일관된 의존성 관리를 보장합니다.
    """
    def __init__(self, work_dir: str):
        self.work_dir = work_dir
        # Tracks active subprocesses for cancellation support
        self.active_jobs: Dict[str, dict] = {} # job_id -> {'process': Popen, 'canceled': bool}
        self.lock = threading.Lock()

    def cancel_job(self, job_id: str):
        """
        Terminates a running job by sending SIGTERM/SIGKILL to the underlying subprocess.
        
        실행 중인 작업을 하위 프로세스에 SIGTERM/SIGKILL을 전송하여 종료합니다.
        """
        with self.lock:
            if job_id in self.active_jobs:
                self.active_jobs[job_id]['canceled'] = True
                proc = self.active_jobs[job_id].get('process')
                if proc and proc.poll() is None:
                    # In Windows, we might need taskkill if docker run doesn't handle sigterm well
                    # But Popen.terminate() usually works for the python wrapper
                    proc.terminate() 
                    try:
                        proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        proc.kill()

    def run(self, job_id: str, request: JobCreateRequest, on_log: Callable[[str], None], on_complete: Callable[[JobStatus, str], None], on_progress: Callable[[str], None]):
        """
        Orchestrates the migration workflow:
        1. Prepare configurations.
        2. Run Ora2Pg (via Docker) for each object type.
        3. Package output files into a ZIP.
        
        마이그레이션 워크플로우를 조정합니다:
        1. 설정을 준비합니다.
        2. 각 객체 유형에 대해 Ora2Pg를 실행합니다 (Docker를 통해).
        3. 결과 파일을 ZIP으로 패키징합니다.
        """
        # Register job start
        with self.lock:
            self.active_jobs[job_id] = {'canceled': False, 'process': None}

        # This will be called in a background thread
        job_dir = os.path.abspath(os.path.join(self.work_dir, job_id))
        out_dir = os.path.join(job_dir, "out")
        conf_path = os.path.join(job_dir, "ora2pg.conf")
        
        try:
            on_log(f"Preparing for job {job_id}...")
            
            # Create work directory structure (moved from main.py)
            os.makedirs(os.path.join(job_dir, "logs"), exist_ok=True)
            os.makedirs(os.path.join(job_dir, "out"), exist_ok=True)
            os.makedirs(os.path.join(job_dir, "tmp"), exist_ok=True)
            on_log("Work directories created.")
            
            conn = request.connection
            
            # Ora2Pg DSN Construction
            if conn.sid:
                dsn = f"dbi:Oracle:host={conn.host};sid={conn.sid};port={conn.port}"
            else:
                dsn = f"dbi:Oracle:host={conn.host};service_name={conn.service_name};port={conn.port}"

            # Mapping Oracle OBJECT_TYPE to Ora2Pg TYPE
            type_map = {
                'TABLE': 'TABLE',
                'VIEW': 'VIEW',
                'SEQUENCE': 'SEQUENCE',
                'INDEX': 'INDEX',
                'TRIGGER': 'TRIGGER',
                'FUNCTION': 'FUNCTION',
                'PROCEDURE': 'PROCEDURE',
                'PACKAGE': 'PACKAGE',
                'PACKAGE BODY': 'PACKAGE'
            }
            
            # Determine if this is a data export (COPY/CSV) or DDL export
            is_data_export = request.output_format in ["COPY", "CSV"]
            
            # Determine extension
            ext = ".sql"
            if request.output_format == "CSV":
                ext = ".csv"

            total_objects = len(request.objects)
            if total_objects == 0:
                raise Exception("No objects selected for migration.")

            # Process each object individually for real-time tracking
            for idx, obj in enumerate(request.objects):
                obj_name = obj.name
                obj_type = obj.type
                
                # For data export, use COPY type; for DDL, use object type
                if is_data_export:
                    ora2pg_type = "COPY"
                else:
                    ora2pg_type = type_map.get(obj_type, obj_type)
                
                # Check cancellation before each object
                with self.lock:
                    if self.active_jobs[job_id]['canceled']:
                        on_log("Job canceled by user.")
                        on_complete(JobStatus.CANCELED, "Canceled")
                        return

                export_type_label = "data" if is_data_export else "DDL"
                on_log(f"[{idx+1}/{total_objects}] Exporting {export_type_label} for {obj_type}: {obj_name}")
                on_progress(f"START:{obj_name}")

                # Generate ora2pg.conf for this specific object
                # For CSV export, we need to add DATA_TYPE CSV
                data_type_cfg = "DATA_TYPE       CSV" if request.output_format == "CSV" else ""

                config_content = f"""
ORACLE_DSN      {dsn}
ORACLE_USER     {conn.user}
ORACLE_PWD      {conn.password}
SCHEMA          {conn.schema_name}
TYPE            {ora2pg_type}
ALLOW           {obj_name}
CLIENT_ENCODING UTF8
BINMODE         :utf8
{data_type_cfg}
OUTPUT          {obj_name.lower()}{ext}
OUTPUT_DIR      /data/out
FILE_PER_TABLE  1
"""
                with open(conf_path, "w") as f:
                    f.write(config_content)

                # Run Ora2Pg via Docker for this single object
                # We set NLS_LANG to ensure Oracle client handles UTF-8 correctly
                cmd = [
                    "docker", "run", "--rm",
                    "-e", "NLS_LANG=AMERICAN_AMERICA.AL32UTF8",
                    "-v", f"{job_dir}:/data",
                    "ora2pg-runner",
                    "-c", "/data/ora2pg.conf"
                ]

                # Start process ensuring output can be captured
                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1
                )

                with self.lock:
                    self.active_jobs[job_id]['process'] = process

                # Stream logs line by line
                for line in process.stdout:
                    stripped_line = line.strip()
                    on_log(f"  {stripped_line}")
                    
                process.wait()

                # Clean up process handle
                with self.lock:
                    self.active_jobs[job_id]['process'] = None
                    if self.active_jobs[job_id]['canceled']:
                        on_log("Job canceled during execution.")
                        on_complete(JobStatus.CANCELED, "Canceled")
                        return

                # Report success or failure for this specific object
                if process.returncode == 0:
                    on_log(f"  ✓ {obj_name} completed successfully")
                    on_progress(f"DONE:{obj_name}")
                else:
                    on_log(f"  ✗ {obj_name} failed (Exit: {process.returncode})")
                    on_progress(f"FAIL:{obj_name}")

            # Packaging results
            on_log("Packaging results into ZIP...")
            zip_path = os.path.join(job_dir, f"result_{job_id}.zip")
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for root, _, files in os.walk(out_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        zipf.write(file_path, os.path.relpath(file_path, out_dir))
            
            on_log(f"Job finished. Result: {zip_path}")
            # Final status is determined by main.py based on completed_objects vs failed_objects
            on_complete(JobStatus.DONE, "Finished")
            
        except Exception as e:
            on_log(f"Error: {str(e)}")
            on_complete(JobStatus.FAILED, str(e))
        finally:
             # Ensure job is removed from active registry
             with self.lock:
                if job_id in self.active_jobs:
                    del self.active_jobs[job_id]

class LocalRunner(BaseRunner):
    # Future implementation for environments without Docker
    pass
