"""Toda chamada de rede passa por aqui (facilita testes e controle de ritmo)."""
import threading
import time
from urllib.parse import urlparse

import requests

_lock = threading.Lock()
_last = {}


def _throttle(url, min_interval):
    if not min_interval:
        return
    host = urlparse(url).hostname or ""
    with _lock:
        wait = _last.get(host, 0) + min_interval - time.time()
        _last[host] = max(time.time(), _last.get(host, 0) + min_interval)
    if wait > 0:
        time.sleep(wait)


def get(url, *, headers=None, params=None, timeout=25, allow_redirects=True, min_interval=0.0):
    _throttle(url, min_interval)
    return requests.get(url, headers=headers, params=params, timeout=timeout,
                        allow_redirects=allow_redirects)


def post(url, *, json=None, headers=None, timeout=60):
    return requests.post(url, json=json, headers=headers, timeout=timeout)
