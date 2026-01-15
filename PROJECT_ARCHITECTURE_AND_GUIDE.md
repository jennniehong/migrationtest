# Project Architecture & Technical Guide

This document provides a comprehensive overview of the **Ora2Pg Web Migration Tool** from both Application Architect (AA) and Technical Architect (TA) perspectives. It covers the system's purpose, technical design, internal mechanics, and usage instructions.

---

## 1. Project Overview (AA Perspective)

### 1.1 Purpose & Value Proposition
Allows database administrators and developers to perform Oracle to PostgreSQL migrations via a user-friendly web interface, abstracting the complexity of the command-line `ora2pg` tool.

**Key Goals:**
- **Simplification**: Eliminate the need to manually edit `ora2pg.conf` files.
- **Accessibility**: Provide a GUI for testing connections and selecting specific objects.
- **Automation**: Automate the execution of migration jobs and packaging of results.


### 1.2 User Workflow
The application follows a linear wizard-style process:

1.  **Connection Setup**: User inputs Oracle database credentials (Host, Port, SID/Service, User, Password).
    
    ![Connection Setup](docs/images/connection_setup.png)

2.  **Discovery**: System connects to Oracle to retrieve available schemas and objects (Tables, Views, Functions, etc.).
3.  **Selection**: User filters objects by Type (Multi-select) or Name (Search) and selects objects to migrate.

    ![Object Selection](docs/images/object_selection.png)

4.  **Execution**: System spawns a background job to run `ora2pg` for selected objects.

    ![Migration Progress](docs/images/migration_progress.png)

5.  **Delivery**: User monitors progress in real-time and downloads the generated SQL/Data files as a ZIP package.

---

## 2. Technical Architecture (TA Perspective)

### 2.1 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Frontend** | React 18, TypeScript, Vite | Modern, fast, type-safe UI development. |
| **Backend** | Python 3.9+, FastAPI | High-performance async API, easy integration with system processes. |
| **Runtime** | Docker | Isolates the Perl-based `ora2pg` environment, ensuring consistent execution. |
| **Database** | Oracle Instant Client (Backend) | Used by Python backend for metadata discovery (schemas/objects). |
| **Migration** | Ora2Pg (in Docker) | The core engine performing the actual extraction. |

### 2.2 System Architecture Diagram

```mermaid
graph TD
    User[Web Browser] <-->|HTTP/JSON| Frontend[React App]
    Frontend <-->|REST API| Backend[FastAPI Server]
    
    subgraph "Backend Services"
        Backend -->|Query Metadata| OracleService[Oracle Service]
        Backend -->|Dispatch| JobMgr[Job Manager (In-Memory)]
        JobMgr -->|Spawn| Runner[Docker Runner]
    end
    
    subgraph "Infrastructure"
        Runner -->|Docker Run| Container[Ora2Pg Container]
        Container -->|Read/Write| SharedVol[Shared Work Volume]
    end
    
    subgraph "External Data"
        OracleService -->|SQL*Net| OracleDB[(Oracle Database)]
        Container -->|SQL*Net| OracleDB
    end
```

### 2.3 Data Flow

1.  **Metadata Phase**: 
    -   `OracleService` (Python) connects directly to Oracle using `oracledb` library to fetch lists of tables, views, etc.
    -   No migration happens here; only metadata interrogation.

2.  **Job Execution Phase**:
    -   Frontend submits a `JobCreateRequest` with selected objects.
    -   `DockerRunner` creates a unique workspace (`backend/work/{jobId}`).
    -   It acts as an orchestrator, grouping objects by type (e.g., all TABLEs, all VIEWs).
    -   For each group, it generates a temporary `ora2pg.conf`.
    -   It executes `docker run` to launch the `ora2pg-runner` image, mounting the workspace.
    -   Logs from the container allow real-time feedback.

3.  **Completion Phase**:
    -   Outputs (`.sql` files) are collected in the workspace.
    -   Runner zips the content.
    -   Frontend downloads the ZIP via API.

---

## 3. Core Components & Logic

### 3.1 Backend (`backend/`)

-   **`main.py`**: Entry point. Defines REST endpoints (`/api/*`). Manages Global state for jobs (`jobs` dict).
-   **`runner.py`**: 
    -   **`DockerRunner`**: Core logic class. 
    -   Uses `threading.Lock` to manage concurrency state within a single job (handling cancellation flags).
    -   Uses `subprocess.Popen` to run Docker commands and stream `stdout` for logs.
-   **`oracle_service.py`**: Helper class for direct Oracle interactions (Test connection, List schemas).
-   **`models.py`**: Pydantic models ensuring type safety for API requests/responses.

### 3.2 Frontend (`frontend-app/`)

-   **`App.tsx`**: Main controller managing global state and orchestrating the workflow steps. Refactored from a monolithic component to a modular design.
-   **`components/`**:
    -   **`Sidebar.tsx`**: Manages session history and navigation.
    -   **`ConnectionStep.tsx`**: Handles database connection form and testing.
    -   **`SelectionStep.tsx`**: Manages object filtering and selection logic.
    -   **`MonitorStep.tsx`**: Visualizes migration progress and logs.
    -   `Modal.tsx`: Reusable modal component.
    -   `Toast.tsx`: Toast notification system.
-   **`types.ts`**: Shared TypeScript interfaces.
-   **`vite.config.ts`**: Configuration for the build server.

### 3.3 Infrastructure (`infra/`)

-   **`ora2pg.Dockerfile`**: Defines the migration environment.
    -   Installs Perl, DBI, DBD::Oracle, and non-free Oracle Instant Client libraries.
    -   CMD or Entrypoint is set to run `ora2pg`.

---

## 4. Operational Guide

### 4.1 Prerequisites
-   **Docker Desktop**: Must be running (to execute `ora2pg` containers).
-   **Python 3.9+**: For the backend API.
-   **Node.js 16+**: For the frontend.

### 4.2 Setup & Running

**Step 1: Build Docker Image**
Needed for the actual migration runner.
```bash
cd infra
docker build -t ora2pg-runner -f ora2pg.Dockerfile .
docker images ora2pg-runner
```

**Step 2: Start Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Step 3: Start Frontend**
```bash
cd frontend-app
npm install
npm run dev
```
Access the UI at `http://localhost:5173`.

---

## 5. Security & Scalability

### 5.1 Security Considerations
-   **Credentials**: 
    -   Passed from Frontend to Backend via HTTPS (recommended in prod).
    -   Stored in memory (`jobs` dict) during execution.
    -   Written to temporary file `ora2pg.conf` inside `backend/work/{jobId}`. **Risk**: Admins with server access can read this.
    -   *Mitigation*: The `work` directory should be on an encrypted volume or ephemeral storage.
-   **Validation**: Inputs are validated via Pydantic to prevent injection, though `ora2pg.conf` generation should be carefully monitored.

### 5.2 Scalability & Persistence
-   **Current State**: 
    -   **State**: In-Memory (`jobs` dictionary). If the backend restarts, job history is lost.
    -   **Concurrency**: Uses Python threads (`BackgroundTasks`). CPU-heavy heavy lifting is offloaded to Docker, but the Python process manages the subprocess.
-   **Future & Extension**:
    -   **Persistence**: Replace in-memory dict with SQLite/PostgreSQL database.
    -   **Queueing**: Use Celery/Redis for job queues instead of `BackgroundTasks` to allow horizontal scaling of workers.
    -   **Storage**: Use S3 or Shared NFS for output files instead of local disk for multi-server deployments.

---

## 6. Directory Structure Overview

```text
/
├── backend/            # Python API Server
│   ├── main.py         # Routes & App entry
│   ├── runner.py       # Job orchestration logic
│   ├── work/           # Temp storage for running jobs (GITIGNORED)
│   └── ...
├── frontend-app/       # React Application
│   ├── src/
│   │   ├── App.tsx     # Main Controller
│   │   ├── types.ts    # Shared Types
│   │   └── components/ # UI Components (Sidebar, Steps, etc.)
│   └── ...
├── infra/              # DevOps & Docker
│   ├── ora2pg.Dockerfile # Image definition
│   └── ...
└── README.md           # Quick start
```
