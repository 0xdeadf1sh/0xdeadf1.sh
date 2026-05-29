(function () {
    'use strict';

    const OFF_SCREEN_Y = -60;
    const BOB_OFFSET = 5;
    const BOB_CYCLE_MS = 2500;

    const HOOK_SVG =
        '<svg viewBox="0 0 24 38" xmlns="http://www.w3.org/2000/svg">' +
            '<g fill="none" stroke="#dadada" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<circle cx="12" cy="5" r="2.5"/>' +
                '<line x1="12" y1="7.5" x2="12" y2="24"/>' +
                '<path d="M 12 24 Q 12 33 6 33 Q 1 33 3 25"/>' +
                '<line x1="3" y1="25" x2="6" y2="23"/>' +
            '</g>' +
        '</svg>';

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function ensureContainer() {
        let box = document.getElementById('hook-box');
        if (box && box.parentNode !== document.documentElement) {
            document.documentElement.appendChild(box);
        } else if (!box) {
            box = document.createElement('div');
            box.id = 'hook-box';
            box.setAttribute('aria-hidden', 'true');
            document.documentElement.appendChild(box);
        }
        return box;
    }

    function spawnHook() {
        const box = ensureContainer();

        // Span the full document and anchor the hook to the current scroll
        // position so it drifts with the page like the rest of the world,
        // instead of staying glued to the viewport.
        box.style.height = document.body.scrollHeight + 'px';
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

        const x = rand(80, Math.max(160, window.innerWidth - 80));
        const depth = rand(window.innerHeight * 0.25, window.innerHeight * 0.62);
        const descendDur = rand(2.8, 4.2) * 1000;
        const lingerDur = rand(2.5, 5.5) * 1000;
        const ascendDur = rand(2.2, 3.8) * 1000;

        const wrap = document.createElement('div');
        wrap.className = 'hook-wrap';
        wrap.style.left = x.toFixed(0) + 'px';
        wrap.style.top = scrollY.toFixed(0) + 'px';
        wrap.innerHTML =
            '<div class="hook">' +
                '<div class="hook-line"></div>' +
                '<div class="hook-tip">' + HOOK_SVG + '</div>' +
            '</div>';

        const hook = wrap.querySelector('.hook');
        box.appendChild(wrap);

        const offY  = 'translateY(' + OFF_SCREEN_Y + 'px)';
        const downY = 'translateY(' + depth.toFixed(0) + 'px)';
        const bobY  = 'translateY(' + (depth + BOB_OFFSET).toFixed(0) + 'px)';

        const descend = hook.animate(
            [{ transform: offY }, { transform: downY }],
            {
                duration: descendDur,
                easing: 'cubic-bezier(0.45, 0, 0.55, 0.4)',
                fill: 'forwards'
            }
        );

        descend.onfinish = function () {
            const loops = Math.max(1, Math.round(lingerDur / BOB_CYCLE_MS));
            const linger = hook.animate(
                [
                    { transform: downY },
                    { transform: bobY },
                    { transform: downY }
                ],
                {
                    duration: BOB_CYCLE_MS,
                    iterations: loops,
                    easing: 'ease-in-out',
                    fill: 'forwards'
                }
            );

            linger.onfinish = function () {
                const ascend = hook.animate(
                    [{ transform: downY }, { transform: offY }],
                    {
                        duration: ascendDur,
                        easing: 'cubic-bezier(0.4, 0.45, 0.4, 1)',
                        fill: 'forwards'
                    }
                );

                ascend.onfinish = function () {
                    wrap.remove();
                    scheduleNext();
                };
            };
        };
    }

    function scheduleNext() {
        const delay = rand(40, 110) * 1000;
        setTimeout(spawnHook, delay);
    }

    function start() {
        ensureContainer();
        setTimeout(spawnHook, rand(8, 25) * 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
