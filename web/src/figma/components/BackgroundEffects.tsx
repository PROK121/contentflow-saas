export function BackgroundEffects() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Banking gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom right, #eef4f1 0%, #d8e3d2 45%, #e8f0ec 100%)",
        }}
      />

      {/* Subtle pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            repeating-linear-gradient(45deg, #4a8b83 0, #4a8b83 1px, transparent 0, transparent 50%)
          `,
          backgroundSize: "10px 10px",
        }}
      />

      {/* Soft vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 0%, rgba(74, 139, 131, 0.06) 100%)",
        }}
      />
    </div>
  );
}
