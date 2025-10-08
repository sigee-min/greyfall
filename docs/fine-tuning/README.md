Greyfall SFT Plan (Dataset and Process)
======================================

This document defines how to prepare, store, and evaluate supervised fine‑tuning (SFT) data for the Greyfall LLM system. It is aligned with docs/LLM_SYSTEM.md and the live code (validators, tasks, prompts, engine).

Principles
- Keep the model’s scope small and reliable: task selection and short narration; put rules, resolution, and side‑effects in code.
- Use strict validators (same as runtime) to gate all gold samples.
- Keep prompts consistent with the runtime sections/template.

Directory Layout
- docs/fine-tuning/
  - README.md (this file)
  - tasks.md (per‑task schema + examples + validator mapping)
  - dataset-layout.md (naming/versioning/splits)
  - templates/ (small JSONL examples per task)

Data Splits and File Naming
- Store JSONL files per task under versioned folders:
  - data/v1/train/<task>.jsonl
  - data/v1/valid/<task>.jsonl
  - data/v1/test/<task>.jsonl
- Use semantic versioning for dataset changes; bump minor on directive edits, major on schema changes.

Sampling Ratios (initial recommendation)
- High‑priority: intent.plan (40%), safety.screen (20%), intent.disambiguate (10%)
- The rest: result.narrate / scene.* / summarize / npc.* / entity.link / suggest / hazard.tag (30%)
- Locale mix: ko/en ≈ 50/50 (or match user distribution)

Input/Output Shape (all tasks)
- JSON line structure:
  {
    "meta": {
      "id": "<unique>",
      "task": "<task-id>",
      "locale": "ko|en",  // BCP‑47 tag supported
      "source": "gold|synthetic",
      "version": "v1"
    },
    "sections": {
      "context": "...",
      "recentChat": ["..."],
      "requester": "actor=p:host (self)",
      "actors": ["p:host ..."],
      "positions": ["p:host map=... field=..."],
      "rules": ["same_field_required_for_give=true"],
      "inventory": ["p:host items=[potion_small(2)]"],
      "targetsEligible": ["heal:[p:bravo]"],
      "rolls": ["..."],
      "effects": ["..."]
    },
    "user": { "instruction": "<concise instruction>", "persona": "너는 Greyfall TRPG 게임 매니저이다." },
    "output": <task-specific>
  }
- Task‑specific output schemas are listed in tasks.md; they mirror runtime validators in src/llm/validators/*.

Token/Limits & Style
- Chat maxTokens: 120. Other nodes use the runtime defaults (doubled caps).
- Keep input sections concise (context ≤ ~600 chars, recentChat ≤ 10 lines); do not include long raw lore.
- Outputs:
  - JSON one‑liners for structured tasks (no code blocks, no extra prose)
  - Narration: 1–3 sentences; only cite facts from Rolls/Effects; no invented numbers.

Quality Gates (must pass)
- JSON parse success and validator success ≥ 99.5%
- No invented numbers; no forbidden content; follows sentence/char caps.
- Deduplicate near‑dups; stratify difficulty (clear/simple ↔ ambiguous).

Evaluation (per task)
- intent.plan: action accuracy, targets F1, format success rate
- result.narrate: sentence/char compliance, fact consistency rate
- disambiguate/entity.link: EM/F1, option count constraints
- safety.screen: reasons accuracy (fixed set)

Training
- SFT multi‑task; apply task weights (see ratios). Short outputs favored.
- Teacher→student (optional) with validators applied to teacher outputs.
- Export to ONNX (q8/q4) for web; verify latency/memory with current caps.

References
- Runtime SSOT: docs/LLM_SYSTEM.md
- Validators: src/llm/validators/*
- Prompts/Sections: src/llm/spec/prompts.ts

