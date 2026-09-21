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

Use concise system prompts, retrieve only relevant knowledge notes, cap low-risk responses, cache stable summaries and route routine classification away from premium models. Compare models on RaiseSEA-specific benchmark tasks before changing defaults.
