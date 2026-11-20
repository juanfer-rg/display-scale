import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {
    Method, applyScale, commonScales, formatScale, getState,
    scalesEqual, subscribeMonitorsChanged,
} from './displayConfig.js';

const ICON = 'video-display-symbolic';
const TITLE = 'Scale';

function isCancelled(e) {
    return e instanceof GLib.Error && e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED);
}

const ScaleToggle = GObject.registerClass(
class ScaleToggle extends QuickMenuToggle {
    _init() {
        super._init({title: TITLE, iconName: ICON, toggleMode: false});

        this.menu.setHeader(ICON, TITLE);
        this._section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(this._section);

        this._state = null;
        this._syncId = 0;
        this._cancellable = new Gio.Cancellable();

        // El botón principal también abre el menú (no hay nada que activar/desactivar).
        this.connect('clicked', () => this.menu.open());

        this._unsubscribe = subscribeMonitorsChanged(() => this._sync());
        this.connect('destroy', () => {
            this._cancellable.cancel();
            this._unsubscribe();
        });

        this._sync();
    }

    async _sync() {
        const id = ++this._syncId;
        let state;
        try {
            state = await getState(this._cancellable);
        } catch (e) {
            if (!isCancelled(e))
                console.error(`[display-scale] GetCurrentState: ${e.message}`);
            return;
        }
        if (id !== this._syncId)
            return;
        this._state = state;
        this._rebuild();
    }

    _groups() {
        const lms = this._state.logicalMonitors;
        if (this._state.globalScaleRequired) {
            const primary = lms.find(lm => lm.primary) ?? lms[0];
            return [{
                label: null,
                indices: lms.map((_, i) => i),
                scales: commonScales(lms.flatMap(lm => lm.monitors)),
                current: primary.scale,
                primary: true,
            }];
        }
        return lms.map((lm, i) => ({
            label: lm.monitors.map(m => m.displayName).join(' / '),
            indices: [i],
            scales: commonScales(lm.monitors),
            current: lm.scale,
            primary: lm.primary,
        }));
    }

    _rebuild() {
        this._section.removeAll();

        const groups = this._groups();
        const showLabels = groups.length > 1;

        for (const group of groups) {
            if (showLabels)
                this._section.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(group.label));

            for (const scale of group.scales) {
                const item = new PopupMenu.PopupMenuItem(formatScale(scale));
                const active = scalesEqual(scale, group.current);
                item.setOrnament(active ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
                if (!active)
                    item.connect('activate', () => this._apply(group.indices, scale));
                this._section.addMenuItem(item);
            }
        }

        const main = groups.find(g => g.primary) ?? groups[0];
        const subtitle = main ? formatScale(main.current) : '';
        this.subtitle = subtitle;
        this.menu.setHeader(ICON, TITLE, subtitle);
        this.visible = groups.length > 0;
    }

    async _apply(indices, scale) {
        if (!this._state)
            return;
        try {
            await applyScale(this._state, indices, scale, Method.PERSISTENT, this._cancellable);
        } catch (e) {
            if (isCancelled(e))
                return;
            console.error(`[display-scale] ApplyMonitorsConfig: ${e.message}`);
            Main.notifyError(TITLE, e.message);
        }
    }
});

const ScaleIndicator = GObject.registerClass(
class ScaleIndicator extends SystemIndicator {
    _init() {
        super._init();
        this.quickSettingsItems.push(new ScaleToggle());
    }

    destroy() {
        this.quickSettingsItems.forEach(item => item.destroy());
        super.destroy();
    }
});

export default class DisplayScaleExtension extends Extension {
    enable() {
        this._indicator = new ScaleIndicator();
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
