const container = document.getElementById('bubble-box');
const docHeight = document.documentElement.scrollHeight;

const BUBBLE_COUNT = 5;

function spawnBubbles(bubbleCount, isLeft) {
    for (let i = 0; i < bubbleCount; i++) {
        const bubble = document.createElement('div');
        const size = Math.random() * 50 + 100 + 'px';
        const speed = Math.random() * 50 + 50;

        bubble.className = 'bubble';
        bubble.style.width = size;
        bubble.style.height = size;

        if (isLeft) {
            bubble.style.left = Math.random() * 10 + 'vw';
        }
        else {
            bubble.style.right = Math.random() * 10 + 'vw';
        }
        
        bubble.style.setProperty('--speed', speed + 's');
        bubble.style.setProperty('--dist', `-${docHeight + 100}px`);
        
        bubble.style.animationDelay = `-${Math.random() * speed}s`;
        
        container.appendChild(bubble);
    }
}

spawnBubbles(BUBBLE_COUNT, true);
spawnBubbles(BUBBLE_COUNT, false);
