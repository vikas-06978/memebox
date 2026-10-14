#!/usr/bin/env python3
"""Read-only localhost music-room preview; no dependencies, backend or deployment."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, unquote
import webbrowser

ROOT = (Path(__file__).resolve().parent / 'music-room').resolve()
ALLOWED = {'.html', '.js', '.css', '.json', '.png', '.ico'}

class RoomHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def list_directory(self, path):
        self.send_error(404); return None
    def send_head(self):
        route = unquote(urlsplit(self.path).path)
        if route == '/':
            self.path = '/music-room.html'
            route = '/music-room.html'
        target = (ROOT / route.lstrip('/')).resolve()
        if not target.is_relative_to(ROOT) or target.suffix not in ALLOWED:
            self.send_error(404); return None
        return super().send_head()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; frame-src https://www.youtube-nocookie.com; connect-src 'self' http://127.0.0.1:8789; object-src 'none'; base-uri 'self'")
        super().end_headers()
    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    with ThreadingHTTPServer(('127.0.0.1', 8790), RoomHandler) as server:
        print('MemeBox: http://127.0.0.1:8790/music-room.html', flush=True)
        print('Keep this window open; Ctrl+C stops the preview.', flush=True)
        webbrowser.open('http://127.0.0.1:8790/music-room.html')
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass
