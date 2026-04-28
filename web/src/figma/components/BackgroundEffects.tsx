export function BackgroundEffects() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* iPhone 17 Pro — sage background */}
      <div className="absolute inset-0" style={{ background: "#dde5de" }} />

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: "200px 200px",
        }}
      />

      {/* Very soft green glow top-left */}
      <div
        className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-25"
        style={{ background: "radial-gradient(circle, rgba(45,158,117,0.18) 0%, transparent 70%)" }}
      />

      {/* Soft warm glow bottom-right */}
      <div
        className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, rgba(163,201,93,0.15) 0%, transparent 70%)" }}
      />
    </div>
  );
}
