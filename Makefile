UUID      := display-scale@juanfer-rg.github.io
EXT_DIR   := $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SRC_DIR   := $(CURDIR)
JS_FILES  := extension.js displayConfig.js

.PHONY: install uninstall enable disable pack verify lint logs clean

## Symlink this folder into the user's extension directory.
install:
	@mkdir -p $(dir $(EXT_DIR))
	@if [ -e "$(EXT_DIR)" ] && [ ! -L "$(EXT_DIR)" ]; then \
		echo "$(EXT_DIR) exists and is not a symlink; remove it first"; exit 1; fi
	ln -sfn "$(SRC_DIR)" "$(EXT_DIR)"
	@echo "Installed. On Wayland, log out and back in, then run: make enable"

uninstall:
	rm -f "$(EXT_DIR)"

enable:
	gnome-extensions enable $(UUID)

disable:
	gnome-extensions disable $(UUID)

## Build the zip for extensions.gnome.org.
pack:
	@mkdir -p dist
	gnome-extensions pack --force --out-dir=dist --extra-source=displayConfig.js .
	@echo "dist/$(UUID).shell-extension.zip"

## Ask Mutter to validate every scale of the first monitor (nothing is applied).
verify:
	gjs -m tests/verify.js "$(SRC_DIR)"

## ESLint with the GNOME Shell style (run `npm install` once first).
lint:
	npx eslint $(JS_FILES) tests

## Follow GNOME Shell's log.
logs:
	journalctl -f -o cat /usr/bin/gnome-shell

clean:
	rm -rf dist
