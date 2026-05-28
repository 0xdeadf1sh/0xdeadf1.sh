(function () {
    'use strict';

    const BODY_MAX_WIDTH = 780;
    const MIN_GUTTER = 24;
    const BUBBLES_PER_PX = 1 / 220;
    const MIN_BUBBLES_PER_SIDE = 10;
    const MAX_BUBBLES_PER_SIDE = 80;

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function gutterWidth() {
        return Math.max(0, Math.floor((window.innerWidth - BODY_MAX_WIDTH) / 2));
    }

    function makeBubble(side, gutter, docHeight) {
        const b = document.createElement('div');
        b.className = 'bubble';

        const size = rand(8, 36);
        b.style.width = b.style.height = size.toFixed(1) + 'px';

        const inset = rand(0, Math.max(0, gutter - size));
        if (side === 'left') {
            b.style.left = inset.toFixed(1) + 'px';
        } else {
            b.style.right = inset.toFixed(1) + 'px';
        }
        b.style.top = rand(0, docHeight).toFixed(1) + 'px';

        const dist = rand(420, 1100);
        b.style.setProperty('--dist', '-' + dist.toFixed(1) + 'px');

        const wobble = rand(6, 16) * (Math.random() < 0.5 ? -1 : 1);
        b.style.setProperty('--wobble', wobble.toFixed(1) + 'px');

        const dur = rand(20, 42);
        b.style.setProperty('--dur', dur.toFixed(1) + 's');
        b.style.setProperty('--delay', '-' + rand(0, dur).toFixed(1) + 's');

        b.style.setProperty('--alpha', rand(0.30, 0.80).toFixed(2));

        return b;
    }

    function populate() {
        const box = document.getElementById('bubble-box');
        if (!box) return;

        box.innerHTML = '';

        const gutter = gutterWidth();
        if (gutter < MIN_GUTTER) return;

        const boxHeight = box.offsetHeight;
        if (boxHeight < 1) return;

        const count = Math.min(
            MAX_BUBBLES_PER_SIDE,
            Math.max(MIN_BUBBLES_PER_SIDE, Math.round(boxHeight * BUBBLES_PER_PX))
        );

        const frag = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            frag.appendChild(makeBubble('left', gutter, boxHeight));
            frag.appendChild(makeBubble('right', gutter, boxHeight));
        }
        box.appendChild(frag);
    }

    let scheduled = null;
    function debouncedPopulate() {
        if (scheduled) clearTimeout(scheduled);
        scheduled = setTimeout(function () {
            scheduled = null;
            populate();
        }, 150);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', populate);
    } else {
        populate();
    }
    window.addEventListener('load', debouncedPopulate);
    window.addEventListener('resize', debouncedPopulate);
})();
