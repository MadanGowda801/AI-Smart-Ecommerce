import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  Sparkles,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { formatINR } from './productsService';

/**
 * Wrapper for Google's <model-viewer> web component for GLB/WebAR mode.
 */
function ModelViewerElement({ src, poster, alt, onModelError }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = () => {
      if (onModelError) onModelError();
    };
    el.addEventListener('error', handler);
    return () => el.removeEventListener('error', handler);
  }, [onModelError]);

  return (
    // eslint-disable-next-line react/no-unknown-property
    <model-viewer
      ref={ref}
      src={src}
      poster={poster}
      alt={alt}
      camera-controls
      auto-rotate
      ar
      ar-modes="webxr scene-viewer quick-look"
      shadow-intensity="1"
      exposure="0.9"
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        '--progress-bar-color': '#10b981'
      }}
    />
  );
}

export default function Interactive3DViewer({ product }) {
  const [renderMode, setRenderMode] = useState('studio3d'); // 'studio3d' | 'glb'
  const [rotX, setRotX] = useState(-10);
  const [rotY, setRotY] = useState(25);
  const [zoom, setZoom] = useState(1);
  const [autoRotate, setAutoRotate] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [glbError, setGlbError] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0, rotX: 0, rotY: 0 });
  const containerRef = useRef(null);

  // Smooth 3D rotation when enabled and not dragging
  useEffect(() => {
    if (!autoRotate || isDragging || renderMode !== 'studio3d') return;
    const interval = setInterval(() => {
      setRotY((prev) => (prev + 0.6) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, [autoRotate, isDragging, renderMode]);

  const handlePointerDown = (e) => {
    if (renderMode !== 'studio3d') return;
    setIsDragging(true);
    setAutoRotate(false);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      rotX,
      rotY
    };
  };

  const handlePointerMove = (e) => {
    if (!isDragging || renderMode !== 'studio3d') return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;

    const nextRotY = dragStartRef.current.rotY + deltaX * 0.65;
    const nextRotX = Math.max(-45, Math.min(45, dragStartRef.current.rotX - deltaY * 0.45));

    setRotY(nextRotY);
    setRotX(nextRotX);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setRotX(-10);
    setRotY(25);
    setZoom(1);
    setAutoRotate(true);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const primaryImage = product?.image || product?.images?.[0];

  return (
    <div
      ref={containerRef}
      style={{
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 50% 35%, rgba(99, 102, 241, 0.28) 0%, rgba(15, 23, 42, 0.96) 65%, #070b14 100%)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        marginBottom: '1rem',
        height: isFullscreen ? '100vh' : '440px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)'
      }}
    >
      {/* Top 3D Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.6rem 0.85rem',
          background: 'rgba(10, 14, 26, 0.75)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          zIndex: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: 'rgba(16, 185, 129, 0.16)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#34d399',
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: '6px'
            }}
          >
            <Box size={12} /> 3D VIEW
          </span>
          <span style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
            {product?.name}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <button
            type="button"
            onClick={() => setRenderMode('studio3d')}
            style={{
              background: renderMode === 'studio3d' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255,255,255,0.05)',
              border: renderMode === 'studio3d' ? '1px solid #818cf8' : '1px solid rgba(255,255,255,0.1)',
              color: renderMode === 'studio3d' ? '#fff' : '#94a3b8',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.22rem 0.55rem',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            3D View
          </button>
          {product?.model3dUrl && (
            <button
              type="button"
              onClick={() => {
                setRenderMode('glb');
                setGlbError(false);
              }}
              style={{
                background: renderMode === 'glb' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.05)',
                border: renderMode === 'glb' ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.1)',
                color: renderMode === 'glb' ? '#fff' : '#94a3b8',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.22rem 0.55rem',
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              AR / GLB
            </button>
          )}
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen 3D View"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#cbd5e1',
              padding: '0.22rem 0.4rem',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Main 3D Stage */}
      {renderMode === 'glb' && product?.model3dUrl && !glbError ? (
        <div style={{ flex: 1, position: 'relative' }}>
          <ModelViewerElement
            src={product.model3dUrl}
            poster={primaryImage}
            alt={`3D model of ${product.name}`}
            onModelError={() => setGlbError(true)}
          />
        </div>
      ) : (
        <div
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            perspective: '1200px',
            cursor: isDragging ? 'grabbing' : 'grab',
            overflow: 'hidden'
          }}
        >
          {/* 3D Perspective Floor Grid */}
          <div
            style={{
              position: 'absolute',
              bottom: '-45px',
              width: '140%',
              height: '190px',
              backgroundImage:
                'linear-gradient(to right, rgba(99, 102, 241, 0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(99, 102, 241, 0.16) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
              transform: 'rotateX(72deg)',
              pointerEvents: 'none',
              maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 75%)'
            }}
          />

          {/* Glowing Pedestal Shadow */}
          <div
            style={{
              position: 'absolute',
              bottom: '28px',
              width: '240px',
              height: '36px',
              borderRadius: '50%',
              background: 'radial-gradient(ellipse at center, rgba(99, 102, 241, 0.45) 0%, transparent 70%)',
              filter: 'blur(8px)',
              transform: `scale(${zoom})`,
              pointerEvents: 'none'
            }}
          />

          {/* 3D Rotatable Product Stage */}
          <div
            style={{
              width: '270px',
              height: '250px',
              position: 'relative',
              transformStyle: 'preserve-3d',
              transform: `scale(${zoom}) rotateX(${rotX}deg) rotateY(${rotY}deg)`,
              transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)'
            }}
          >
            {/* Front 3D Product Face */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '18px',
                overflow: 'hidden',
                background: 'rgba(15, 23, 42, 0.9)',
                border: '2px solid #818cf8',
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.65), 0 0 25px rgba(99, 102, 241, 0.45)',
                transform: 'translateZ(16px)'
              }}
            >
              <img
                src={primaryImage}
                alt={product?.name}
                draggable={false}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://placehold.co/700x500/1e293b/6366f1?text=${encodeURIComponent(product?.name || '3D View')}`;
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  pointerEvents: 'none'
                }}
              />
              {/* Dynamic Specular Glare Overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(${115 + (rotY % 90)}deg, rgba(255,255,255,0.22) 0%, transparent 45%, rgba(0,0,0,0.25) 100%)`,
                  pointerEvents: 'none'
                }}
              />
            </div>

            {/* 3D Depth Frame Layer */}
            <div
              style={{
                position: 'absolute',
                inset: '4px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                background: 'rgba(30, 41, 59, 0.55)',
                transform: 'translateZ(0px)',
                pointerEvents: 'none'
              }}
            />

            {/* Floating 3D Badges */}
            <div
              style={{
                position: 'absolute',
                top: '-14px',
                right: '-28px',
                transform: 'translateZ(36px)',
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid #818cf8',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.72rem',
                fontWeight: 800,
                boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none'
              }}
            >
              {formatINR(product?.price)}
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '-28px',
                transform: 'translateZ(32px)',
                background: 'rgba(16, 185, 129, 0.92)',
                color: '#fff',
                padding: '3px 9px',
                borderRadius: '20px',
                fontSize: '0.66rem',
                fontWeight: 700,
                boxShadow: '0 8px 20px rgba(0,0,0,0.45)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Sparkles size={10} /> 3D Interactive
            </div>
          </div>

          {/* Left Controls: Auto-Rotate, Zoom, Reset */}
          <div
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              zIndex: 10
            }}
          >
            <button
              type="button"
              onClick={() => setAutoRotate((prev) => !prev)}
              title={autoRotate ? 'Pause 3D Rotation' : 'Start 3D Rotation'}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: autoRotate ? 'rgba(16, 185, 129, 0.25)' : 'rgba(15, 23, 42, 0.8)',
                border: autoRotate ? '1px solid #34d399' : '1px solid rgba(255,255,255,0.12)',
                color: autoRotate ? '#34d399' : '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {autoRotate ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.15).toFixed(2)))}
              title="Zoom In"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.15).toFixed(2)))}
              title="Zoom Out"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <ZoomOut size={14} />
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="Reset 3D View"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={14} />
            </button>
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              right: '12px',
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(8px)',
              borderRadius: '8px',
              padding: '4px 10px',
              fontSize: '0.7rem',
              color: '#a7f3d0',
              fontWeight: 600,
              pointerEvents: 'none'
            }}
          >
            🖱 Drag to rotate in 3D · Use +/- to zoom
          </div>
        </div>
      )}
    </div>
  );
}
