# savvy-progress

> **Local fork (1.2.0-local.2)** of [savvy-progress](https://github.com/johnnyvizz/claude-kit/tree/main/plugins/savvy-progress) by johnnyvizz (MIT), with the project file tree of the local `filetree-desktop` mod merged into the Agents pane. Below the running agents the pane draws the file tree (the CLAUDE TOUCHED card, All Files with Collapse all, refresh); finished agents fold under one `Finished · N` row that folds itself again each time another agent finishes. `/agents-info` and `/filetree` both toggle the pane, and it opens with the session unless you closed it. Every Agent call gets a short instruction appended asking the worker to report its steps through `mcp__savvy-progress__step`; a running card then shows `3/8` and the time left (`~4m left`, `estimating…` before the first step), estimated as elapsed × steps left / steps done. Installed from the `local-agents` marketplace in this folder.

A Claude Code mod: a progress bar above the prompt and a live panel of subagents. Made for the [savvy-flow](../savvy-flow) skill, and useful with any subagents.

- **Progress bar**: the flow's title, phase, accepted tasks out of planned, and a button with the crew size that opens the panel. It appears once something reports progress (savvy-flow does) or a `savvy-*` worker starts.
- **Agents panel** (`/agents-info` toggles it): running, finished and planned subagents with model, effort, task progress, context, estimated cost and time. Working crabs walk, and each savvy tier animates its prop: the astronaut floats, the detective sweeps the magnifier, the engineer turns the wrench, the chef tosses the omelette, the racer runs with a fluttering flag. `prefers-reduced-motion` stops them.

## Tools it adds

- `mcp__savvy-progress__progress`: the orchestrator reports the plan, phase and accepted tasks.
- `mcp__savvy-progress__step`: a worker reports its own steps (`done`, `total`, `note`). A worker that does not report shows its context fill in grey instead.

Cost is a rough estimate from token counts and a built-in per-model price table (`PRICES` in `hooks/register.tsx`), not a bill.

## Settings

`language`: `auto` (default), `en` or `ru`. `auto` follows Claude Code's `language` setting, then the system locale, and falls back to English. Set it in `/config`, or, for a mod loaded by hand, in `~/.claude/settings.json`:

```json
{ "pluginConfigs": { "savvy-progress": { "options": { "language": "ru" } } } }
```

Install instructions are in the [repository README](../../README.md).
