#!/usr/bin/env python3
"""
Lobby Market character sprite generator via Comfy Cloud.

Uses SD1.5 Dreamshaper + BiRefNet background removal to produce
transparent PNG sprites for the 3D city: player character, NPCs,
walk cycle frames, environment props.
"""

import json
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

SPRITES_DIR = Path("/home/loren/consensus-app/public/assets/sprites")
SPRITES_DIR.mkdir(parents=True, exist_ok=True)

MAX_CONCURRENT = 2


# -------- workflows --------------------------------------------------------

def sprite_workflow(
    prompt: str,
    negative: str,
    width: int,
    height: int,
    seed: int,
    filename_prefix: str,
    steps: int = 28,
    cfg: float = 7.5,
    remove_bg: bool = True,
):
    """SD1.5 Dreamshaper with optional BiRefNet background removal → PNG with alpha."""
    wf = {
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
    }

    if remove_bg:
        # Strip the background with BiRefNet and save with alpha
        wf["7"] = {
            "class_type": "BiRefNetRMBG",
            "inputs": {
                "image": ["6", 0],
                "model": "BiRefNet_lite",
                "mask_blur": 1,
                "mask_offset": 0,
                "invert_output": False,
                "refine_foreground": False,
                "background": "Alpha",
            },
        }
        wf["8"] = {
            "class_type": "SaveImage",
            "inputs": {"images": ["7", 0], "filename_prefix": filename_prefix},
        }
    else:
        wf["8"] = {
            "class_type": "SaveImage",
            "inputs": {"images": ["6", 0], "filename_prefix": filename_prefix},
        }
    return wf


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


def poll(pid: str, timeout: int = 540) -> dict:
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
        if not isinstance(entry, dict) or entry.get("prompt_id") != pid:
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


# -------- character style guide --------------------------------------------

STYLE_BASE = (
    "full body portrait, facing camera, 3/4 view game character, "
    "stylized low-poly sims-like aesthetic, soft rim lighting, "
    "pure solid black void background, no floor, no ground, "
    "clean outline, centered composition, single character"
)

NEGATIVE = (
    "multiple people, crowd, group, background scenery, environment, props, "
    "white background, colored background, sky, floor, ground, shadows, "
    "cropped, blurry, low quality, ugly, deformed, extra limbs, bad anatomy, "
    "noisy, pixelated, jpeg artifacts, watermark, signature, text, nude"
)


# -------- asset catalog ----------------------------------------------------

CHARACTERS = [
    # --- player character (idle + walk frames) ---
    {
        "name": "player-idle",
        "prompt": (
            f"young person, neutral business casual outfit dark blue jacket and grey pants, "
            f"standing idle pose, arms at sides, {STYLE_BASE}"
        ),
        "size": (512, 768),
    },
    {
        "name": "player-walk-1",
        "prompt": (
            f"young person, neutral business casual outfit dark blue jacket and grey pants, "
            f"walking pose left foot forward, {STYLE_BASE}"
        ),
        "size": (512, 768),
    },
    {
        "name": "player-walk-2",
        "prompt": (
            f"young person, neutral business casual outfit dark blue jacket and grey pants, "
            f"walking pose right foot forward, {STYLE_BASE}"
        ),
        "size": (512, 768),
    },
    # --- NPC: regular person ---
    {
        "name": "npc-person",
        "prompt": (
            f"ordinary citizen, casual street clothes, hoodie and jeans, "
            f"friendly expression, standing pose, {STYLE_BASE}"
        ),
        "size": (512, 768),
    },
    # --- NPC: debator (rank-earned through participation) ---
    {
        "name": "npc-debator",
        "prompt": (
            f"confident debater character, formal suit with blue tie, "
            f"holding a microphone, standing proud pose, silver badge on lapel, "
            f"{STYLE_BASE}"
        ),
        "size": (512, 768),
    },
    # --- NPC: troll catcher (moderator) ---
    {
        "name": "npc-troll-catcher",
        "prompt": (
            f"guardian moderator character, tactical green uniform with shield emblem, "
            f"holding a round shield, confident protector stance, "
            f"emerald green accents, {STYLE_BASE}"
        ),
        "size": (512, 768),
    },
    # --- NPC: elder (top tier) ---
    {
        "name": "npc-elder",
        "prompt": (
            f"wise elder character, ornate gold robes with laurel wreath crown, "
            f"holding a staff, regal dignified pose, royal purple sash, "
            f"{STYLE_BASE}"
        ),
        "size": (512, 768),
    },
    # --- NPC: influencer ---
    {
        "name": "npc-influencer",
        "prompt": (
            f"charismatic influencer character, fashionable modern outfit, "
            f"holding a smartphone, cool confident pose, glowing gold accessories, "
            f"{STYLE_BASE}"
        ),
        "size": (512, 768),
    },
    # --- environment props (isolated on white) ---
    {
        "name": "prop-lamppost",
        "prompt": (
            "ornate iron street lamp post, warm glowing bulb, vintage design, "
            "simple stylized low-poly game prop, soft ambient lighting, "
            "pure white background, clean outline, centered, no ground shadow"
        ),
        "size": (384, 768),
    },
    {
        "name": "prop-tree",
        "prompt": (
            "stylized cartoon tree, round green foliage, brown trunk, "
            "simple low-poly game prop, soft ambient lighting, "
            "pure white background, clean outline, centered"
        ),
        "size": (512, 640),
    },
    {
        "name": "prop-bench",
        "prompt": (
            "wooden park bench with iron legs, side view, "
            "simple stylized low-poly game prop, soft ambient lighting, "
            "pure white background, clean outline, centered"
        ),
        "size": (640, 384),
    },
    {
        "name": "prop-fountain",
        "prompt": (
            "ornate stone fountain with water spraying upward, gold accents, "
            "simple stylized low-poly game prop, soft ambient lighting, "
            "pure white background, clean outline, centered"
        ),
        "size": (512, 640),
    },
]


# -------- runner -----------------------------------------------------------

def generate(asset: dict) -> tuple[str, bool, str]:
    name = asset["name"]
    dest = SPRITES_DIR / f"{name}.png"
    if dest.exists() and dest.stat().st_size > 10_000:
        return name, True, f"exists ({dest.stat().st_size // 1024}KB)"

    width, height = asset["size"]
    wf = sprite_workflow(
        prompt=asset["prompt"],
        negative=NEGATIVE,
        width=width,
        height=height,
        seed=(hash(name) & 0x7FFFFFFF) or 42,
        filename_prefix=f"lobby_sprite_{name}",
        remove_bg=False,
    )
    try:
        pid = submit(wf)
    except Exception as e:
        return name, False, f"submit failed: {e}"

    result = poll(pid, timeout=540)
    if result.get("status") != "success":
        err = result.get("error_message") or result.get("error") or result.get("status")
        return name, False, f"job failed: {str(err)[:200]}"

    try:
        ok = download_output(pid, dest)
        if ok:
            return name, True, f"downloaded ({dest.stat().st_size // 1024}KB)"
        return name, False, "no output found"
    except Exception as e:
        return name, False, f"download failed: {e}"


def main():
    only = sys.argv[1:] if len(sys.argv) > 1 else None
    assets = [a for a in CHARACTERS if not only or a["name"] in only]
    print(f"Generating {len(assets)} character sprites via Comfy Cloud...")
    print(f"Output: {SPRITES_DIR}")
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
