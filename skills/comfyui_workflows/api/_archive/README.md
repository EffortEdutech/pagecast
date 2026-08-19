# Archived — 2026-07-22

`scene_single_character.json` and `scene_dual_character.json` are archived here.

**Why:** these were the reference exports for the dynamically-built scene-generation
graph in `generate_images.py` (`_comfyui_wf_build`). Output was unacceptable —
heavy ghosting/double-exposure artifacts, washed-out backgrounds, and
featureless faces — most likely because IPAdapter conditioning was applied
globally rather than confined per-character to a region of the canvas, so
2-character scenes especially produced overlapping/hallucinated duplicate
identities.

**Not archived:** `character_portrait_gen.json` and `character_reference_sheet.json`
— these produce the CHARACTER_REFS model sheets, which are working correctly
as of the `cycle` and stdin fixes on 2026-07-21/22.

**Replacement plan:** see the workflow research and candidates written up in
chat on 2026-07-22 — leading options are (1) IPAdapter + per-character regional
masking via ComfyUI-Inspire-Pack, keeping the existing Juggernaut XL checkpoint,
or (2) a paradigm switch to Qwen-Image-Edit-2511's native multi-reference
conditioning, which doesn't use IPAdapter/attention-injection at all.
