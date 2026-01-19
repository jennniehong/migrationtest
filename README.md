# Ora2Pg Web Migration Tool

A modern, user-friendly web interface for Oracle to PostgreSQL database migrations powered by Ora2Pg.

## Features

- **Intuitive 3-Step Workflow**: Connection → Selection → Monitor
- **Light Theme UI**: Clean, professional interface with excellent readability
- **Integrated Data Export**: Configure DDL or data exports directly from the selection screen
- **Real-time Monitoring**: Track migration progress with live logs and status updates
- **Session Management**: Access and review previous migration sessions
- **Flexible Export Options**: Support for SQL (COPY) and CSV formats

## Setup

### Prerequisites
- Python 3.9+
- Node.js 16+
- Docker (for Ora2Pg runner)

### Backend
1. `cd backend`
2. `pip install -r requirements.txt`
3. `uvicorn main:app --reload --port 8080`

### Frontend
1. `cd frontend-app`
2. `npm install`
3. `npm run dev`

Access the application at `http://localhost:5173`

## User Workflow

### 1. Connection Setup
Configure your Oracle database connection with host, port, SID/service name, credentials, and schema.

![Connection Setup](docs/images/connection_setup.png)

### 2. Object Selection
Browse and select database objects (tables, views, procedures, etc.) for migration. Use filters and search to find specific objects.

![Object Selection](docs/images/object_selection.png)

**DDL Migration**: Click "📥 Download DDL" to start schema conversion.

**Data Export**: Click "📊 Prepare Data Export" to expand configuration options:

![Data Export Configuration](docs/images/data_export_config.png)

- Configure batch size and output format (SQL/CSV)
- Select tables for data export
- Start the data export job

### 3. Monitor Progress
Track your migration job in real-time with progress indicators, detailed logs, and execution status.

![Migration Progress](docs/images/migration_progress.png)

- View overall progress and elapsed time
- Monitor individual object status
- Download results as ZIP when complete
- Retry failed objects if needed

## Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Python FastAPI
- **Migration Engine**: Ora2Pg (running in Docker)
- **Styling**: Modern light theme with CSS variables

## Security Note

Passwords are NEVER stored permanently. They are held in memory only for the duration of the migration job.
Job data is stored in `backend/work/{jobId}` and can be manually cleared.

## Documentation

For detailed architecture and technical guide, see:
- [PROJECT_ARCHITECTURE_AND_GUIDE.md](PROJECT_ARCHITECTURE_AND_GUIDE.md) (English)
- [PROJECT_ARCHITECTURE_AND_GUIDE_KR.md](PROJECT_ARCHITECTURE_AND_GUIDE_KR.md) (Korean)
