#!/usr/bin/env python3
"""calibrate_tokenizer.py — OFFLINE per-vendor char->token calibration (C · T-288).

Suggests refined PROVIDER_MULTS for token_estimator.py by measuring REAL
char/token ratios with each vendor's own tokenizer.

OFFLINE-FIRST and OPTIONAL by design:
  - OpenAI: tiktoken (LOCAL, no network) — the only fully-offline path.
  - Anthropic / Google: count_tokens / countTokens are NETWORK APIs — only attempted
    with --network AND a key present in the environment; otherwise skipped.

SAFETY (hard): this is a MANUAL developer tool. It is NEVER wired into a hook or the
live turn path (verify: `grep calibrate_tokenizer .claude/settings.json` -> nothing).
Missing libs/keys => graceful skip + exit 0. No import-or-die, no crash, no network
in the default run. The live hook stays on the static char-mults; any suggestion here
is applied MANUALLY after review — never auto-written.

Usage:
  python3 scripts/calibrate_tokenizer.py            # offline (OpenAI/tiktoken if installed)
  python3 scripts/calibrate_tokenizer.py --network  # also try Anthropic/Google (needs keys)
"""

import argparse
import sys

# Representative samples — Latin + Thai so we calibrate both multipliers.
SAMPLES = {
    "en":   "The quick brown fox jumps over the lazy dog. " * 20,
    "thai": "ระบบการคำนวณโทเคนของแต่ละผู้ให้บริการนั้นแตกต่างกัน " * 20,
}


def _ratio(token_count, text):
    """tokens-per-char (the multiplier token_estimator.py uses)."""
    chars = len(text)
    return round(token_count / chars, 4) if chars else 0.0


def calibrate_openai():
    """OpenAI via tiktoken — fully offline. Returns {'en':r,'thai':r} or None."""
    try:
        import tiktoken
    except ImportError:
        print("  [skip] openai: tiktoken not installed  (pip install tiktoken)")
        return None
    try:
        enc = tiktoken.get_encoding("o200k_base")  # 4o / o-series / 4.1+
        out = {k: _ratio(len(enc.encode(text)), text) for k, text in SAMPLES.items()}
        print(f"  [ok]   openai (o200k_base): en={out['en']} thai={out['thai']} tokens/char")
        return out
    except Exception as e:  # never crash the caller
        print(f"  [skip] openai: tiktoken error ({e.__class__.__name__})")
        return None


def calibrate_network(provider, args):
    """Anthropic count_tokens / Google countTokens — NETWORK, opt-in only.

    Intentionally not auto-wired to a key: this tool must run with no creds present
    (graceful skip). To extend, add the vendor SDK call here guarded by --network and
    an explicit key check; keep it OUT of the live hook.
    """
    if not args.network:
        print(f"  [skip] {provider}: network counter — re-run with --network + API key")
        return None
    print(f"  [skip] {provider}: --network set but no key wired in this env (by design)")
    return None


def main():
    ap = argparse.ArgumentParser(
        description="Offline per-vendor tokenizer calibration (T-288 C · manual dev tool)")
    ap.add_argument("--network", action="store_true",
                    help="Also attempt Anthropic/Google network counters (needs API keys)")
    args = ap.parse_args()

    print("char->token calibration (offline-first · manual dev tool · NOT a hook)")
    results = {}
    r = calibrate_openai()
    if r:
        results["openai"] = r
    for prov in ("anthropic", "google"):
        r = calibrate_network(prov, args)
        if r:
            results[prov] = r

    if not results:
        print("\nno tokenizer available — nothing calibrated.")
        print("install the offline OpenAI path:  pip install tiktoken")
        print("PROVIDER_MULTS in token_estimator.py remain in effect (unchanged).")
        return 0  # graceful — never fail the caller

    print("\nsuggested PROVIDER_MULTS (review, then paste into token_estimator.py if adopting):")
    for prov, m in results.items():
        print(f"  {prov}: en~{m['en']} thai~{m['thai']}  (tokens/char measured)")
    print("\nnote: the live hook stays on static char-mults; apply these MANUALLY after review.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
