export function GlassOverlay() {
  return (
    <>
      {/* Top left glass reflection */}
      <div
        className="absolute top-0 left-0 w-full h-1/2 rounded-t-[2rem] pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, transparent 100%)',
          opacity: 0.4,
        }}
      />

      {/* Specular highlight */}
      <div
        className="absolute top-4 left-4 right-4 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.8) 50%, transparent 100%)',
        }}
      />

      {/* Bottom edge light */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
        }}
      />
    </>
  );
}
