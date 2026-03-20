export function PresetsModalShell({ colors, title, subtitle, onClose, children, actions = null, maxWidth = 980 }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(3, 8, 18, 0.82)",
        backdropFilter: "blur(10px)",
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth,
          maxHeight: "88vh",
          overflow: "hidden",
          borderRadius: 18,
          border: `1px solid ${colors.border}`,
          background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 18%, ${colors.bg} 100%)`,
          boxShadow: "0 24px 80px rgba(0, 0, 0, 0.42)",
          display: "grid",
          gridTemplateRows: "auto 1fr",
        }}
      >
        <div style={{ padding: 20, borderBottom: `1px solid ${colors.border}`, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "0.03em" }}>{title}</div>
            {subtitle ? <div style={{ fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 1.5 }}>{subtitle}</div> : null}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {actions}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                color: colors.muted,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                width: 40,
                height: 40,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: 20 }}>
          {children}
        </div>
      </div>
    </div>
  );
}