const SUIT_ICONS = {
    hearts: "bi-suit-heart-fill text-red",
    diamonds: "bi-suit-diamond-fill text-red",
    clubs: "bi-suit-club-fill text-black",
    spades: "bi-suit-spade-fill text-black"
};

/**
 * Reusable card-hand display used by both Corner (crib selection) and Round (barrage play).
 *
 * Props:
 *   hand            – array of card objects
 *   selectedCardIds – array of selected card IDs
 *   onToggleCard    – (cardId) => void — called on card click
 *   onSend          – () => void — send / play button (omit to hide)
 *   onSortBySuit    – () => void — sort-by-suit button (omit to hide)
 *   onSortByValue   – () => void — sort-by-value button (omit to hide)
 *   onShuffle       – () => void — shuffle button (omit to hide)
 *   sendDisabled    – boolean
 *   faceDown        – boolean – render all cards face-down
 *   disabled        – boolean – disable card interaction and manage buttons
 *   label           – aria-label for the card list
 */
function HandDisplay({
    hand = [],
    selectedCardIds = [],
    onToggleCard,
    onSend,
    onSortBySuit,
    onSortByValue,
    onShuffle,
    sendDisabled = false,
    faceDown = false,
    flipCards = false,
    disabled = false,
    label = "Hand"
}) {
    const hasCards = hand.length > 0;
    const showManage = Boolean(onSortBySuit || onSortByValue || onShuffle);

    return (
        <div className="hand-display">
            <div className="cards_table hand-display__cards" role="list" aria-label={label}>
                {hand.map((card) => {
                    const isSelected = selectedCardIds.includes(card.id);
                    const suitIconClass = SUIT_ICONS[card.suit] || "bi-question-circle";
                    return (
                        <button
                            key={card.id}
                            type="button"
                            className={`corner-card${faceDown ? " corner-card--facedown" : ""}${isSelected ? " corner-card--selected" : ""}${flipCards && !faceDown ? " corner-card--flip-reveal" : ""}`}
                            onClick={() => !faceDown && !disabled && onToggleCard?.(card.id)}
                            disabled={faceDown || disabled}
                            aria-label={faceDown ? "Face-down card" : `${card.rank} of ${card.suit}`}
                        >
                            {!faceDown ? (
                                <>
                                    <span className="corner-card__rank">{card.rank}</span>
                                    <span className="corner-card__suit" aria-hidden="true">
                                        <i className={`bi ${suitIconClass} d-block`} />
                                    </span>
                                </>
                            ) : null}
                        </button>
                    );
                })}
            </div>
            {(onSend || showManage) ? (
                <div className="controls_table">
                    {onSend ? (
                        <div className="text-center pb-1">
                            <button
                                type="button"
                                className="menu-btn text-nowrap px-2 py-1"
                                onClick={onSend}
                                disabled={sendDisabled}
                                aria-label="Send"
                                title="Send"
                            >
                                <i className="bi bi-arrow-up" />
                            </button>
                        </div>
                    ) : null}
                    {showManage ? (
                        <div className="text-center hand-display__manage-row">
                            {onSortBySuit ? (
                                <button type="button" className="menu-btn text-nowrap px-2 py-1" onClick={onSortBySuit} disabled={!hasCards || disabled} aria-label="Sort Suit" title="Sort Suit">
                                    <i className="bi bi-arrow-left" />
                                </button>
                            ) : null}
                            {onShuffle ? (
                                <button type="button" className="menu-btn text-nowrap px-2 py-1 hand-display__shuffle-btn" onClick={onShuffle} disabled={!hasCards || disabled} aria-label="Shuffle" title="Shuffle">
                                    <i className="bi bi-arrow-down" />
                                </button>
                            ) : null}
                            {onSortByValue ? (
                                <button type="button" className="menu-btn text-nowrap px-2 py-1" onClick={onSortByValue} disabled={!hasCards || disabled} aria-label="Sort Value" title="Sort Value">
                                    <i className="bi bi-arrow-right" />
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export default HandDisplay;
