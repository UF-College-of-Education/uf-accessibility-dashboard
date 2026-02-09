"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  alpha: number;
  color: string;
}

const COLORS = [
  "59, 130, 246",  // blue
  "6, 182, 212",   // cyan
  "99, 102, 241",  // indigo
  "16, 185, 129",  // emerald
];

export default function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const scrollRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;

    function resize() {
      width = window.innerWidth;
      height = document.documentElement.scrollHeight;
      canvas!.width = width;
      canvas!.height = height;
      if (particlesRef.current.length === 0) {
        initParticles();
      }
    }

    function initParticles() {
      const count = Math.min(Math.floor((width * height) / 18000), 100);
      particlesRef.current = [];
      for (let i = 0; i < count; i++) {
        particlesRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 2 + 1,
          baseAlpha: Math.random() * 0.3 + 0.1,
          alpha: 0,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
    }

    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      const scroll = scrollRef.current;
      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y + scroll;
      const interactionRadius = 180;
      const connectionDistance = 130;

      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Mouse interaction - repel / attract
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < interactionRadius) {
          const force = (interactionRadius - dist) / interactionRadius;
          // Push particles away from mouse, creates a "ripple" feel
          p.vx += (dx / dist) * force * 0.08;
          p.vy += (dy / dist) * force * 0.08;
          // Glow up particles near mouse
          p.alpha = Math.min(p.baseAlpha + force * 0.6, 0.9);
        } else {
          // Fade back to base
          p.alpha += (p.baseAlpha - p.alpha) * 0.02;
        }

        // Dampen velocity
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
        ctx.fill();

        // Glow for brighter particles
        if (p.alpha > 0.3) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 3);
          grad.addColorStop(0, `rgba(${p.color}, ${p.alpha * 0.3})`);
          grad.addColorStop(1, `rgba(${p.color}, 0)`);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Connect nearby particles with lines
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const ddx = p.x - p2.x;
          const ddy = p.y - p2.y;
          const ddist = Math.sqrt(ddx * ddx + ddy * ddy);

          if (ddist < connectionDistance) {
            const lineAlpha = (1 - ddist / connectionDistance) * Math.max(p.alpha, p2.alpha) * 0.4;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(${p.color}, ${lineAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw lines from mouse to nearby particles
      for (const p of particles) {
        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < interactionRadius * 0.8) {
          const alpha = (1 - dist / (interactionRadius * 0.8)) * 0.15;
          ctx.beginPath();
          ctx.moveTo(mouseX, mouseY);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }

      rafRef.current = requestAnimationFrame(animate);
    }

    function onMouseMove(e: MouseEvent) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    }

    function onScroll() {
      scrollRef.current = window.scrollY;
      // Resize canvas to match new scroll height
      const newHeight = document.documentElement.scrollHeight;
      if (Math.abs(canvas!.height - newHeight) > 100) {
        canvas!.height = newHeight;
      }
    }

    function onMouseLeave() {
      mouseRef.current = { x: -9999, y: -9999 };
    }

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseleave", onMouseLeave);

    resize();
    rafRef.current = requestAnimationFrame(animate);

    // Re-measure height periodically as content loads
    const interval = setInterval(() => {
      const newHeight = document.documentElement.scrollHeight;
      if (canvas && Math.abs(canvas.height - newHeight) > 100) {
        height = newHeight;
        canvas.height = height;
      }
    }, 2000);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseleave", onMouseLeave);
      clearInterval(interval);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ width: "100%", height: "100%" }}
      aria-hidden="true"
    />
  );
}
