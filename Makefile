.PHONY: install format lint build check pack

install:
	corepack pnpm install

format:
	corepack pnpm format

lint:
	corepack pnpm lint

build:
	corepack pnpm build

check:
	corepack pnpm check

pack:
	corepack pnpm pack
