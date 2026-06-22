function HitBar({
    label,
    value,
    maxValue,
    side = "neutral",
    accentColor,
    caption,
    className = ""
}) {
    const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 0;
    const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
    const clampedValue = safeMax > 0 ? Math.min(safeValue, safeMax) : safeValue;
    const fillPercent = safeMax > 0 ? Math.max(0, Math.min(100, (clampedValue / safeMax) * 100)) : 0;
    const style = accentColor ? { "--hit-bar-accent": accentColor } : undefined;

    return (
        <div className={`hit-bar hit-bar--${side} ${className}`.trim()} style={style}>
            <div className="hit-bar__header">
                <span className="hit-bar__label">{label}</span>
                <span className="hit-bar__value">
                    {clampedValue}/{safeMax || clampedValue || 0}
                </span>
            </div>
            <div className="hit-bar__track" aria-hidden="true">
                <div className="hit-bar__fill" style={{ width: `${fillPercent}%` }} />
            </div>
            {caption ? <div className="hit-bar__caption">{caption}</div> : null}
        </div>
    );
}

export default HitBar;
