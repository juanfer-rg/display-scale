// Validates every supported scale of the first monitor with Mutter's
// ApplyMonitorsConfig in "verify" mode: nothing is applied to the screen.
// Usage: gjs -m tests/verify.js <extension dir>

const dc = await import(`file://${ARGV[0]}/displayConfig.js`);

const state = await dc.getState();
const [lm] = state.logicalMonitors;
print(`${lm.monitors.map(m => m.displayName).join(' / ')}: ${dc.formatScale(lm.scale)}`);

let failed = false;
for (const scale of dc.commonScales(lm.monitors)) {
    try {
        await dc.applyScale(state, [0], scale, dc.Method.VERIFY);
        print(`  ${dc.formatScale(scale)} OK`);
    } catch (e) {
        failed = true;
        print(`  ${dc.formatScale(scale)} FAIL: ${e.message}`);
    }
}

if (failed)
    imports.system.exit(1);
