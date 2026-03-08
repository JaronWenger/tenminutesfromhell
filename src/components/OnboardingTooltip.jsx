import React, { useState, useEffect, useRef } from 'react';
import './OnboardingTooltip.css';

const ARROW_SIZE = 36;

const ArrowSVG = ({ direction, scale = 1 }) => {
  const size = ARROW_SIZE * scale;
  // Hand-drawn curved arrow paths with slight wobble
  const paths = {
    up: (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <path d="M18 32 C16 20, 20 14, 18 4" fill="none" stroke="#ff8c00" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M12 10 L18 3 L24 10" fill="none" stroke="#ff8c00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    down: (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <path d="M18 4 C16 16, 20 22, 18 32" fill="none" stroke="#ff8c00" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M12 26 L18 33 L24 26" fill="none" stroke="#ff8c00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    left: (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <path d="M32 18 C20 16, 14 20, 4 18" fill="none" stroke="#ff8c00" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M10 12 L3 18 L10 24" fill="none" stroke="#ff8c00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    right: (
      <svg width={size} height={size} viewBox="0 0 36 36">
        <path d="M4 18 C16 16, 22 20, 32 18" fill="none" stroke="#ff8c00" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M26 12 L33 18 L26 24" fill="none" stroke="#ff8c00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  };
  return <div className="onb-arrow">{paths[direction]}</div>;
};

const OnboardingTooltip = ({ targetSelector, text, arrowDirection = 'down', arrowTargetSelector, separateArrowTarget, onDismiss, autoDismiss = null, noOverlay = false, noArrow = false, arrowScale = 1, textScale = 1, delay = 0, offsetX = 0, offsetY = 0, arrowConfig, visible }) => {
  const [pos, setPos] = useState(null);
  const [arrowPath, setArrowPath] = useState(null);
  const [closing, setClosing] = useState(false);
  const [delayDone, setDelayDone] = useState(!delay);
  const [posReady, setPosReady] = useState(false);
  const dismissTimer = useRef(null);
  const wasVisible = useRef(false);
  const textRef = useRef(null);

  // Delay before showing
  useEffect(() => {
    if (!visible || !delay) { setDelayDone(!delay ? true : false); return; }
    setDelayDone(false);
    setPosReady(false);
    const t = setTimeout(() => setDelayDone(true), delay);
    return () => clearTimeout(t);
  }, [visible, delay]);

  // Position calculation
  useEffect(() => {
    if (!visible || !delayDone || !targetSelector) { setPos(null); return; }
    const calculate = () => {
      const el = document.querySelector(targetSelector);
      if (!el) { setPos(null); return; }
      const rect = el.getBoundingClientRect();
      const gap = 6;
      let top, left;

      if (arrowTargetSelector) {
        // Text centered above the target element
        top = rect.top - gap;
        left = rect.left + rect.width / 2;
      } else {
        switch (arrowDirection) {
          case 'down':
            top = rect.top - gap;
            left = rect.left + rect.width / 2;
            break;
          case 'up':
            top = rect.bottom + gap;
            left = rect.left + rect.width / 2;
            break;
          case 'left':
            top = rect.top + rect.height / 2;
            left = rect.right + gap;
            break;
          case 'right':
            top = rect.top + rect.height / 2;
            left = rect.left - gap;
            break;
          default:
            top = rect.top - gap;
            left = rect.left + rect.width / 2;
        }
      }
      setPos({ top: top + offsetY, left: left + offsetX });

      // Calculate curved arrow path to separate target
      if (arrowTargetSelector) {
        const arrowEl = document.querySelector(arrowTargetSelector);
        if (arrowEl && textRef.current) {
          const arrowRect = arrowEl.getBoundingClientRect();
          const textRect = textRef.current.getBoundingClientRect();
          // Arrow from above text to arrow target
          const ac = arrowConfig || {};
          const startX = textRect.left + textRect.width * (ac.startXPct || 0.63);
          const startY = textRect.top - 4;
          const endX = arrowRect.left + arrowRect.width * (ac.endXPct !== undefined ? ac.endXPct : 0.55);
          const endY = arrowRect.top + arrowRect.height * (ac.endYPct !== undefined ? ac.endYPct : 1.1);
          const cpX = ac.cpX !== undefined ? ac.cpX(startX, endX) : endX + 5;
          const cpY = ac.cpY !== undefined ? ac.cpY(startY, endY) : endY + 60;
          setArrowPath({ startX, startY, endX, endY, cpX, cpY });
        }
      }

      // Separate arrow (doesn't affect text positioning)
      if (separateArrowTarget && textRef.current) {
        const sepEl = document.querySelector(separateArrowTarget);
        if (sepEl) {
          const sepRect = sepEl.getBoundingClientRect();
          const textRect = textRef.current.getBoundingClientRect();
          const ac = arrowConfig || {};
          const startX = textRect.left + textRect.width * (ac.startXPct || 0.63);
          const startY = textRect.top - 4;
          const endX = sepRect.left + sepRect.width * (ac.endXPct !== undefined ? ac.endXPct : 0.5);
          const endY = sepRect.top + sepRect.height * (ac.endYPct !== undefined ? ac.endYPct : 0.5);
          const cpX = ac.cpX ? ac.cpX(startX, endX) : (startX + endX) / 2;
          const cpY = ac.cpY ? ac.cpY(startY, endY) : Math.min(startY, endY) - 30;
          setArrowPath({ startX, startY, endX, endY, cpX, cpY });
        }
      }
    };
    setPosReady(false);
    calculate();
    // Small delay to let textRef measure, then mark ready
    const t = setTimeout(() => { calculate(); setPosReady(true); }, 50);
    window.addEventListener('resize', calculate);
    return () => { window.removeEventListener('resize', calculate); clearTimeout(t); };
  }, [visible, delayDone, targetSelector, arrowDirection, arrowTargetSelector, offsetX, offsetY]);

  // Auto-dismiss (only after delay is done)
  useEffect(() => {
    if (!visible || !delayDone || !autoDismiss) return;
    dismissTimer.current = setTimeout(() => {
      handleDismiss();
    }, autoDismiss);
    return () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); };
  }, [visible, delayDone, autoDismiss]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track visibility for fade-out
  useEffect(() => {
    if (visible) wasVisible.current = true;
  }, [visible]);

  const handleDismiss = () => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      if (onDismiss) onDismiss();
    }, 250);
  };

  if ((!visible || !delayDone) && !closing) return null;
  if (!pos || (!posReady && !closing)) return null;

  // Transform so the arrow tip aligns with the target edge
  let transform;
  if (arrowTargetSelector) {
    // Text centered above the positioning target
    transform = 'translate(-50%, -100%)';
  } else {
    switch (arrowDirection) {
      case 'down':
        transform = 'translate(-50%, -100%)';
        break;
      case 'up':
        transform = 'translateX(-50%)';
        break;
      case 'left':
        transform = 'translateY(-50%)';
        break;
      case 'right':
        transform = 'translate(-100%, -50%)';
        break;
      default:
        transform = 'translate(-50%, -100%)';
    }
  }

  return (
    <>
      {/* Transparent tap layer — only for manual dismiss steps without noOverlay */}
      {!autoDismiss && !noOverlay && (
        <div className="onb-overlay" onClick={handleDismiss} onTouchEnd={handleDismiss} />
      )}
      <div
        className={`onb-tooltip ${arrowTargetSelector ? '' : `onb-arrow-${arrowDirection}`} ${closing ? 'onb-closing' : ''}`}
        style={{ top: pos.top, left: pos.left, transform }}
      >
        <div className="onb-text" ref={textRef} style={textScale !== 1 ? { fontSize: `${36 * textScale}px` } : undefined}>{typeof text === 'string' && text.includes('\n') ? text.split('\n').map((line, i) => <div key={i} style={i > 0 ? { paddingLeft: '4em' } : undefined}>{line}</div>) : text}</div>
        {!arrowTargetSelector && !noArrow && <ArrowSVG direction={arrowDirection} scale={arrowScale} />}
      </div>
      {(arrowTargetSelector || separateArrowTarget) && arrowPath && !(arrowConfig && arrowConfig.hidden) && (
        <svg
          className={`onb-custom-arrow ${closing ? 'onb-closing' : ''}`}
          style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 9999, pointerEvents: 'none' }}
        >
          <path
            d={`M${arrowPath.startX},${arrowPath.startY} Q${arrowPath.cpX},${arrowPath.cpY} ${arrowPath.endX},${arrowPath.endY}`}
            fill="none" stroke="#ff8c00" strokeWidth="2.5" strokeLinecap="round"
          />
          {/* Arrowhead — direction from control point to end */}
          {(() => {
            const dx = arrowPath.endX - arrowPath.cpX;
            const dy = arrowPath.endY - arrowPath.cpY;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / len, uy = dy / len;
            const px = -uy, py = ux; // perpendicular
            const s = 7;
            return (
              <path
                d={`M${arrowPath.endX - ux * s + px * s * 0.7},${arrowPath.endY - uy * s + py * s * 0.7} L${arrowPath.endX},${arrowPath.endY} L${arrowPath.endX - ux * s - px * s * 0.7},${arrowPath.endY - uy * s - py * s * 0.7}`}
                fill="none" stroke="#ff8c00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              />
            );
          })()}
        </svg>
      )}
    </>
  );
};

export default OnboardingTooltip;
