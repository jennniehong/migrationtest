import oracledb
import os
import platform
from models import OracleConnInfo, OracleObject
from typing import List

class OracleService:
    """
    Service class responsible for direct interactions with the Oracle Database.
    Handles connection initialization, testing, and metadata retrieval (schemas, objects).
    
    오라클 데이터베이스와의 직접적인 상호작용을 담당하는 서비스 클래스입니다.
    연결 초기화, 테스트 및 메타데이터 검색(스키마, 객체)을 처리합니다.
    """
    _thick_mode_initialized = False

    @classmethod
    def validate_lib_dir(cls, lib_dir: str):
        """
        Validates the provided Instant Client library directory.
        Checks if the directory exists and contains the necessary library files (e.g., oci.dll, libclntsh.so).
        
        제공된 인스턴트 클라이언트 라이브러리 디렉토리의 유효성을 검사합니다.
        디렉토리가 존재하고 필요한 라이브러리 파일(예: oci.dll, libclntsh.so)이 포함되어 있는지 확인합니다.
        """
        if not lib_dir or not os.path.isdir(lib_dir):
            raise ValueError(f"The path '{lib_dir}' is not a valid directory.")
        
        system = platform.system().lower()
        if system == "windows":
            required_file = "oci.dll"
        elif system == "darwin":
            required_file = "libclntsh.dylib"
        else: # Linux and others
            required_file = "libclntsh.so"
            
        # Check if the file exists in the directory (or subdirectories if needed, but usually it's in the root of the path provided)
        # Note: oracledb.init_oracle_client(lib_dir=...) expects the directory containing the libraries.
        file_path = os.path.join(lib_dir, required_file)
        if not os.path.exists(file_path):
            raise ValueError(f"Could not find required Oracle library '{required_file}' in '{lib_dir}'. Please ensure Oracle Instant Client is correctly installed in that location.")

    @classmethod
    def initialize_client(cls, info: OracleConnInfo):
        """
        Initializes the Oracle Instant Client (Thick Mode) if requested.
        This is a global initialization and occurs only once per process.
        
        요청 시 Oracle Instant Client (Thick Mode)를 초기화합니다.
        이는 전역 초기화이며 프로세스당 한 번만 발생합니다.
        """
        if info.use_thick_mode and not cls._thick_mode_initialized:
            try:
                cls.validate_lib_dir(info.lib_dir)
                oracledb.init_oracle_client(lib_dir=info.lib_dir)
                cls._thick_mode_initialized = True
            except Exception as e:
                # Re-raise as a clear message for the UI
                raise Exception(str(e))

    @staticmethod
    def get_connection_string(info: OracleConnInfo) -> str:
        """
        Constructs the Oracle DSN (Data Source Name) string based on SID or Service Name.
        
        SID 또는 서비스 이름을 기반으로 Oracle DSN (데이터 소스 이름) 문자열을 생성합니다.
        """
        if info.sid:
            dsn = oracledb.makedsn(info.host, info.port, sid=info.sid)
        elif info.service_name:
            dsn = oracledb.makedsn(info.host, info.port, service_name=info.service_name)
        else:
            raise ValueError("Either SID or Service Name must be provided")
        return dsn

    @classmethod
    def test_connection(cls, info: OracleConnInfo):
        """
        Tests connectivity to the Oracle Database.
        Returns True if successful, raises Exception if failed.
        
        오라클 데이터베이스에 대한 연결을 테스트합니다.
        성공 시 True를 반환하고, 실패 시 예외를 발생시킵니다.
        """
        cls.initialize_client(info)
        dsn = cls.get_connection_string(info)
        try:
            # Set a timeout (e.g., 10 seconds) to avoid indefinite hanging
            with oracledb.connect(user=info.user, password=info.password, dsn=dsn, tcp_connect_timeout=10) as conn:
                return True
        except Exception as e:
            raise Exception(f"Failed to connect to Oracle: {str(e)}")

    @classmethod
    def list_objects(cls, info: OracleConnInfo) -> List[OracleObject]:
        """
        Retrieves a list of migration-eligible objects (Tables, Views, etc.) from the specified schema.
        First tries ALL_OBJECTS, then falls back to USER_OBJECTS if access is restricted.
        
        지정된 스키마에서 마이그레이션 가능한 객체(테이블, 뷰 등) 목록을 가져옵니다.
        먼저 ALL_OBJECTS를 시도한 다음, 접근이 제한된 경우 USER_OBJECTS로 대체합니다.
        """
        cls.initialize_client(info)
        dsn = cls.get_connection_string(info)
        objects = []
        schema = info.schema_name.upper()
        print(f"DEBUG: Fetching objects for schema: {schema}")
        
        try:
            with oracledb.connect(user=info.user, password=info.password, dsn=dsn) as conn:
                with conn.cursor() as cursor:
                    # 1. Try ALL_OBJECTS with specified schema
                    query = """
                        SELECT object_name, object_type
                        FROM all_objects
                        WHERE owner = :schema_name
                        AND object_type IN ('TABLE', 'VIEW', 'SEQUENCE', 'INDEX', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
                        ORDER BY object_type, object_name
                    """
                    cursor.execute(query, schema_name=schema)
                    for row in cursor:
                        objects.append(OracleObject(name=row[0], type=row[1]))
                    
                    # 2. Fallback to USER_OBJECTS if empty and schema matches user
                    if not objects and schema == info.user.upper():
                        print(f"DEBUG: No objects in ALL_OBJECTS for {schema}, trying USER_OBJECTS...")
                        query_user = """
                            SELECT object_name, object_type
                            FROM user_objects
                            WHERE object_type IN ('TABLE', 'VIEW', 'SEQUENCE', 'INDEX', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'PACKAGE', 'PACKAGE BODY')
                            ORDER BY object_type, object_name
                        """
                        cursor.execute(query_user)
                        for row in cursor:
                            objects.append(OracleObject(name=row[0], type=row[1]))
            
            print(f"DEBUG: Found {len(objects)} objects total.")
        except Exception as e:
            print(f"DEBUG: Error fetching objects: {str(e)}")
            raise Exception(f"Failed to fetch Oracle objects: {str(e)}")
        return objects

    @classmethod
    def list_schemas(cls, info: OracleConnInfo) -> List[str]:
        """
        Lists available schemas (users) in the database, excluding system schemas.
        Useful for populating the Schema dropdown in the UI.
        
        데이터베이스에서 사용 가능한 스키마(사용자)를 나열합니다(시스템 스키마 제외).
        UI에서 스키마 드롭다운을 채우는 데 유용합니다.
        """
        cls.initialize_client(info)
        dsn = cls.get_connection_string(info)
        schemas = []
        try:
            with oracledb.connect(user=info.user, password=info.password, dsn=dsn) as conn:
                with conn.cursor() as cursor:
                    # Fetch users who have objects (schemas)
                    query = """
                        SELECT DISTINCT owner 
                        FROM all_objects 
                        WHERE owner NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'DBSNMP', 'APPQOSSYS', 'CTXSYS', 'XDB', 'WMSYS')
                        ORDER BY owner
                    """
                    cursor.execute(query)
                    for row in cursor:
                        schemas.append(row[0])
        except Exception as e:
            raise Exception(f"Failed to fetch Oracle schemas: {str(e)}")
        return schemas
