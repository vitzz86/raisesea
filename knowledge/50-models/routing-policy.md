---
owner: Vito
status: active
last_verified: 2026-09-21
sources:
  - project working sessions
agents:
  - raisesea-software-engineer
  - raisesea-chief-of-staff
---

# Model routing policy

Route by risk, not by novelty.

| Work | Primary | Fallback | Never |
|---|---|---|---|
| Code, migrations, security, architecture | ChatGPT/Codex | DeepSeek, then approved OpenRouter coding model | Nemotron/free general models |
| News extraction and synthesis | DeepSeek | approved OpenRouter reasoning model | unverified free model for publishing decisions |
| Social drafts and rewrites | DeepSeek or approved value model | OpenRouter value model | automatic posting without review |
| Idea capture, classification, reminders, formatting | approved cheap/free OpenRouter model such as Nemotron | DeepSeek | access to deploy or destructive tools |

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

Use a dedicated OpenRouter key named "Hermes" with a monthly spend limit set in the OpenRouter dashboard. That account-level cap is the last line of defense if the gateway misbehaves. Record the limit in `hermes/cost-control.env.example` and review it whenever the model routing changes.

Compare models on RaiseSEA-specific benchmark tasks before changing defaults.
