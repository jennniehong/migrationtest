# 프로덕션 배포 가이드

이 가이드는 Linux 7 운영 서버에 Ora2Pg 웹 마이그레이션 도구를 배포하는 방법을 설명합니다.

## 목차
1. [사전 준비](#사전-준비)
2. [PostgreSQL 14+ 설치](#postgresql-14-설치)
3. [애플리케이션 배포](#애플리케이션-배포)
4. [검증 및 문제 해결](#검증-및-문제-해결)

---

## 사전 준비

### 필수 소프트웨어
- **Docker** 및 **Docker Compose**
- **Git** (소스 코드 다운로드용)
- **Root 또는 sudo 권한**

### Docker 설치 (Linux 7)
```bash
# Docker 저장소 추가
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Docker 설치
sudo yum install -y docker-ce docker-ce-cli containerd.io

# Docker 시작 및 활성화
sudo systemctl start docker
sudo systemctl enable docker

# 현재 사용자를 docker 그룹에 추가 (선택사항)
sudo usermod -aG docker $USER
```

### Docker Compose 설치
```bash
# Docker Compose 다운로드
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 실행 권한 부여
sudo chmod +x /usr/local/bin/docker-compose

# 설치 확인
docker-compose --version
```

---

## PostgreSQL 14+ 설치

운영 환경에서 PostgreSQL을 설치하는 두 가지 방법을 제공합니다.

### 옵션 1: Native 설치 (프로덕션 권장)

#### 1단계: PostgreSQL 공식 저장소 추가
```bash
# 저장소 RPM 설치
sudo yum install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# 기본 PostgreSQL 모듈 비활성화
sudo yum -qy module disable postgresql
```

#### 2단계: PostgreSQL 14 설치
```bash
# PostgreSQL 14 서버 및 클라이언트 설치
sudo yum install -y postgresql14-server postgresql14

# 데이터베이스 초기화
sudo /usr/pgsql-14/bin/postgresql-14-setup initdb

# 서비스 활성화 및 시작
sudo systemctl enable postgresql-14
sudo systemctl start postgresql-14

# 상태 확인
sudo systemctl status postgresql-14
```

#### 3단계: PostgreSQL 구성
```bash
# 네트워크 연결 허용 설정
sudo vi /var/lib/pgsql/14/data/postgresql.conf
# 다음 줄을 찾아서 주석 해제 및 수정:
# listen_addresses = '*'

# 비밀번호 인증 허용 설정
sudo vi /var/lib/pgsql/14/data/pg_hba.conf
# 파일 끝에 다음 줄 추가:
# host    all             all             0.0.0.0/0               md5

# PostgreSQL 재시작
sudo systemctl restart postgresql-14
```

#### 4단계: 마이그레이션 사용자 및 데이터베이스 생성
```bash
# postgres 사용자로 전환
sudo -u postgres psql

# psql 내에서 실행:
CREATE USER migration_user WITH PASSWORD 'secure_password';
CREATE DATABASE migration_db OWNER migration_user;
GRANT ALL PRIVILEGES ON DATABASE migration_db TO migration_user;
\q
```

#### 5단계: 방화벽 설정
```bash
# PostgreSQL 포트(5432) 허용
sudo firewall-cmd --permanent --add-port=5432/tcp
sudo firewall-cmd --reload

# 방화벽 규칙 확인
sudo firewall-cmd --list-ports
```

### 옵션 2: Docker 기반 PostgreSQL (간편 설치)

`docker-compose.yml` 파일의 주석 처리된 PostgreSQL 서비스를 활성화하세요:

```yaml
  postgres:
    image: postgres:14
    container_name: migration-postgres
    environment:
      POSTGRES_USER: migration_user
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: migration_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    networks:
      - migration-network
    restart: unless-stopped

volumes:
  postgres_data:
```

---

## 애플리케이션 배포

### 1단계: 소스 코드 다운로드
```bash
# 프로젝트 디렉토리로 이동
cd /opt
sudo git clone <repository-url> dbMigration
cd dbMigration
```

### 2단계: Ora2Pg 이미지 빌드
```bash
# infra 디렉토리로 이동
cd infra

# ora2pg-runner 이미지 빌드
sudo docker build -t ora2pg-runner -f ora2pg.Dockerfile .

# 빌드 확인
sudo docker images | grep ora2pg-runner
```

### 3단계: 애플리케이션 빌드 및 실행
```bash
# 프로젝트 루트로 이동
cd /opt/dbMigration

# 모든 서비스 빌드
sudo docker-compose build

# 백그라운드에서 서비스 시작
sudo docker-compose up -d

# 실행 중인 컨테이너 확인
sudo docker-compose ps
```

### 4단계: 로그 확인
```bash
# 모든 서비스 로그 확인
sudo docker-compose logs -f

# 특정 서비스 로그 확인
sudo docker-compose logs -f backend
sudo docker-compose logs -f frontend
```

### 5단계: 웹 인터페이스 접속
브라우저에서 다음 주소로 접속:
- **프론트엔드**: `http://<서버-IP>`
- **백엔드 API**: `http://<서버-IP>:8000/docs` (Swagger UI)

---

## 검증 및 문제 해결

### PostgreSQL 연결 테스트

**Native 설치:**
```bash
psql -h localhost -U migration_user -d migration_db
# 비밀번호 입력 후 연결 성공 확인
```

**Docker 설치:**
```bash
docker exec -it migration-postgres psql -U migration_user -d migration_db
```

**PostgreSQL 버전 확인:**
```sql
SELECT version();
-- PostgreSQL 14.x가 표시되어야 함
```

### 애플리케이션 상태 확인
```bash
# 모든 컨테이너가 실행 중인지 확인
sudo docker-compose ps

# 백엔드 헬스 체크
curl http://localhost:8000/api/health

# 프론트엔드 접속 확인
curl http://localhost/
```

### 일반적인 문제 해결

#### 1. 컨테이너가 시작되지 않음
```bash
# 로그 확인
sudo docker-compose logs backend
sudo docker-compose logs frontend

# 컨테이너 재시작
sudo docker-compose restart
```

#### 2. Backend에서 ora2pg 컨테이너 실행 실패
```bash
# Docker 소켓 권한 확인
ls -l /var/run/docker.sock

# backend 컨테이너 내부에서 Docker 명령 테스트
sudo docker exec -it migration-backend docker ps
```

#### 3. PostgreSQL 연결 실패
```bash
# PostgreSQL 서비스 상태 확인
sudo systemctl status postgresql-14

# 로그 확인
sudo tail -f /var/lib/pgsql/14/data/log/postgresql-*.log

# 방화벽 확인
sudo firewall-cmd --list-all
```

#### 4. 포트 충돌
```bash
# 사용 중인 포트 확인
sudo netstat -tulpn | grep -E ':(80|8000|5432)'

# docker-compose.yml에서 포트 변경
# 예: "8080:80" (호스트 포트 80 대신 8080 사용)
```

### 서비스 관리 명령어

```bash
# 서비스 시작
sudo docker-compose up -d

# 서비스 중지
sudo docker-compose down

# 서비스 재시작
sudo docker-compose restart

# 볼륨 포함 완전 삭제 (주의: 데이터 손실)
sudo docker-compose down -v

# 이미지 재빌드 및 시작
sudo docker-compose up -d --build
```

### 로그 및 데이터 위치

- **백엔드 작업 디렉토리**: `./backend/work/`
- **PostgreSQL 데이터** (Docker): Docker 볼륨 `postgres_data`
- **PostgreSQL 데이터** (Native): `/var/lib/pgsql/14/data/`
- **컨테이너 로그**: `sudo docker-compose logs`

---

## 보안 권장사항

1. **비밀번호 변경**: `docker-compose.yml`의 기본 비밀번호를 강력한 비밀번호로 변경하세요.
2. **방화벽 설정**: 필요한 포트만 개방하세요.
3. **HTTPS 설정**: 프로덕션 환경에서는 Nginx에 SSL 인증서를 적용하세요.
4. **정기 백업**: PostgreSQL 데이터베이스와 작업 디렉토리를 정기적으로 백업하세요.

```bash
# PostgreSQL 백업 예시
sudo -u postgres pg_dump migration_db > backup_$(date +%Y%m%d).sql
```

---

## 추가 리소스

- [Docker 공식 문서](https://docs.docker.com/)
- [PostgreSQL 공식 문서](https://www.postgresql.org/docs/14/)
- [Ora2Pg 공식 문서](https://ora2pg.darold.net/)
