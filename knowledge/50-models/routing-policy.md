---
owner: Vito
status: active
last_verified: 2026-09-22
sources:
  - OpenRouter model catalog and pricing (2026-09-22)
  - project working sessions
agents:
  - raisesea-software-engineer
  - raisesea-chief-of-staff
---

# Model routing policy

Route by risk, not by novelty. All profiles route through OpenRouter except the Software Engineer, whose primary is Codex direct.

| Work | Primary | Fallback | Never |
|---|---|---|---|
| Code, migrations, security, architecture | ChatGPT/Codex | DeepSeek, then approved OpenRouter coding model | Nemotron/free general models |
| News extraction and synthesis | DeepSeek | approved OpenRouter reasoning model | unverified free model for publishing decisions |
| Social drafts and rewrites | DeepSeek or approved value model | OpenRouter value model | automatic posting without review |
| Idea capture, classification, reminders, formatting | approved cheap/free OpenRouter model such as Nemotron | DeepSeek | access to deploy or destructive tools |

## Model fallback chains (final)

Ordered primary -> fallback -> last resort.

| Profile | Chain |
|---|---|
| News Intelligence | `deepseek/deepseek-v4.1-flash` -> `z-ai/glm-5.3-flash` -> `qwen/qwen3.8-flash` -> `nvidia/nemotron-3-ultra-550b-a55b:free` |
| Chief of Staff | `nvidia/nemotron-3-ultra-550b-a55b:free` -> `qwen/qwen3.8-27b:free` -> `deepseek/deepseek-v4.1-flash` |
| Social Media Manager | `deepseek/deepseek-v4-pro` -> `z-ai/glm-5.3` -> `qwen/qwen3.8-flash` -> `nvidia/nemotron-3-ultra-550b-a55b:free` |
| Software Engineer | `gpt-5.6-sol` (Codex direct) -> `z-ai/glm-5.3` (OpenRouter) -> `deepseek/deepseek-v4-pro` (OpenRouter) |

### Rules

- All routing goes through OpenRouter except the Engineer, whose primary is Codex direct (`gpt-5.6-sol`); OpenRouter is fallback only.
- Free models (`:free`) are allowed only as fallbacks for News, Chief of Staff, and Social. Never use a free model for the Engineer/coding.

## Safeguards

- Keep model selection explicit per profile; never silently downgrade coding work.
- A model fallback does not expand tool permissions.
- Free-model outputs must be treated as drafts and may not make irreversible decisions.
- Log provider, model, task class, latency, failure and estimated cost without logging prompts that contain secrets.
- Review OpenRouter model IDs, availability and pricing before production because they change over time.

## Cost controls

Budget and request-expansion guardrails live in `hermes/cost-control.env.example`. The hard ceilings are a monthly and daily USD budget, a per-turn provider-call cap and a per-turn token budget. When a ceiling is reached the turn stops or degrades to the low-risk tier; it never silently keeps spending.

Operational rules:

- Keep system prompts concise and retrieve only the knowledge notes the task needs.
- Compact context before re-reading the knowledge base or re-sending history; long-context turns are the dominant cost driver.
- Cap low-risk responses and cache stable summaries; route routine classification and formatting away from premium models.
- Do not loop: if a task needs more than the per-turn call cap, stop and report the blocker instead of retrying the same step.
- Log provider, model, task class, latency, failure and estimated cost without logging prompts that contain secrets.

## OpenRouter key cap

Use a dedicated OpenRouter key per profile with its own spend limit set in the OpenRouter dashboard. That account-level cap is the last line of defense if the gateway misbehaves. Record the limit in `hermes/cost-control.env.example` and review it whenever the model routing changes.

Compare models on RaiseSEA-specific benchmark tasks before changing defaults.
