#!/usr/bin/env python3
"""Local development server: serves static files + small JSON APIs."""
import datetime
import decimal
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


def load_env_file(path=".env"):
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            if key and key not in os.environ:
                os.environ[key] = value.strip().strip('"').strip("'")


def env(name, default=""):
    return os.environ.get(name, default).strip()


def json_default(value):
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    if isinstance(value, decimal.Decimal):
        return float(value)
    return str(value)


def require_safe_sql_name(value, label):
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?", value or ""):
        raise ValueError(f"{label} 값이 올바르지 않습니다.")
    return value


def mssql_configured():
    required = ["MSSQL_SERVER", "MSSQL_DATABASE", "MSSQL_USER", "MSSQL_PASSWORD"]
    return all(env(name) for name in required)


def get_mssql_connection():
    if not mssql_configured():
        raise RuntimeError(".env에 MSSQL_SERVER, MSSQL_DATABASE, MSSQL_USER, MSSQL_PASSWORD를 설정해 주세요.")

    client = env("MSSQL_CLIENT", "pymssql").lower()
    if client == "pymssql":
        try:
            import pymssql
        except ImportError as exc:
            raise RuntimeError("pymssql이 설치되지 않았습니다. .venv에서 pip install -r requirements.txt를 실행해 주세요.") from exc
        return pymssql.connect(
            server=env("MSSQL_SERVER"),
            port=int(env("MSSQL_PORT", "1433")),
            database=env("MSSQL_DATABASE"),
            user=env("MSSQL_USER"),
            password=env("MSSQL_PASSWORD"),
            login_timeout=10,
            timeout=30,
            charset="UTF-8",
        )

    try:
        import pyodbc
    except ImportError as exc:
        raise RuntimeError("pyodbc가 설치되지 않았습니다. .venv에서 pip install -r requirements.txt를 실행해 주세요.") from exc

    server = env("MSSQL_SERVER")
    port = env("MSSQL_PORT", "1433")
    driver = env("MSSQL_DRIVER", "ODBC Driver 18 for SQL Server")
    trust = env("MSSQL_TRUST_SERVER_CERTIFICATE", "yes")
    conn_str = (
        f"DRIVER={{{driver}}};"
        f"SERVER={server},{port};"
        f"DATABASE={env('MSSQL_DATABASE')};"
        f"UID={env('MSSQL_USER')};"
        f"PWD={env('MSSQL_PASSWORD')};"
        "Encrypt=yes;"
        f"TrustServerCertificate={trust};"
    )
    return pyodbc.connect(conn_str, timeout=10)


def execute_update_proc(cursor, proc, payload_param, payload_json):
    if env("MSSQL_CLIENT", "pymssql").lower() == "pymssql":
        cursor.execute(f"EXEC {proc} @{payload_param} = %s", (payload_json,))
    else:
        cursor.execute(f"EXEC {proc} @{payload_param} = ?", payload_json)


MEDIA_SELECT_COLUMNS = [
    "a.idx",
    "a.ordering",
    "a.representcompanyname",
    "a.representname",
    "a.saddressinfo",
    "a.latitude",
    "a.longitude",
    "ISNULL(a.panoposition, N'') AS panoposition",
    "a.pickcategory",
    "a.periodcategory",
    "a.costcategory",
    "a.isused",
]

MEDIA_TABLE_COLUMNS = {
    "idx", "ordering", "representcompanyname", "representname", "saddressinfo", "latitude",
    "longitude", "panoposition", "pickcategory", "periodcategory", "costcategory",
    "isused",
}
MEDIA_READONLY_COLUMNS = {"idx"}
MEDIA_SORT_COLUMNS = MEDIA_TABLE_COLUMNS | {"modifydate", "regdate"}


def db_param():
    return "%s" if env("MSSQL_CLIENT", "pymssql").lower() == "pymssql" else "?"


def execute_sql(cursor, sql, params=None):
    cursor.execute(sql, tuple(params or []))


def media_table_name():
    return require_safe_sql_name(env("MSSQL_MEDIA_TABLE", "dbo.TBL_BOMM_INFO"), "매체 테이블")


def sql_sort_expr(sort_by):
    if sort_by in MEDIA_TABLE_COLUMNS:
        return f"a.{sort_by}"
    return "a.representcompanyname"


def normalize_update_value(value):
    if value == "":
        return None
    return value


class ApiHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/geocode/config":
            self._handle_config()
        elif parsed.path == "/api/geocode":
            self._handle_geocode(parsed.query)
        elif parsed.path == "/api/media/config":
            self._handle_media_config()
        elif parsed.path == "/api/media/admin":
            self._handle_media_admin_list(parsed.query)
        elif parsed.path == "/api/health":
            self._send_json({"ok": True})
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/media/admin/update":
            self._handle_media_admin_update()
        else:
            self._send_json({"error": "지원하지 않는 API입니다."}, 404)

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False, default=json_default).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def _handle_config(self):
        client_id = env("NAVER_MAPS_CLIENT_ID")
        client_secret = env("NAVER_MAPS_CLIENT_SECRET")
        self._send_json({"configured": bool(client_id and client_secret)})

    def _handle_geocode(self, query_string):
        params = urllib.parse.parse_qs(query_string)
        query = params.get("query", [""])[0].strip()
        if not query:
            self._send_json({"error": "주소를 입력해 주세요."}, 400)
            return

        client_id = env("NAVER_MAPS_CLIENT_ID")
        client_secret = env("NAVER_MAPS_CLIENT_SECRET")
        if not client_id or not client_secret:
            self._send_json(
                {"error": "NAVER_MAPS_CLIENT_ID 또는 NAVER_MAPS_CLIENT_SECRET 환경 변수가 설정되지 않았습니다."},
                500,
            )
            return

        url = (
            "https://naveropenapi.apigw.ntruss.com/map-geocode/v2/geocode?query="
            + urllib.parse.quote(query)
        )
        req = urllib.request.Request(
            url,
            headers={
                "x-ncp-apigw-api-key-id": client_id,
                "x-ncp-apigw-api-key": client_secret,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            self._send_json(data)
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            try:
                detail = json.loads(body).get("message", "")
            except Exception:
                detail = body[:200]
            self._send_json({"error": f"네이버 API 오류 ({exc.code}): {detail}"}, 502)
        except urllib.error.URLError as exc:
            self._send_json({"error": f"네이버 API 연결 실패: {exc.reason}"}, 502)
        except Exception as exc:
            self._send_json({"error": f"주소 변환 중 오류가 발생했습니다: {exc}"}, 500)

    def _handle_media_config(self):
        self._send_json(
            {
                "configured": mssql_configured(),
                "selectProcedure": "",
                "table": env("MSSQL_MEDIA_TABLE", "dbo.TBL_BOMM_INFO"),
                "updateConfigured": True,
            }
        )

    def _handle_media_admin_list(self, query_string):
        params = urllib.parse.parse_qs(query_string)
        page = max(1, int(params.get("page", ["1"])[0] or "1"))
        page_size = min(100, max(1, int(params.get("pageSize", ["50"])[0] or "50")))
        search = params.get("search", [""])[0].strip().lower()
        sort_by = params.get("sortBy", ["ordering"])[0].strip()
        sort_dir = params.get("sortDir", ["asc"])[0].strip().lower()
        isused = params.get("isused", ["all"])[0].strip()
        isconfirm = params.get("isconfirm", ["all"])[0].strip()
        categoryid = params.get("categoryid", ["all"])[0].strip()
        sort_by = sort_by if sort_by in MEDIA_SORT_COLUMNS else "ordering"
        sort_dir_sql = "DESC" if sort_dir == "desc" else "ASC"
        table = media_table_name()
        marker = db_param()
        where = []
        sql_params = []
        if search:
            search_columns = [
                "a.representcompanyname",
                "a.representname",
                "a.saddressinfo",
                "a.pickcategory",
                "a.periodcategory",
                "a.costcategory",
            ]
            where.append("(" + " OR ".join([f"LOWER(ISNULL({col}, N'')) LIKE {marker}" for col in search_columns]) + ")")
            sql_params.extend([f"%{search}%" for _ in search_columns])
        where.append("a.isused = 1")
        where_sql = "WHERE " + " AND ".join(where) if where else ""
        order_tail = "" if sort_by == "idx" else ", a.idx DESC"
        offset = (page - 1) * page_size
        select_sql = f"""
            SELECT {", ".join(MEDIA_SELECT_COLUMNS)}, COUNT(1) OVER() AS __total
            FROM {table} a WITH(NOLOCK)
            {where_sql}
            ORDER BY {sql_sort_expr(sort_by)} {sort_dir_sql}{order_tail}
            OFFSET {marker} ROWS FETCH NEXT {marker} ROWS ONLY
        """
        try:
            with get_mssql_connection() as conn:
                cursor = conn.cursor()
                execute_sql(cursor, select_sql, [*sql_params, offset, page_size])
                columns = [col[0] for col in cursor.description] if cursor.description else []
                raw_rows = [dict(zip(columns, row)) for row in cursor.fetchall()] if columns else []
            total = int(raw_rows[0].get("__total", 0)) if raw_rows else 0
            columns = [col for col in columns if col != "__total"]
            page_rows = [
                {key: value for key, value in row.items() if key != "__total"}
                for row in raw_rows
            ]
            self._send_json(
                {
                    "columns": columns,
                    "rows": page_rows,
                    "count": len(page_rows),
                    "total": total,
                    "page": page,
                    "pageSize": page_size,
                    "totalPages": max(1, (total + page_size - 1) // page_size),
                }
            )
        except Exception as exc:
            self._send_json({"error": f"매체 목록 조회 실패: {exc}"}, 500)

    def _handle_media_admin_update(self):
        try:
            payload = self._read_json_body()
            key_column = payload.get("keyColumn", "idx")
            if key_column != "idx":
                self._send_json({"error": "idx 기준 수정만 지원합니다."}, 400)
                return

            key_value = payload.get("keyValue")
            updates = payload.get("updates") or {}
            allowed_updates = {
                key: normalize_update_value(value)
                for key, value in updates.items()
                if key in MEDIA_TABLE_COLUMNS and key not in MEDIA_READONLY_COLUMNS
            }
            if not key_value:
                self._send_json({"error": "수정할 idx가 없습니다."}, 400)
                return
            if not allowed_updates:
                self._send_json({"error": "수정 가능한 변경값이 없습니다."}, 400)
                return

            proc = require_safe_sql_name(
                env("MSSQL_MEDIA_UPDATE_PROC", "dbo.tmp_UPD_BOMM_INFO_ADMIN_JSON"),
                "수정 프로시저",
            )
            payload_param = require_safe_sql_name(
                env("MSSQL_MEDIA_UPDATE_PAYLOAD_PARAM", "payloadJson"),
                "수정 파라미터",
            )
            proc_payload = {
                "keyColumn": "idx",
                "keyValue": key_value,
                "updates": allowed_updates,
            }
            payload_json = json.dumps(proc_payload, ensure_ascii=False, default=json_default)
            with get_mssql_connection() as conn:
                cursor = conn.cursor()
                execute_update_proc(cursor, proc, payload_param, payload_json)
                affected = cursor.rowcount
                conn.commit()
            self._send_json({"ok": True, "updated": affected, "columns": list(allowed_updates)})
        except Exception as exc:
            self._send_json({"error": f"매체 정보 수정 실패: {exc}"}, 500)

    def log_message(self, fmt, *args):
        print(f"  [{self.address_string()}] {fmt % args}")


if __name__ == "__main__":
    load_env_file()
    port = int(sys.argv[1]) if len(sys.argv) > 1 else int(env("PORT", "3000"))
    server = ThreadingHTTPServer(("", port), ApiHandler)
    print(f"Serving at http://localhost:{port}")
    print("  Loaded .env if present.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
