import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

password = "041528"

try:
    # Connect to default postgres database to create tupa_db
    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password=password,
        host="localhost",
        port="5432"
    )
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    
    # Check if database exists
    cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = 'tupa_db'")
    exists = cursor.fetchone()
    if not exists:
        print("Criando banco de dados tupa_db...")
        cursor.execute("CREATE DATABASE tupa_db")
    else:
        print("Banco de dados tupa_db já existe.")
        
    cursor.close()
    conn.close()

    # Connect to tupa_db to create postgis extension
    conn_tupa = psycopg2.connect(
        dbname="tupa_db",
        user="postgres",
        password=password,
        host="localhost",
        port="5432"
    )
    conn_tupa.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor_tupa = conn_tupa.cursor()
    
    print("Ativando extensão PostGIS...")
    cursor_tupa.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    
    cursor_tupa.close()
    conn_tupa.close()
    
    print("Banco configurado com sucesso!")
    
except Exception as e:
    print(f"Erro ao configurar o banco: {e}")
