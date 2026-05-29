(function () {
    'use strict';

    const FISH_PER_PX = 1 / 240;
    const MIN_FISH = 10;
    const MAX_FISH = 45;

    const COLORS = [
        '#ff8c42', '#ffd55a', '#5dade2', '#48c9b0',
        '#ec7063', '#f4a261', '#bb8fce', '#fa8072',
        '#e67e22', '#16a085', '#d35400', '#8e44ad'
    ];

    // Each variant's SVG is drawn facing RIGHT (head on the right, tail on the left).
    // Left-swimming fish are flipped at render time via `transform: scaleX(-1)`.
    const VARIANTS = [
        {
            // Classic oval fish
            ratio: 0.50,
            minW: 34,
            maxW: 64,
            svg:
                '<svg viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">' +
                '<g fill="currentColor">' +
                '<ellipse cx="32" cy="15" rx="22" ry="10"/>' +
                '<g class="fish-tail"><path d="M 12 15 L 0 6 L 4 15 L 0 24 Z"/></g>' +
                '<path d="M 30 5 L 35 0 L 38 6 Z" opacity="0.85"/>' +
                '</g>' +
                '<circle cx="44" cy="12" r="2" fill="white"/>' +
                '<circle cx="44" cy="12" r="1" fill="#222"/>' +
                '</svg>'
        },
        {
            // Slim torpedo (long, narrow — barracuda/tetra-like)
            ratio: 0.34,
            minW: 44,
            maxW: 84,
            svg:
                '<svg viewBox="0 0 70 24" xmlns="http://www.w3.org/2000/svg">' +
                '<g fill="currentColor">' +
                '<ellipse cx="35" cy="12" rx="28" ry="5"/>' +
                '<g class="fish-tail"><path d="M 7 12 L -2 4 L 2 12 L -2 20 Z"/></g>' +
                '<path d="M 28 7 L 34 2 L 40 7 Z" opacity="0.85"/>' +
                '<path d="M 28 17 L 32 22 L 38 17 Z" opacity="0.8"/>' +
                '</g>' +
                '<circle cx="55" cy="10" r="1.6" fill="white"/>' +
                '<circle cx="55" cy="10" r="0.8" fill="#222"/>' +
                '</svg>'
        },
        {
            // Chunky puffer/round fish
            ratio: 0.72,
            minW: 30,
            maxW: 54,
            svg:
                '<svg viewBox="0 0 60 42" xmlns="http://www.w3.org/2000/svg">' +
                '<g fill="currentColor">' +
                '<ellipse cx="30" cy="21" rx="18" ry="16"/>' +
                '<g class="fish-tail"><path d="M 12 21 L 2 12 L 6 21 L 2 30 Z"/></g>' +
                '<path d="M 26 5 L 32 0 L 38 5 Z" opacity="0.85"/>' +
                '<path d="M 32 37 L 36 42 L 42 37 Z" opacity="0.75"/>' +
                '</g>' +
                '<circle cx="40" cy="18" r="2.2" fill="white"/>' +
                '<circle cx="40" cy="18" r="1.1" fill="#222"/>' +
                // tiny dots for puffer-like texture
                '<circle cx="28" cy="14" r="0.8" fill="rgba(0,0,0,0.18)"/>' +
                '<circle cx="22" cy="22" r="0.8" fill="rgba(0,0,0,0.18)"/>' +
                '<circle cx="30" cy="28" r="0.8" fill="rgba(0,0,0,0.18)"/>' +
                '</svg>'
        },
        {
            // Angelfish — tall diamond body with prominent vertical fins
            ratio: 0.95,
            minW: 28,
            maxW: 52,
            svg:
                '<svg viewBox="0 0 60 56" xmlns="http://www.w3.org/2000/svg">' +
                '<g fill="currentColor">' +
                '<path d="M 32 14 L 50 28 L 32 42 L 14 28 Z"/>' +
                '<g class="fish-tail"><path d="M 14 28 L 4 18 L 8 28 L 4 38 Z"/></g>' +
                // tall top fin
                '<path d="M 24 16 L 30 2 L 38 16 Z" opacity="0.88"/>' +
                // tall bottom fin
                '<path d="M 24 40 L 30 54 L 38 40 Z" opacity="0.88"/>' +
                // pectoral fin
                '<path d="M 30 28 L 26 36 L 34 32 Z" opacity="0.6"/>' +
                '</g>' +
                '<circle cx="42" cy="25" r="2" fill="white"/>' +
                '<circle cx="42" cy="25" r="1" fill="#222"/>' +
                '</svg>'
        },
        {
            // Long-tailed betta — small body, sweeping flowy tail
            ratio: 0.48,
            minW: 50,
            maxW: 90,
            svg:
                '<svg viewBox="0 0 80 38" xmlns="http://www.w3.org/2000/svg">' +
                '<g fill="currentColor">' +
                '<ellipse cx="56" cy="19" rx="17" ry="8"/>' +
                // sweeping flowy tail
                '<g class="fish-tail"><path d="M 39 19 Q 26 9 4 4 Q 12 19 4 34 Q 26 29 39 19 Z" opacity="0.88"/></g>' +
                // top fin sweeping back
                '<path d="M 50 11 Q 48 1 38 4 Q 46 8 50 11 Z" opacity="0.85"/>' +
                // bottom fin sweeping back
                '<path d="M 50 27 Q 48 37 38 34 Q 46 30 50 27 Z" opacity="0.85"/>' +
                '</g>' +
                '<circle cx="66" cy="16" r="1.8" fill="white"/>' +
                '<circle cx="66" cy="16" r="0.9" fill="#222"/>' +
                '</svg>'
        }
    ];

    function rand(min, max) {
        return min + Math.random() * (max - min);
    }

    function pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    function makeFish(direction, boxHeight, vw) {
        const variant = pick(VARIANTS);
        const width = rand(variant.minW, variant.maxW);
        const height = width * variant.ratio;

        const fish = document.createElement('div');
        fish.className = 'fish ' + (direction === 'right' ? 'fish-right' : 'fish-left');

        fish.style.width = width.toFixed(1) + 'px';
        fish.style.height = height.toFixed(1) + 'px';
        fish.innerHTML = variant.svg;

        const y = rand(0, Math.max(1, boxHeight));
        fish.style.top = y.toFixed(1) + 'px';

        const travel = vw + width * 3;
        if (direction === 'right') {
            fish.style.left = (-width * 1.5).toFixed(1) + 'px';
            fish.style.setProperty('--dist', travel.toFixed(1) + 'px');
        } else {
            fish.style.left = (vw + width * 0.5).toFixed(1) + 'px';
            fish.style.setProperty('--dist', (-travel).toFixed(1) + 'px');
        }

        const velocity = rand(25, 75);
        const dur = travel / velocity;
        fish.style.setProperty('--dur', dur.toFixed(1) + 's');
        fish.style.setProperty('--delay', '-' + rand(0, dur).toFixed(1) + 's');

        fish.style.setProperty('--wobble', rand(6, 14).toFixed(1) + 'px');
        fish.style.setProperty('--wag', rand(0.4, 0.85).toFixed(2) + 's');

        fish.style.color = pick(COLORS);

        return fish;
    }

    function ensureContainer() {
        let box = document.getElementById('fish-box');
        if (box && box.parentNode !== document.documentElement) {
            document.documentElement.appendChild(box);
        } else if (!box) {
            box = document.createElement('div');
            box.id = 'fish-box';
            box.setAttribute('aria-hidden', 'true');
            document.documentElement.appendChild(box);
        }
        return box;
    }

    function populate() {
        const box = ensureContainer();

        box.innerHTML = '';

        // Use body.scrollHeight (not documentElement.scrollHeight): the world
        // boxes are siblings of body, so body.scrollHeight is independent of
        // them and there's no feedback loop that inflates the document.
        const docHeight = document.body.scrollHeight;
        if (docHeight < 1) return;
        box.style.height = docHeight + 'px';
        const boxHeight = docHeight;

        const vw = window.innerWidth;
        const count = Math.min(
            MAX_FISH,
            Math.max(MIN_FISH, Math.round(boxHeight * FISH_PER_PX))
        );

        const frag = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const direction = Math.random() < 0.5 ? 'right' : 'left';
            frag.appendChild(makeFish(direction, boxHeight, vw));
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
