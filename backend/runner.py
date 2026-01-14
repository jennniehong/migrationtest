import subprocess
import os
import threading
import datetime
import zipfile
from typing import List, Callable
from models import JobStatus, JobCreateRequest

class BaseRunner:
    def run(self, job_id: str, request: JobCreateRequest, on_log: Callable[[str], None], on_complete: Callable[[JobStatus, str], None]):
        pass

class DockerRunner(BaseRunner):
    def __init__(self, work_dir: str):
        self.work_dir = work_dir
        self.active_jobs: Dict[str, dict] = {} # job_id -> {'process': Popen, 'canceled': bool}
        self.lock = threading.Lock()

    def cancel_job(self, job_id: str):
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

    def run(self, job_id: str, request: JobCreateRequest, on_log: Callable[[str], None], on_complete: Callable[[JobStatus, str], None]):
        # Register job start
        with self.lock:
            self.active_jobs[job_id] = {'canceled': False, 'process': None}

        # This will be called in a background thread
        job_dir = os.path.abspath(os.path.join(self.work_dir, job_id))
        out_dir = os.path.join(job_dir, "out")
        conf_path = os.path.join(job_dir, "ora2pg.conf")
        
        try:
            on_log(f"Preparing for job {job_id}...")
            conn = request.connection
            
            # 1. Group objects by type
            from collections import defaultdict
            type_groups = defaultdict(list)
            for obj in request.objects:
                type_groups[obj.type].append(obj.name)
            
            if not type_groups:
                raise Exception("No objects selected for migration.")

            # Ora2Pg DSN
            if conn.sid:
                dsn = f"dbi:Oracle:host={conn.host};sid={conn.sid};port={conn.port}"
            else:
                dsn = f"dbi:Oracle:host={conn.host};service_name={conn.service_name};port={conn.port}"

            for obj_type, names in type_groups.items():
                # Check cancellation before starting next type
                with self.lock:
                    if self.active_jobs[job_id]['canceled']:
                        on_log("Job canceled by user.")
                        on_complete(JobStatus.CANCELED, "Canceled")
                        return

                on_log(f"Processing type: {obj_type} ({len(names)} objects)")
                
                # Mapping Oracle OBJECT_TYPE to Ora2Pg TYPE
                # https://ora2pg.darold.net/documentation.html#TYPE
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
                
                ora2pg_type = type_map.get(obj_type, obj_type)
                
                # 2. Generate temporary ora2pg.conf for this type
                # We use a unique output filename for each type to avoid overwriting (though FILE_PER_TABLE does this anyway)
                config_content = f"""
ORACLE_DSN      {dsn}
ORACLE_USER     {conn.user}
ORACLE_PWD      {conn.password}
SCHEMA          {conn.schema_name}
TYPE            {ora2pg_type}
OUTPUT          {ora2pg_type.lower()}_output.sql
OUTPUT_DIR      /data/out
FILE_PER_TABLE  1
"""
                with open(conf_path, "w") as f:
                    f.write(config_content)

                on_log(f"Starting Ora2Pg Docker for {obj_type} ({ora2pg_type})...")
                
                # 3. Run Ora2Pg via Docker
                cmd = [
                    "docker", "run", "--rm",
                    "-v", f"{job_dir}:/data",
                    "ora2pg-runner",
                    "-c", "/data/ora2pg.conf",
                    "-a", ",".join(names)
                ]

                process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    text=True,
                    bufsize=1
                )

                with self.lock:
                    self.active_jobs[job_id]['process'] = process

                for line in process.stdout:
                    on_log(f"[{obj_type}] {line.strip()}")
                    # Check cancellation during output reading? 
                    # Simpler to rely on Popen.terminate() from cancel_job breaking the pipe or loop eventually
                    
                process.wait()

                with self.lock:
                    self.active_jobs[job_id]['process'] = None
                    if self.active_jobs[job_id]['canceled']:
                        on_log("Job canceled during execution.")
                        on_complete(JobStatus.CANCELED, "Canceled")
                        return

                if process.returncode != 0:
                    on_log(f"Warning: Ora2Pg failed for {obj_type} (Exit: {process.returncode})")

            # 3. Packaging
            on_log("Packaging results into ZIP...")
            zip_path = os.path.join(job_dir, f"result_{job_id}.zip")
            with zipfile.ZipFile(zip_path, 'w') as zipf:
                for root, _, files in os.walk(out_dir):
                    for file in files:
                        file_path = os.path.join(root, file)
                        zipf.write(file_path, os.path.relpath(file_path, out_dir))
            
            on_log(f"Job completed successfully. Result: {zip_path}")
            on_complete(JobStatus.DONE, "Success")
            
        except Exception as e:
            on_log(f"Error: {str(e)}")
            on_complete(JobStatus.FAILED, str(e))
        finally:
             with self.lock:
                if job_id in self.active_jobs:
                    del self.active_jobs[job_id]

class LocalRunner(BaseRunner):
    # Future implementation
    pass
