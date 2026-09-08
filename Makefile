# Thin wrapper over the npm scripts, matching ../webnavfit. `make start` is the
# one people remember; the node_modules rule exists because the dev server and
# every check fail with a bare "Cannot find package" when the install is stale.

.PHONY: start build preview test smoke verify sabotage

start: node_modules
	npm run dev

build: node_modules
	npm run build

preview: node_modules
	npm run preview

test: node_modules
	npm test

smoke: node_modules
	npm run smoke

verify: node_modules
	npm run verify

sabotage: node_modules
	node tools/sabotage.mjs

node_modules: package-lock.json package.json
	npm ci
	touch node_modules
