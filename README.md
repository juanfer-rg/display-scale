<h1 align="center">Display Scale</h1>

<p align="center">
  Change the display scale from GNOME's Quick Settings menu.
</p>

Display Scale adds a **Scale** button to Quick Settings. It lists the same scales that
Settings → Displays offers for the current resolution (100 %, 125 %, 133 %, 150 %…), with a check
on the active one. Nothing extra: no custom values, no settings.

- **Same options as Settings**: the scales come straight from Mutter for the current mode, so
  fractional scales appear only when GNOME offers them.
- **Several monitors**: each display gets its own list, and the others are moved so the layout
  stays together.
- **Saved like Settings**: the change is stored as your display configuration.

Works on GNOME 46 to 50 (Ubuntu 24.04 to 26.04), on Wayland and X11.

## Installation

### From extensions.gnome.org

Search for **Display Scale** in the Extension Manager app, or install it from
[extensions.gnome.org](https://extensions.gnome.org/).

### From source

```bash
git clone https://github.com/juanfer-rg/display-scale.git
cd display-scale
make install
```

`make install` links the folder into `~/.local/share/gnome-shell/extensions/`. On Wayland, log
out and back in, then:

```bash
make enable
```

## Development

| Command        | What it does                                                        |
| -------------- | ------------------------------------------------------------------- |
| `make pack`    | Builds `dist/display-scale@juanfer-rg.github.io.shell-extension.zip` |
| `make verify`  | Asks Mutter to validate every scale of the first monitor; applies nothing |
| `make lint`    | ESLint with the GNOME Shell style (`npm install` once first)        |
| `make logs`    | Follows GNOME Shell's log                                           |

The extension talks to `org.gnome.Mutter.DisplayConfig` over D-Bus (`GetCurrentState` and
`ApplyMonitorsConfig`), the same interface GNOME Settings uses. That code lives in
`displayConfig.js` and only depends on Gio and GLib, so it can run outside GNOME Shell with `gjs`.
