---
name: task_add
description: Create a traceable RaiseSEA Kanban task from a Telegram request.
---

# Add Task

Extract the outcome, owner profile, priority, due date if provided, sources and approval level. Ask only for a missing detail that changes execution materially. Create the task in Hermes Kanban and return its identifier, owner and next action.

Default unassigned operational requests to the Chief of Staff. Never default code, news or social work to the Chief of Staff when a specialist owns it.
