# Ora2Pg Web Migration Tool

This tool provides a web interface for Ora2Pg based migrations.

## Setup
### Prerequisites
- Python 3.9+
- Node.js 16+
- Docker (for DockerRunner)

### Backend
1. `cd backend`
2. `pip install -r requirements.txt`
3. `uvicorn main:app --port 8000`

### Frontend
1. `cd frontend-app`
2. `npm install`
3. `npm run dev`

## Screenshots / Design

### 1. Connection Setup
![Connection Setup](docs/images/connection_setup.png)

### 2. Object Selection
![Object Selection](docs/images/object_selection.png)

### 3. Execution & Progress
![Migration Progress](docs/images/migration_progress.png)

## Security Note
Passwords are NEVER stored. They are held in memory only for the duration of the migration job.
Data is stored in `backend/work/{jobId}` and can be manually cleared.
