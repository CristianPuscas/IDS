---
name: install-agents-mod
description: Install or update the savvy-progress Agents mod (Agents pane, project file tree, step ETA, caveman reports between agents) for the current user from the CristianPuscas/IDS repository. Use when the user asks to install, reinstall, update or check the Agents mod, the file tree pane, or savvy-progress.
---

# Install the Agents mod

The mod is the `savvy-progress` plugin in `plugins/savvy-progress` of
`CristianPuscas/IDS`, published through the `local-agents` marketplace declared
in this repository's `.claude-plugin/marketplace.json`.

1. Check what is installed: `claude plugin list`. If `savvy-progress@local-agents`
   is listed and enabled, run `claude plugin marketplace update local-agents`
   and `claude plugin update savvy-progress@local-agents` instead of steps 2-3.
2. Add the marketplace from GitHub:
   `claude plugin marketplace add CristianPuscas/IDS`
3. Install it for the user, so it works in every project:
   `claude plugin install savvy-progress@local-agents --scope user`
4. Run `claude plugin list` again and confirm it shows `Status: enabled`.
5. Tell the user it takes effect after they restart Claude Code, and that
   `/agents-info` or `/filetree` toggles the pane. The `language` option
   (`auto`, `en`, `ru`) is set with `/plugin configure savvy-progress@local-agents`.

If a command fails, show its output as is; do not edit files under
`~/.claude/plugins` by hand.
