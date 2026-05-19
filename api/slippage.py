"""Vercel serverless function: wrap slippage_labs in a POST endpoint."""

from __future__ import annotations

import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

import httpx

from slippage_labs.engine import simulate_buy, solve_max_budget
from slippage_labs.format import MarketSimulation, render_json
from slippage_labs.urls import venue_for
from slippage_labs.venues import (
    MarketNotFoundError,
    Side,
    UnsupportedURLError,
    VenueError,
)

_KALSHI_TICKER_RE = re.compile(r"^[A-Z][A-Z0-9]+(?:-[A-Z0-9]+)+$")


def _normalize_url(raw: str) -> str:
    """Rewrite Kalshi market-page URLs into a bare event ticker.

    Kalshi market URLs look like /markets/{series}/{slug}/{ticker}. The upstream
    adapter scans the whole URL for an uppercase ticker pattern and would
    otherwise latch onto the slug (e.g. 'UFC-FIGHT') before the real ticker.
    """
    try:
        parsed = urlparse(raw)
    except ValueError:
        return raw
    if (parsed.hostname or "").lower() not in ("kalshi.com", "www.kalshi.com"):
        return raw
    segments = [s for s in parsed.path.split("/") if s]
    if not segments:
        return raw
    candidate = segments[-1].upper()
    if _KALSHI_TICKER_RE.fullmatch(candidate):
        return candidate
    return raw


class handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        try:
            length = int(self.headers.get("content-length", 0) or 0)
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self._error(400, "invalid JSON body")

        raw_url = (body.get("url") or "").strip()
        if not raw_url:
            return self._error(400, "missing 'url'")
        url = _normalize_url(raw_url)
        was_normalized = url != raw_url

        try:
            budget = float(body.get("budget", 500))
            if not (budget > 0):
                raise ValueError
        except (TypeError, ValueError):
            return self._error(400, "'budget' must be a positive number")

        threshold = body.get("threshold")
        if threshold is not None:
            try:
                threshold = float(threshold)
                if threshold < 0:
                    raise ValueError
            except (TypeError, ValueError):
                return self._error(400, "'threshold' must be a non-negative number")

        side_choice = (body.get("side") or "both").lower()
        if side_choice not in ("yes", "no", "both"):
            return self._error(400, "'side' must be yes|no|both")
        reference = (body.get("reference") or "mid").lower()
        if reference not in ("mid", "touch"):
            return self._error(400, "'reference' must be mid|touch")

        try:
            venue = venue_for(url)
        except UnsupportedURLError as e:
            return self._error(400, f"unsupported URL: {e}")

        try:
            event = venue.resolve(url)
        except MarketNotFoundError as e:
            msg = str(e)
            if was_normalized:
                msg += (
                    " (Tip: the URL you pasted looks like a specific market — "
                    "try the parent event URL from kalshi.com instead.)"
                )
            return self._error(404, msg)
        except (httpx.HTTPError, VenueError) as e:
            return self._error(502, f"upstream error resolving event: {e}")

        if not event.markets:
            return self._error(404, "event has no markets")

        sides = (
            [Side.YES, Side.NO]
            if side_choice == "both"
            else [Side.YES if side_choice == "yes" else Side.NO]
        )

        market_idx = body.get("market")
        if market_idx is None:
            markets = list(event.markets)
        else:
            try:
                market_idx = int(market_idx)
            except (TypeError, ValueError):
                return self._error(400, "'market' must be an integer index")
            if market_idx < 0 or market_idx >= len(event.markets):
                return self._error(
                    400,
                    f"'market' out of range (event has {len(event.markets)} sub-markets)",
                )
            markets = [event.markets[market_idx]]

        sims: list[MarketSimulation] = []
        skipped: list[dict] = []
        for m in markets:
            for s in sides:
                try:
                    book = venue.fetch_book(m, s)
                except (httpx.HTTPError, VenueError) as e:
                    skipped.append({"market": m.title, "side": s.value, "reason": str(e)})
                    continue
                fill = simulate_buy(book, budget)
                mb = None
                if threshold is not None:
                    try:
                        mb = solve_max_budget(book, threshold, reference=reference)
                    except ValueError:
                        mb = None
                sims.append(
                    MarketSimulation(market=m, side=s, book=book, fill=fill, max_budget=mb)
                )

        if not sims:
            return self._error(502, "no order books could be fetched")

        payload = json.loads(
            render_json(
                sims,
                event,
                budget,
                threshold_pct=threshold,
                reference_kind=reference,
                include_fills=False,
            )
        )
        if skipped:
            payload["skipped"] = skipped

        self._ok(payload)

    def _ok(self, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, code: int, msg: str) -> None:
        body = json.dumps({"error": msg}).encode()
        self.send_response(code)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
