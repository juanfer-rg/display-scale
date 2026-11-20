// Acceso a org.gnome.Mutter.DisplayConfig (misma API en GNOME 46–50).
// Solo depende de Gio/GLib para poder probarse fuera de gnome-shell con gjs.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const BUS_NAME = 'org.gnome.Mutter.DisplayConfig';
const OBJECT_PATH = '/org/gnome/Mutter/DisplayConfig';
const INTERFACE = BUS_NAME;

const STATE_TYPE = '(ua((ssss)a(siiddada{sv})a{sv})a(iiduba(ssss)a{sv})a{sv})';
const APPLY_TYPE = '(uua(iiduba(ssa{sv}))a{sv})';

const LAYOUT_MODE_LOGICAL = 1;
const EPSILON = 0.001;

export const Method = {VERIFY: 0, TEMPORARY: 1, PERSISTENT: 2};

export function scalesEqual(a, b) {
    return Math.abs(a - b) < EPSILON;
}

// Igual que Settings: 1.333 -> "133 %", 1.666 -> "166 %".
export function formatScale(scale) {
    return `${Math.floor(scale * 100 + EPSILON)} %`;
}

// gnome-shell y mutter son el mismo proceso: las llamadas deben ser asíncronas.
function call(method, params, replyType, cancellable) {
    return new Promise((resolve, reject) => {
        Gio.DBus.session.call(
            BUS_NAME, OBJECT_PATH, INTERFACE, method, params,
            replyType ? new GLib.VariantType(replyType) : null,
            Gio.DBusCallFlags.NONE, -1, cancellable,
            (conn, res) => {
                try {
                    resolve(conn.call_finish(res));
                } catch (e) {
                    reject(e);
                }
            });
    });
}

export function subscribeMonitorsChanged(callback) {
    const id = Gio.DBus.session.signal_subscribe(
        BUS_NAME, INTERFACE, 'MonitorsChanged', OBJECT_PATH, null,
        Gio.DBusSignalFlags.NONE, () => callback());
    return () => Gio.DBus.session.signal_unsubscribe(id);
}

export async function getState(cancellable = null) {
    const reply = await call('GetCurrentState', null, STATE_TYPE, cancellable);
    const [serial, monitors, logicalMonitors, properties] = reply.recursiveUnpack();

    const byConnector = new Map();
    for (const [[connector], modes, props] of monitors) {
        const mode = modes.find(m => m[6]['is-current']);
        if (!mode)
            continue;
        byConnector.set(connector, {
            connector,
            displayName: props['display-name'] ?? connector,
            modeId: mode[0],
            width: mode[1],
            height: mode[2],
            supportedScales: mode[5],
            props,
        });
    }

    const logical = logicalMonitors
        .map(([x, y, scale, transform, primary, specs]) => ({
            x, y, scale, transform, primary,
            monitors: specs.map(s => byConnector.get(s[0])).filter(Boolean),
        }))
        .filter(lm => lm.monitors.length > 0);

    return {
        serial,
        logicalMonitors: logical,
        layoutMode: properties['layout-mode'] ?? LAYOUT_MODE_LOGICAL,
        supportsChangingLayoutMode: properties['supports-changing-layout-mode'] ?? false,
        globalScaleRequired: properties['global-scale-required'] ?? false,
    };
}

// Escalas soportadas por todos los monitores indicados (modo actual de cada uno).
export function commonScales(monitors) {
    const [first, ...rest] = monitors;
    if (!first)
        return [];
    return first.supportedScales.filter(s =>
        rest.every(m => m.supportedScales.some(t => scalesEqual(s, t))));
}

function logicalSize(lm, scale) {
    let {width, height} = lm.monitors[0];
    if (lm.transform % 2 === 1) // 90° / 270°
        [width, height] = [height, width];
    return [Math.round(width / scale), Math.round(height / scale)];
}

function monitorProps(monitor) {
    const p = monitor.props;
    const props = {underscanning: new GLib.Variant('b', !!p['is-underscanning'])};
    if ('color-mode' in p)
        props['color-mode'] = new GLib.Variant('u', p['color-mode']);
    if ('rgb-range' in p)
        props['rgb-range'] = new GLib.Variant('u', p['rgb-range']);
    return props;
}

export async function applyScale(state, indices, scale, method = Method.PERSISTENT, cancellable = null) {
    const lms = state.logicalMonitors.map(lm => ({...lm}));

    for (const i of indices) {
        const lm = lms[i];
        // En modo lógico las posiciones dependen de la escala: desplazar vecinos.
        if (state.layoutMode === LAYOUT_MODE_LOGICAL) {
            const [oldW, oldH] = logicalSize(lm, lm.scale);
            const [newW, newH] = logicalSize(lm, scale);
            for (const other of lms) {
                if (other === lm)
                    continue;
                if (other.x >= lm.x + oldW)
                    other.x += newW - oldW;
                if (other.y >= lm.y + oldH)
                    other.y += newH - oldH;
            }
        }
        lm.scale = scale;
    }

    const minX = Math.min(...lms.map(lm => lm.x));
    const minY = Math.min(...lms.map(lm => lm.y));

    const config = lms.map(lm => [
        lm.x - minX, lm.y - minY, lm.scale, lm.transform, lm.primary,
        lm.monitors.map(m => [m.connector, m.modeId, monitorProps(m)]),
    ]);

    const props = {};
    if (state.supportsChangingLayoutMode)
        props['layout-mode'] = new GLib.Variant('u', state.layoutMode);

    await call('ApplyMonitorsConfig',
        new GLib.Variant(APPLY_TYPE, [state.serial, method, config, props]),
        null, cancellable);
}
