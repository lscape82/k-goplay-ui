#!/usr/bin/env python3
"""Local development server: serves static files + proxies /api/geocode to Naver Maps API."""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import HTTPServer, SimpleHTTPRequestHandler


class ApiHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/geocode/config":
            self._handle_config()
        elif parsed.path == "/api/geocode":
            self._handle_geocode(parsed.query)
        else:
            super().do_GET()

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _handle_config(self):
        client_id = os.environ.get("NAVER_MAPS_CLIENT_ID", "")
        client_secret = os.environ.get("NAVER_MAPS_CLIENT_SECRET", "")
        self._send_json({"configured": bool(client_id and client_secret)})

    def _handle_geocode(self, query_string):
        params = urllib.parse.parse_qs(query_string)
        query = params.get("query", [""])[0].strip()
        if not query:
            self._send_json({"error": "주소를 입력해 주세요."}, 400)
            return

        client_id = os.environ.get("NAVER_MAPS_CLIENT_ID", "")
        client_secret = os.environ.get("NAVER_MAPS_CLIENT_SECRET", "")
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

    def log_message(self, fmt, *args):
        print(f"  [{self.address_string()}] {fmt % args}")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    server = HTTPServer(("", port), ApiHandler)
    print(f"Serving at http://localhost:{port}")
    print("  Set NAVER_MAPS_CLIENT_ID and NAVER_MAPS_CLIENT_SECRET to enable geocoding.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
