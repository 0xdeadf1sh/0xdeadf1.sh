(function () {
    'use strict';

    const SUB_SVG =
        '<svg viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg">' +
            '<defs>' +
                '<linearGradient id="sub-hull-grad" x1="0" y1="0" x2="0" y2="1">' +
                    '<stop offset="0" stop-color="#7a8896"/>' +
                    '<stop offset="1" stop-color="#3f4c5c"/>' +
                '</linearGradient>' +
            '</defs>' +
            // periscope
            '<g fill="#2a2a2a" stroke="#111" stroke-width="1">' +
                '<rect x="120.5" y="2" width="3" height="20"/>' +
                '<rect x="116" y="0" width="14" height="6" rx="1"/>' +
            '</g>' +
            // conning tower
            '<path d="M 100 50 L 100 22 Q 100 18 105 18 L 150 18 Q 155 18 155 22 L 155 50 Z" ' +
                'fill="url(#sub-hull-grad)" stroke="#1c2230" stroke-width="1.8"/>' +
            // tower viewport
            '<rect x="118" y="28" width="20" height="7" rx="2" fill="#ffe066" stroke="#1c2230" stroke-width="1"/>' +
            // hull
            '<path d="M 20 65 Q 22 48 55 48 L 200 48 Q 218 48 225 65 Q 218 82 200 82 L 55 82 Q 22 82 20 65 Z" ' +
                'fill="url(#sub-hull-grad)" stroke="#1c2230" stroke-width="1.8"/>' +
            // bow waterlines
            '<path d="M 25 60 L 36 60 M 25 70 L 36 70" stroke="#1c2230" stroke-width="1" fill="none" opacity="0.5"/>' +
            // portholes
            '<g stroke="#1c2230" stroke-width="1.2">' +
                '<circle cx="55" cy="65" r="5.5" fill="#ffe066"/>' +
                '<circle cx="80" cy="65" r="5.5" fill="#ffe066"/>' +
                '<circle cx="170" cy="65" r="5.5" fill="#ffe066"/>' +
                '<circle cx="192" cy="65" r="5.5" fill="#ffe066"/>' +
            '</g>' +
            // tail fin
            '<path d="M 208 48 L 213 34 L 220 48 Z" fill="url(#sub-hull-grad)" stroke="#1c2230" stroke-width="1.5"/>' +
            // propeller shaft + blades
            '<line x1="225" y1="65" x2="234" y2="65" stroke="#4a5258" stroke-width="3" stroke-linecap="round"/>' +
            '<g fill="#4a5258" stroke="#1c2230" stroke-width="1">' +
                '<ellipse cx="234" cy="65" rx="2" ry="4"/>' +
                '<ellipse cx="234" cy="56" rx="2.5" ry="7" opacity="0.85"/>' +
                '<ellipse cx="234" cy="74" rx="2.5" ry="7" opacity="0.85"/>' +
            '</g>' +
        '</svg>';

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function ensureContainer() {
        let box = document.getElementById('submarine-box');
        if (box && box.parentNode !== document.documentElement) {
            // Move out of body — body's backdrop-filter makes it the
            // containing block for fixed descendants, breaking viewport
            // positioning.
            document.documentElement.appendChild(box);
        } else if (!box) {
            box = document.createElement('div');
            box.id = 'submarine-box';
            box.setAttribute('aria-hidden', 'true');
            document.documentElement.appendChild(box);
        }
        return box;
    }

    function spawnSubmarine() {
        const box = ensureContainer();

        // Size the container to span the full document so submarines
        // scroll with the page (parallax) instead of staying viewport-fixed.
        // Use body.scrollHeight — the world boxes are siblings of body, so
        // this is independent of them (no feedback loop).
        box.style.height = document.body.scrollHeight + 'px';

        const width = rand(190, 280);
        const height = width * (100 / 240);
        const direction = Math.random() < 0.5 ? 'right' : 'left';

        // Spawn within the user's currently visible area, then the
        // submarine drifts with scroll like the rest of the world.
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const vh = window.innerHeight;
        const y = rand(scrollY + vh * 0.18, scrollY + vh * 0.72);

        const vw = window.innerWidth;
        const startX = direction === 'right' ? -width - 40 : vw + 40;
        const endX   = direction === 'right' ? vw + 40 : -width - 40;

        const wrap = document.createElement('div');
        wrap.className = 'submarine ' + (direction === 'right' ? 'sub-right' : 'sub-left');
        wrap.style.width = width.toFixed(0) + 'px';
        wrap.style.height = height.toFixed(0) + 'px';
        wrap.style.top = y.toFixed(0) + 'px';
        wrap.innerHTML =
            '<div class="sub-bob">' +
                '<div class="sub-body">' + SUB_SVG + '</div>' +
            '</div>';

        box.appendChild(wrap);

        const duration = rand(60, 110) * 1000;
        const anim = wrap.animate(
            [
                { transform: 'translateX(' + startX + 'px)' },
                { transform: 'translateX(' + endX + 'px)' }
            ],
            { duration: duration, easing: 'linear', fill: 'forwards' }
        );

        anim.onfinish = function () {
            wrap.remove();
            scheduleNext();
        };
    }

    function scheduleNext() {
        const delay = rand(60, 130) * 1000;
        setTimeout(spawnSubmarine, delay);
    }

    function start() {
        ensureContainer();
        setTimeout(spawnSubmarine, rand(12, 30) * 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
