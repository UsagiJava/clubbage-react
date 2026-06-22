import { useEffect, useRef } from "react";
import { decodeHtmlEntities } from "../utils/htmlDecoder";

function renderPart(part, key) {
    if (typeof part === "string") {
        return <span key={key}>{decodeHtmlEntities(part)}</span>;
    }

    const style = {};
    if (part.bold) style.fontWeight = "bold";
    if (part.color) style.color = part.color;
    if (part.italic) style.fontStyle = "italic";
    if (part.underline) {
        style.textDecoration = "underline";
        style.textUnderlineOffset = "0.2em";
    }

    return (
        <span key={key} style={style}>
            {decodeHtmlEntities(part.text)}
        </span>
    );
}

function GameLog({ entries = [] }) {
    const logRef = useRef(null);

    useEffect(() => {
        const log = logRef.current;
        if (!log) return;
        log.scrollTop = log.scrollHeight;
    }, [entries]);

    return (
        <div className="game_commentary_row">
            <div id="gameLog" ref={logRef} className="game_commentary_log overflow-auto">
                {entries.map((entry) => (
                    <div key={entry.id} className={`game_commentary_log_entry ${entry.type || "game_info"}`}>
                        {typeof entry.parts === "string"
                            ? decodeHtmlEntities(entry.parts)
                            : (entry.parts || []).map((part, index) => renderPart(part, `${entry.id}-${index}`))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default GameLog;
