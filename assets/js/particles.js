/**
 * Neural Network Particle Background
 * Draws animated nodes connected by glowing lines — AI/ML aesthetic
 */
(function () {
  'use strict';

  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, nodes, animId;

  const CONFIG = {
    nodeCount: 60,
    maxDist: 160,
    nodeRadius: 1.8,
    speed: 0.3,
    primaryColor: '0, 212, 255',
    secondaryColor: '124, 58, 237',
    opacity: 0.6,
    lineOpacity: 0.15,
  };

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createNode() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * CONFIG.speed,
      vy: (Math.random() - 0.5) * CONFIG.speed,
      r: Math.random() * CONFIG.nodeRadius + 0.8,
      color: Math.random() > 0.7 ? CONFIG.secondaryColor : CONFIG.primaryColor,
      pulse: Math.random() * Math.PI * 2,
    };
  }

  function init() {
    resize();
    nodes = Array.from({ length: CONFIG.nodeCount }, createNode);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Update positions
    for (const node of nodes) {
      node.x += node.vx;
      node.y += node.vy;
      node.pulse += 0.02;

      if (node.x < 0 || node.x > W) node.vx *= -1;
      if (node.y < 0 || node.y > H) node.vy *= -1;
    }

    // Draw lines
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < CONFIG.maxDist) {
          const alpha = (1 - dist / CONFIG.maxDist) * CONFIG.lineOpacity;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(${a.color}, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const pulse = 0.8 + Math.sin(node.pulse) * 0.2;
      const r = node.r * pulse;
      const alpha = CONFIG.opacity * (0.7 + Math.sin(node.pulse) * 0.3);

      // Glow
      const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 4);
      grad.addColorStop(0, `rgba(${node.color}, ${alpha * 0.4})`);
      grad.addColorStop(1, `rgba(${node.color}, 0)`);
      ctx.beginPath();
      ctx.arc(node.x, node.y, r * 4, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${node.color}, ${alpha})`;
      ctx.fill();
    }

    animId = requestAnimationFrame(draw);
  }

  window.addEventListener('resize', () => {
    cancelAnimationFrame(animId);
    init();
    draw();
  });

  init();
  draw();
})();
