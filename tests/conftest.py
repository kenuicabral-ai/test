import os
import re
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from radar import db, sources  # noqa: E402


@pytest.fixture
def con():
    c = db.connect(":memory:")
    yield c
    c.close()


@pytest.fixture(autouse=True)
def reset_breakers():
    sources.BREAKER.update(urlscan=False, crtsh_fail=0, crtsh_kw_fail=0)
    sources.QUOTA.update(checked=False, left=None, used=0, cap=None)
    yield


class Resp:
    def __init__(self, status, data=None, headers=None):
        self.status_code, self._data, self.headers = status, data, headers or {}
        self.text = str(data)

    def json(self):
        return self._data


class FakeUrlscan:
    """Imita a busca do urlscan: ordem do mais recente, faixa de data e página máxima."""

    def __init__(self, scans, page_max=100, quota=1000):
        self.scans = sorted(scans, key=lambda s: s["task"]["time"], reverse=True)
        self.page_max, self.quota, self.calls = page_max, quota, []

    def _match(self, q, s):
        page = s["page"]
        m = re.match(r'page\.(domain|ip):\((.*)\)$', q)
        if m:
            vals = re.findall(r'"([^"]+)"', m.group(2))
            v = page[m.group(1)]
            return any(v == x or (m.group(1) == "domain" and v.endswith("." + x)) for x in vals)
        kind, _, val = q.partition(":")
        return val.strip('"') in s.get("loads", ())

    def get(self, url, headers=None, params=None, **kw):
        if url.endswith("/user/quotas/"):
            left = self.quota
            return Resp(200, {"limits": {"search": {"day": {"remaining": left, "limit": left},
                                                     "hour": {"remaining": left, "limit": left}}}})
        q = params["q"]
        self.calls.append(q)
        lo, hi, incl = "", "9999", True
        m = re.search(r" AND date:\[(\S+) TO (\S+?)([\]}])$", q)
        if m:
            q = q[:m.start()]
            lo = "" if m.group(1) == "*" else m.group(1)
            hi = "9999" if m.group(2) == "now" else m.group(2)
            incl = m.group(3) == "]"
        hits = [s for s in self.scans if self._match(q, s)
                and s["task"]["time"] >= lo and (s["task"]["time"] <= hi if incl else s["task"]["time"] < hi)]
        size = min(params["size"], self.page_max)
        return Resp(200, {"results": hits[:size], "total": len(hits)})


def scan(domain, time, loads=(), ip="10.0.0.1", age=None):
    page = {"domain": domain, "ip": ip}
    if age is not None:
        page["apexDomainAgeDays"] = age
    return {"task": {"time": time}, "page": page, "loads": set(loads)}
