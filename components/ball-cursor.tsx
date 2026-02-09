"use client";

import { useEffect, useRef } from "react";

export default function BallCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const outlineRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const mousePos = useRef({ x: -100, y: -100 });
  const outlinePos = useRef({ x: -100, y: -100 });
  const isHovering = useRef(false);
  const isClicking = useRef(false);
  const visible = useRef(false);

  useEffect(() => {
    const dot = dotRef.current;
    const outline = outlineRef.current;
    if (!dot || !outline) return;

    function onMouseMove(e: MouseEvent) {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (!visible.current) {
        visible.current = true;
        dot!.style.opacity = "1";
        outline!.style.opacity = "1";
      }
    }

    function onMouseDown() {
      isClicking.current = true;
    }

    function onMouseUp() {
      isClicking.current = false;
    }

    function onMouseEnterInteractive() {
      isHovering.current = true;
    }

    function onMouseLeaveInteractive() {
      isHovering.current = false;
    }

    function onMouseLeave() {
      visible.current = false;
      dot!.style.opacity = "0";
      outline!.style.opacity = "0";
    }

    function animate() {
      // Smooth follow for outline
      outlinePos.current.x += (mousePos.current.x - outlinePos.current.x) * 0.15;
      outlinePos.current.y += (mousePos.current.y - outlinePos.current.y) * 0.15;

      // Dot follows exactly
      dot!.style.transform = `translate(${mousePos.current.x}px, ${mousePos.current.y}px) translate(-50%, -50%)`;

      // Outline follows with lag
      const outlineScale = isClicking.current ? 0.7 : isHovering.current ? 1.6 : 1;
      outline!.style.transform = `translate(${outlinePos.current.x}px, ${outlinePos.current.y}px) translate(-50%, -50%) scale(${outlineScale})`;

      // Dot styling based on state
      const dotScale = isClicking.current ? 0.5 : isHovering.current ? 2.5 : 1;
      dot!.style.width = `${8 * dotScale}px`;
      dot!.style.height = `${8 * dotScale}px`;

      if (isHovering.current) {
        dot!.style.background = "rgba(59, 130, 246, 0.5)";
        dot!.style.mixBlendMode = "normal";
        outline!.style.borderColor = "rgba(59, 130, 246, 0.6)";
        outline!.style.background = "rgba(59, 130, 246, 0.05)";
      } else {
        dot!.style.background = "rgba(59, 130, 246, 1)";
        dot!.style.mixBlendMode = "normal";
        outline!.style.borderColor = "rgba(59, 130, 246, 0.35)";
        outline!.style.background = "transparent";
      }

      requestRef.current = requestAnimationFrame(animate);
    }

    // Attach listeners
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mouseleave", onMouseLeave);

    // Interactive elements get hover effect
    const interactiveSelector = "a, button, input, textarea, select, [role='button'], label, [data-interactive]";
    
    function attachHoverListeners() {
      const elements = document.querySelectorAll(interactiveSelector);
      elements.forEach((el) => {
        el.addEventListener("mouseenter", onMouseEnterInteractive);
        el.addEventListener("mouseleave", onMouseLeaveInteractive);
      });
      return elements;
    }
    
    let elements = attachHoverListeners();

    // Observe DOM for new interactive elements
    const observer = new MutationObserver(() => {
      elements.forEach((el) => {
        el.removeEventListener("mouseenter", onMouseEnterInteractive);
        el.removeEventListener("mouseleave", onMouseLeaveInteractive);
      });
      elements = attachHoverListeners();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(requestRef.current);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mouseleave", onMouseLeave);
      elements.forEach((el) => {
        el.removeEventListener("mouseenter", onMouseEnterInteractive);
        el.removeEventListener("mouseleave", onMouseLeaveInteractive);
      });
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {/* Inner dot */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] rounded-full"
        style={{
          width: 8,
          height: 8,
          background: "rgba(59, 130, 246, 1)",
          opacity: 0,
          transition: "width 0.2s ease, height 0.2s ease, background 0.2s ease, opacity 0.3s ease",
          willChange: "transform",
          boxShadow: "0 0 12px 2px rgba(59, 130, 246, 0.4)",
        }}
      />
      {/* Outer ring */}
      <div
        ref={outlineRef}
        className="pointer-events-none fixed top-0 left-0 z-[9998] rounded-full"
        style={{
          width: 36,
          height: 36,
          border: "2px solid rgba(59, 130, 246, 0.35)",
          opacity: 0,
          transition: "opacity 0.3s ease, border-color 0.2s ease, background 0.2s ease, transform 0.15s ease",
          willChange: "transform",
        }}
      />
    </>
  );
}
