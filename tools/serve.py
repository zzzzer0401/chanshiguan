# 本地预览服务器（禁用缓存，方便改代码后直接刷新）
import http.server, sys, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def log_message(self, *a):
        pass
    # 开发用：保存画布截图（POST /__snap?name=xxx，body 为 dataURL）
    def do_POST(self):
        import base64, urllib.parse
        q = urllib.parse.urlparse(self.path)
        name = urllib.parse.parse_qs(q.query).get('name', ['snap'])[0]
        body = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode()
        data = base64.b64decode(body.split(',', 1)[1])
        out = os.environ.get('SNAP_DIR', '/tmp')
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, name + '.png'), 'wb') as f:
            f.write(data)
        self.send_response(200); self.end_headers(); self.wfile.write(b'ok')
H.extensions_map['.js'] = 'text/javascript'
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
http.server.ThreadingHTTPServer(('127.0.0.1', port), H).serve_forever()
