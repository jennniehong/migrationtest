import oracledb
import os
import platform
from models import OracleConnInfo, OracleObject
from typing import List

class OracleService:
    _thick_mode_initialized = False

    @classmethod
    def validate_lib_dir(cls, lib_dir: str):
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
        if info.sid:
            dsn = oracledb.makedsn(info.host, info.port, sid=info.sid)
        elif info.service_name:
            dsn = oracledb.makedsn(info.host, info.port, service_name=info.service_name)
        else:
            raise ValueError("Either SID or Service Name must be provided")
        return dsn

    @classmethod
    def test_connection(cls, info: OracleConnInfo):
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
