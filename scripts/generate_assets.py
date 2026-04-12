#!/usr/bin/env python3
"""
Lobby Market asset generator via Comfy Cloud (SD1.5 / Dreamshaper 8).

Generates brand/marketing assets for the web app + iOS app + landing page.

Usage:
    python3 scripts/generate_assets.py              # generate all assets
    python3 scripts/generate_assets.py logo-mark    # generate specific assets
"""

import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("pip install requests")

# -------- config -----------------------------------------------------------

API_KEY = "comfyui-1ac6be5eb6ba8e8accc972fa0ca794e29bece9783411d69ea3b5b29ea5334508"
BASE = "https://cloud.comfy.org"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

ASSETS_DIR = Path("/home/loren/consensus-app/public/assets")
ASSETS_DIR.mkdir(parents=True, exist_ok=True)

MAX_CONCURRENT = 3


# -------- workflow builder -------------------------------------------------

def sd15_workflow(
    prompt: str,
    negative: str,
    width: int,
    height: int,
    seed: int,
    filename_prefix: str,
    steps: int = 28,
    cfg: float = 7.0,
):
    """SD1.5 Dreamshaper 8 text-to-image workflow."""
    return {
        "1": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": "dreamshaper_8.safetensors"},
        },
        "2": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["1", 1]},
        },
        "3": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": negative, "clip": ["1", 1]},
        },
        "4": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": width, "height": height, "batch_size": 1},
        },
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
                "seed": seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0,
            },
        },
        "6": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
        },
        "7": {
            "class_type": "SaveImage",
            "inputs": {"images": ["6", 0], "filename_prefix": filename_prefix},
        },
    }


# -------- api helpers ------------------------------------------------------

def submit(workflow: dict) -> str:
    r = requests.post(
        f"{BASE}/api/prompt",
        headers=HEADERS,
        json={"prompt": workflow},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["prompt_id"]


def poll(pid: str, timeout: int = 300) -> dict:
    t0 = time.time()
    while time.time() - t0 < timeout:
        r = requests.get(
            f"{BASE}/api/job/{pid}/status",
            headers={"X-API-Key": API_KEY},
            timeout=10,
        )
        if r.status_code == 200:
            d = r.json()
            status = d.get("status")
            if status in ("success", "error", "failed"):
                return d
        time.sleep(3)
    return {"status": "timeout"}


def download_output(pid: str, dest: Path) -> bool:
    """Fetch history scoped to the specific prompt_id."""
    r = requests.get(
        f"{BASE}/api/history_v2",
        params={"prompt_id": pid},
        headers={"X-API-Key": API_KEY},
        timeout=15,
    )
    r.raise_for_status()
    hist = r.json()
    entries = hist.get("history", []) if isinstance(hist, dict) else hist

    for entry in entries:
        if not isinstance(entry, dict):
            continue
        if entry.get("prompt_id") != pid:
            continue
        for _nid, nout in entry.get("outputs", {}).items():
            for img in nout.get("images", []):
                fn = img["filename"]
                sub = img.get("subfolder", "")
                typ = img.get("type", "output")
                dr = requests.get(
                    f"{BASE}/api/view",
                    params={"filename": fn, "subfolder": sub, "type": typ},
                    headers={"X-API-Key": API_KEY},
                    timeout=60,
                )
                dr.raise_for_status()
                dest.write_bytes(dr.content)
                return True
    return False


# -------- prompt defaults --------------------------------------------------

BASE_NEGATIVE = (
    "blurry, low quality, ugly, deformed, watermark, signature, text, "
    "extra limbs, bad anatomy, noisy, pixelated, jpeg artifacts"
)


# -------- asset catalog ----------------------------------------------------

ASSETS = [
    # --- brand / logo ---
    {
        "name": "logo-mark",
        "prompt": (
            "minimalist geometric logo emblem, gold parliament dome silhouette "
            "inside an ornate circular laurel wreath, pure black background, "
            "clean vector art, symmetric, iconic, heraldic, premium branding"
        ),
        "width": 1024,
        "height": 1024,
    },
    {
        "name": "hero-chamber",
        "prompt": (
            "cinematic wide shot of an empty grand parliamentary chamber interior, "
            "semicircular hemicycle, polished dark marble floor, rows of empty wooden seats, "
            "dramatic volumetric lighting, deep blue cold light from left, deep red warm light from right, "
            "dust motes in light rays, gold accents, moody atmospheric, photorealistic, 8k, concept art, "
            "wide angle shot"
        ),
        "width": 1344,
        "height": 768,
    },
    # --- law seal ---
    {
        "name": "law-seal",
        "prompt": (
            "ornate official seal emblem, gold gavel crossed over a scroll, "
            "laurel wreath border, blue and red ribbon draped below, "
            "deep black background, premium government document aesthetic, "
            "highly detailed heraldic design, ultra sharp, centered, symmetric"
        ),
        "width": 1024,
        "height": 1024,
    },
    # --- category icons ---
    {
        "name": "category-politics",
        "prompt": (
            "minimalist flat icon, white capitol dome silhouette, "
            "pure black background, clean vector art, gold accent, "
            "simple geometric, centered, iconic"
        ),
        "width": 512,
        "height": 512,
    },
    {
        "name": "category-technology",
        "prompt": (
            "minimalist flat icon, white circuit chip silhouette with subtle traces, "
            "pure black background, clean vector art, blue accent glow, "
            "simple geometric, centered, iconic"
        ),
        "width": 512,
        "height": 512,
    },
    {
        "name": "category-ethics",
        "prompt": (
            "minimalist flat icon, white balanced scales of justice, "
            "pure black background, clean vector art, gold accent, "
            "simple geometric, symmetric, centered, iconic"
        ),
        "width": 512,
        "height": 512,
    },
    {
        "name": "category-culture",
        "prompt": (
            "minimalist flat icon, white theater masks comedy and tragedy, "
            "pure black background, clean vector art, purple accent, "
            "simple geometric, centered, iconic"
        ),
        "width": 512,
        "height": 512,
    },
    {
        "name": "category-economics",
        "prompt": (
            "minimalist flat icon, white ascending line chart with bars, "
            "pure black background, clean vector art, green accent, "
            "simple geometric, centered, iconic"
        ),
        "width": 512,
        "height": 512,
    },
    {
        "name": "category-science",
        "prompt": (
            "minimalist flat icon, white atom with orbital rings, "
            "pure black background, clean vector art, cyan accent glow, "
            "simple geometric, symmetric, centered, iconic"
        ),
        "width": 512,
        "height": 512,
    },
    # --- role badges ---
    {
        "name": "role-debator",
        "prompt": (
            "ornate medal badge emblem, silver microphone centered, "
            "blue silk ribbon draped, pure black background, "
            "premium gamification achievement badge, heraldic, highly detailed, "
            "centered, symmetric"
        ),
        "width": 768,
        "height": 768,
    },
    {
        "name": "role-troll-catcher",
        "prompt": (
            "ornate medal badge emblem, silver shield with checkmark centered, "
            "emerald green silk ribbon draped, pure black background, "
            "premium gamification achievement badge, heraldic, highly detailed, "
            "centered, symmetric"
        ),
        "width": 768,
        "height": 768,
    },
    {
        "name": "role-elder",
        "prompt": (
            "ornate medal badge emblem, gold crown with laurel wreath centered, "
            "royal gold silk ribbon draped, pure black background, "
            "legendary premium gamification achievement badge, heraldic, "
            "highly detailed, centered, symmetric, radiant"
        ),
        "width": 768,
        "height": 768,
    },
    # --- achievement badges ---
    {
        "name": "achievement-first-vote",
        "prompt": (
            "bronze circular medal with a single ballot card icon in center, "
            "glowing bronze rim, pure black background, premium game achievement, "
            "minimal flat style with subtle shading, centered"
        ),
        "width": 512,
        "height": 512,
    },
    {
        "name": "achievement-law-maker",
        "prompt": (
            "legendary gold medal with a radiant gold gavel striking a pedestal, "
            "laurel wreath, divine light rays, pure black background, "
            "premium game achievement, centered, heraldic, sharp"
        ),
        "width": 512,
        "height": 512,
    },
    {
        "name": "achievement-chain-master",
        "prompt": (
            "purple epic medal with three interlocking chain links forming a tree, "
            "glowing purple rim, magical particles, pure black background, "
            "premium game achievement, centered, heraldic"
        ),
        "width": 512,
        "height": 512,
    },
    # --- chamber textures ---
    {
        "name": "chamber-floor-texture",
        "prompt": (
            "seamless tileable texture, polished dark marble floor, "
            "subtle blue and gold veining, warm ambient lighting, "
            "high detail, photorealistic, top down view, "
            "premium luxury material, museum quality"
        ),
        "width": 1024,
        "height": 1024,
    },
    # --- og / share ---
    {
        "name": "og-share",
        "prompt": (
            "cinematic wide banner for a political debate platform, "
            "dark grand parliamentary chamber interior, empty hemicycle seats, "
            "dramatic blue and red side lighting, volumetric god rays, "
            "gold highlights, premium marketing visual, ultra polished, "
            "wide aspect ratio, atmospheric"
        ),
        "width": 1216,
        "height": 640,
    },
]


# -------- runner -----------------------------------------------------------

def generate(asset: dict) -> tuple[str, bool, str]:
    name = asset["name"]
    dest = ASSETS_DIR / f"{name}.png"
    if dest.exists() and dest.stat().st_size > 10_000:
        return name, True, f"exists ({dest.stat().st_size // 1024}KB)"

    wf = sd15_workflow(
        prompt=asset["prompt"],
        negative=BASE_NEGATIVE,
        width=asset["width"],
        height=asset["height"],
        seed=(hash(name) & 0x7FFFFFFF) or 42,
        filename_prefix=f"lobby_{name}",
    )
    try:
        pid = submit(wf)
    except Exception as e:
        return name, False, f"submit failed: {e}"

    result = poll(pid, timeout=300)
    if result.get("status") != "success":
        err = result.get("error_message") or result.get("error") or result.get("status")
        return name, False, f"job failed: {str(err)[:200]}"

    try:
        ok = download_output(pid, dest)
        if ok:
            return name, True, f"downloaded ({dest.stat().st_size // 1024}KB)"
        return name, False, "no output found in history"
    except Exception as e:
        return name, False, f"download failed: {e}"


def main():
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    assets = [a for a in ASSETS if not only or a["name"] in only]
    print(f"Generating {len(assets)} assets via Comfy Cloud (SD1.5 / Dreamshaper 8)...")
    print(f"Output: {ASSETS_DIR}")
    print()

    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT) as pool:
        futures = {pool.submit(generate, a): a["name"] for a in assets}
        done = failed = 0
        for fut in as_completed(futures):
            name, ok, msg = fut.result()
            tag = "OK " if ok else "ERR"
            print(f"  [{tag}] {name}: {msg}")
            if ok:
                done += 1
            else:
                failed += 1

    print()
    print(f"Complete: {done}/{len(assets)} succeeded, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
