import { useEffect, useId, useMemo, useRef, useState } from "react";

const SIZE_STYLES = Object.freeze({
  md: {
    controlPadding: "10px 12px",
    controlRadius: 10,
    controlFontSize: 14,
    searchPadding: "10px 12px",
    searchFontSize: 13,
    optionPadding: "10px 12px",
    optionFontSize: 13,
  },
  sm: {
    controlPadding: "8px 10px",
    controlRadius: 8,
    controlFontSize: 13,
    searchPadding: "8px 10px",
    searchFontSize: 12,
    optionPadding: "8px 10px",
    optionFontSize: 12,
  },
});

function normalizeSearchValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function SearchableSelect({
  label,
  ariaLabel,
  value,
  onChange,
  options = [],
  colors,
  placeholder = "Select an option",
  searchPlaceholder = "Search options...",
  emptyMessage = "No matching options.",
  disabled = false,
  size = "md",
  showSearch = true,
  containerStyle,
  labelStyle,
  controlStyle,
  menuStyle,
  menuMaxHeight = 280,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const searchInputRef = useRef(null);
  const fallbackId = useId();
  const controlId = `${fallbackId}-searchable-select`;
  const sizing = SIZE_STYLES[size] ?? SIZE_STYLES.md;
  const normalizedValue = String(value ?? "");

  const selectedOption = useMemo(
    () => options.find((option) => String(option?.value ?? "") === normalizedValue) ?? null,
    [normalizedValue, options]
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const haystack = normalizeSearchValue([
        option?.label,
        option?.description,
        option?.searchText,
      ].filter(Boolean).join(" "));

      return haystack.includes(normalizedQuery);
    });
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !showSearch) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [isOpen, showSearch]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  function handleToggleMenu() {
    if (disabled) {
      return;
    }

    setIsOpen((current) => !current);
  }

  function handleSelect(nextValue, optionDisabled) {
    if (optionDisabled) {
      return;
    }

    onChange(nextValue);
    setIsOpen(false);
  }

  return (
    <div ref={rootRef} style={{ position: "relative", display: "grid", gap: 6, minWidth: 0, ...containerStyle }}>
      {label ? (
        <div style={{ fontSize: 11, color: colors.muted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 800, ...labelStyle }}>
          {label}
        </div>
      ) : null}
      <button
        id={controlId}
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={handleToggleMenu}
        disabled={disabled}
        aria-label={ariaLabel ?? label ?? placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          background: disabled ? colors.header : "#0f2640",
          border: `1px solid ${isOpen ? colors.accent : colors.border}`,
          borderRadius: sizing.controlRadius,
          color: selectedOption ? colors.text : colors.muted,
          fontSize: sizing.controlFontSize,
          fontWeight: 700,
          padding: sizing.controlPadding,
          fontFamily: "inherit",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "left",
          ...controlStyle,
        }}
      >
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span style={{ color: colors.muted, fontSize: sizing.controlFontSize, flexShrink: 0 }}>{isOpen ? "^" : "v"}</span>
      </button>

      {isOpen ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: `linear-gradient(180deg, ${colors.header} 0%, ${colors.panel} 100%)`,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.35)",
            overflow: "hidden",
            ...menuStyle,
          }}
        >
          {showSearch ? (
            <div style={{ padding: 10, borderBottom: `1px solid ${colors.border}` }}>
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  background: colors.bg,
                  border: `1px solid ${colors.border}`,
                  borderRadius: sizing.controlRadius,
                  color: colors.text,
                  fontSize: sizing.searchFontSize,
                  padding: sizing.searchPadding,
                  fontFamily: "inherit",
                }}
              />
            </div>
          ) : null}

          <div role="listbox" aria-label={ariaLabel ?? label ?? placeholder} style={{ maxHeight: menuMaxHeight, overflowY: "auto", display: "grid", gap: 2, padding: 6 }}>
            {filteredOptions.length ? filteredOptions.map((option) => {
              const optionValue = String(option?.value ?? "");
              const isSelected = optionValue === normalizedValue;
              const optionDisabled = Boolean(option?.disabled);

              return (
                <button
                  key={optionValue}
                  type="button"
                  onClick={() => handleSelect(option.value, optionDisabled)}
                  disabled={optionDisabled}
                  style={{
                    display: "grid",
                    gap: option?.description ? 4 : 0,
                    width: "100%",
                    textAlign: "left",
                    background: isSelected ? `${colors.accent}18` : "transparent",
                    border: `1px solid ${isSelected ? colors.accent : "transparent"}`,
                    borderRadius: 10,
                    color: optionDisabled ? colors.muted : colors.text,
                    padding: sizing.optionPadding,
                    fontSize: sizing.optionFontSize,
                    fontWeight: isSelected ? 800 : 700,
                    fontFamily: "inherit",
                    cursor: optionDisabled ? "not-allowed" : "pointer",
                    opacity: optionDisabled ? 0.7 : 1,
                  }}
                >
                  <span>{option?.label ?? optionValue}</span>
                  {option?.description ? (
                    <span style={{ fontSize: Math.max(11, sizing.optionFontSize - 1), color: colors.muted, fontWeight: 600 }}>{option.description}</span>
                  ) : null}
                </button>
              );
            }) : (
              <div style={{ color: colors.muted, fontSize: 12, padding: "10px 12px" }}>{emptyMessage}</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}