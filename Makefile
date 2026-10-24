.PHONY: dependencies worktree dev cli ci

dependencies:
	vp install

worktree: dependencies

dev: dependencies
	portless

cli:
	bun cli/index.ts --help

ci:
	vp install --frozen-lockfile
	bun run --cwd web check
	bun run --cwd cli check
	bun run --cwd mcp check
	bun run --cwd web-next check
	vp check
	bun run --cwd web test:unit
	bun run --cwd web test:d1
	bun run --cwd web test:acceptance
	cd cli && bun test
	cd mcp && bun test
	bun run --cwd web-next test
