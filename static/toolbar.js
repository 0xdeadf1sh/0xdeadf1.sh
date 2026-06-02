(function () {
    'use strict';

    const TOGGLES = [
        { key: 'fish',    label: 'fish & sub', cls: 'no-fish' },
        { key: 'bubbles', label: 'bubbles',    cls: 'no-bubbles' },
        { key: 'hook',    label: 'hook',       cls: 'no-hook' },
        { key: 'bg',      label: 'background', cls: 'no-bg' }
    ];

    function isPostPage() {
        const m = window.location.pathname.match(/^\/posts\/([^/]+)\/?$/);
        return m !== null && m[1] !== 'page';
    }

    const POST_OFF_KEYS = new Set(['fish', 'bubbles', 'hook']);

    // No persistence: every load starts from page-type-aware defaults.
    // Post pages default the world off; everywhere else it's on. The
    // 'background' toggle swaps the blue animated-gif backdrop for the
    // flat black used on post pages.
    function defaultFor(key) {
        if (key === 'collapsed') return true;
        if (isPostPage() && POST_OFF_KEYS.has(key)) return false;
        return true;
    }

    function loadState() {
        const state = {};
        TOGGLES.forEach(function (t) {
            state[t.key] = defaultFor(t.key);
        });
        state.collapsed = defaultFor('collapsed');
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
            });
            refreshUI();
            applyToggles(state);
        });

        toggleBtns.forEach(function (btn, i) {
            btn.addEventListener('click', function () {
                const t = TOGGLES[i];
                state[t.key] = !state[t.key];
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
            bar.classList.toggle('collapsed', state.collapsed);
            handle.setAttribute('aria-expanded', state.collapsed ? 'false' : 'true');
        });

        bar.appendChild(panel);
        bar.appendChild(handle);

        document.documentElement.appendChild(bar);
    }

    if (!isPostPage()) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', build);
        } else {
            build();
        }
    }
})();
