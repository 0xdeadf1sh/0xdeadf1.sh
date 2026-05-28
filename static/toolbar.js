(function () {
    'use strict';

    const KEY = '0xdeadf1sh-toolbar-v3';

    const TOGGLES = [
        { key: 'fish',    label: 'fish & sub',   cls: 'no-fish' },
        { key: 'bubbles', label: 'bubbles',      cls: 'no-bubbles' },
        { key: 'hook',    label: 'hook',         cls: 'no-hook' },
        { key: 'bg',      label: 'animated bg',  cls: 'no-bg-animation' },
        { key: 'bluebg',  label: 'blue bg',      cls: 'no-blue-bg' }
    ];

    function isPostPage() {
        const m = window.location.pathname.match(/^\/posts\/([^/]+)\/?$/);
        return m !== null && m[1] !== 'page';
    }

    const POST_OFF_KEYS = new Set(['fish', 'bubbles', 'hook', 'bg', 'bluebg']);

    function defaultFor(key) {
        if (key === 'collapsed') return true;
        if (isPostPage() && POST_OFF_KEYS.has(key)) return false;
        return true;
    }

    // Storage holds explicit user choices only. Unset keys fall back to
    // page-type-aware defaults. This way: post defaults can be off while
    // home defaults stay on, and a user who explicitly enables fish on a
    // post keeps fish on across page types.
    let storedValues = {};
    let explicitKeys = new Set();

    function loadStorage() {
        try {
            const raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
            storedValues = raw.values || {};
            explicitKeys = new Set(raw.explicit || []);
        } catch (e) {
            storedValues = {};
            explicitKeys = new Set();
        }
    }

    function saveStorage() {
        const values = {};
        explicitKeys.forEach(function (k) { values[k] = storedValues[k]; });
        try {
            localStorage.setItem(KEY, JSON.stringify({
                values: values,
                explicit: Array.from(explicitKeys)
            }));
        } catch (e) {}
    }

    function setExplicit(key, value) {
        storedValues[key] = value;
        explicitKeys.add(key);
        saveStorage();
    }

    function loadState() {
        loadStorage();
        const state = {};
        TOGGLES.forEach(function (t) {
            state[t.key] = explicitKeys.has(t.key) ? !!storedValues[t.key] : defaultFor(t.key);
        });
        state.collapsed = explicitKeys.has('collapsed') ? !!storedValues.collapsed : defaultFor('collapsed');
        return state;
    }

    function applyToggles(state) {
        const html = document.documentElement;
        TOGGLES.forEach(function (t) {
            html.classList.toggle(t.cls, !state[t.key]);
        });
    }

    function allOn(state) {
        return TOGGLES.every(function (t) { return state[t.key]; });
    }

    const state = loadState();
    applyToggles(state);

    function build() {
        const bar = document.createElement('aside');
        bar.className = 'world-toolbar' + (state.collapsed ? ' collapsed' : '');
        bar.setAttribute('aria-label', 'World controls');

        const panel = document.createElement('div');
        panel.className = 'world-toolbar-panel';

        function makeButton(extraClass, label) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'world-toggle' + (extraClass ? ' ' + extraClass : '');
            btn.innerHTML =
                '<span class="world-toggle-mark" aria-hidden="true"></span>' +
                '<span class="world-toggle-label"></span>';
            btn.querySelector('.world-toggle-label').textContent = label;
            return btn;
        }

        function syncBtn(btn, on) {
            btn.classList.toggle('off', !on);
            btn.setAttribute('aria-pressed', on ? 'true' : 'false');
        }

        const allBtn = makeButton('world-toggle-all', 'all');
        const toggleBtns = TOGGLES.map(function (t) { return makeButton('', t.label); });

        function refreshUI() {
            TOGGLES.forEach(function (t, i) {
                syncBtn(toggleBtns[i], state[t.key]);
            });
            syncBtn(allBtn, allOn(state));
        }

        allBtn.addEventListener('click', function () {
            const next = !allOn(state);
            TOGGLES.forEach(function (t) {
                state[t.key] = next;
                setExplicit(t.key, next);
            });
            refreshUI();
            applyToggles(state);
        });

        toggleBtns.forEach(function (btn, i) {
            btn.addEventListener('click', function () {
                const t = TOGGLES[i];
                state[t.key] = !state[t.key];
                setExplicit(t.key, state[t.key]);
                refreshUI();
                applyToggles(state);
            });
        });

        refreshUI();

        const sep = document.createElement('div');
        sep.className = 'world-toolbar-separator';

        panel.appendChild(allBtn);
        panel.appendChild(sep);
        toggleBtns.forEach(function (btn) { panel.appendChild(btn); });

        const handle = document.createElement('button');
        handle.type = 'button';
        handle.className = 'world-toolbar-handle';
        handle.setAttribute('aria-label', 'Toggle world controls');
        handle.setAttribute('aria-expanded', state.collapsed ? 'false' : 'true');
        handle.textContent = '☰';

        handle.addEventListener('click', function () {
            state.collapsed = !state.collapsed;
            setExplicit('collapsed', state.collapsed);
            bar.classList.toggle('collapsed', state.collapsed);
            handle.setAttribute('aria-expanded', state.collapsed ? 'false' : 'true');
        });

        bar.appendChild(panel);
        bar.appendChild(handle);

        document.documentElement.appendChild(bar);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }
})();
