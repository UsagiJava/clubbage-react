import { useEffect, useMemo, useRef, useState } from "react";
import { decodeHtmlEntities } from "../utils/htmlDecoder";
import HitBar from "../components/HitBar";
import HandDisplay from "../components/HandDisplay";
import GameLog from "../components/GameLog";
import OpponentSpriteAnimator from "../components/OpponentSpriteAnimator";
import PlayerSpriteAnimator from "../components/PlayerSpriteAnimator";
import opponentSpriteSheet from "../assets/images/boxer01.png";
import opponentAnimationConfig from "../data/boxer01.animations.json";
import playerSpriteSheet from "../assets/images/player01.png";
import playerAnimationConfig from "../data/player01.animations.json";

const OPPONENT_FRAME_WIDTH = 60;
const OPPONENT_STAGE_FLOOR_OFFSET = 106;

const PLAYER_FRAME_WIDTH = 60;
const PLAYER_STAGE_FLOOR_OFFSET = 76;

const SUIT_ICONS = {
    hearts: "bi-suit-heart-fill text-red",
    diamonds: "bi-suit-diamond-fill text-red",
    clubs: "bi-suit-club-fill text-black",
    spades: "bi-suit-spade-fill text-black"
};

function StarterCard({ card }) {
    if (!card) {
        return (
            <div
                className="barrage-starter-card barrage-starter-card--empty"
                aria-label="No starter card yet"
            />
        );
    }
    const suitIconClass = SUIT_ICONS[card.suit] || "bi-question-circle";
    return (
        <div className="barrage-starter-card" aria-label={`Starter: ${card.rank} of ${card.suit}`}>
            <span className="barrage-starter-card__rank">{card.rank}</span>
            <span className="barrage-starter-card__suit" aria-hidden="true">
                <i className={`bi ${suitIconClass} d-block`} />
            </span>
        </div>
    );
}

function BarrageTrackCard({ card }) {
    if (!card) return null;
    const suitIconClass = SUIT_ICONS[card.suit] || "bi-question-circle";
    return (
        <div className="barrage-track-card" data-card-id={card.id} aria-label={`${card.rank} of ${card.suit}`}>
            <span className="barrage-track-card__rank">{card.rank}</span>
            <span className="barrage-track-card__suit" aria-hidden="true">
                <i className={`bi ${suitIconClass} d-block`} />
            </span>
        </div>
    );
}

function Ring({
    playerBoxer,
    opponent,
    roundNumber,
    playerRoundsWon,
    opponentRoundsWon,
    barrage,
    selectedBarragePlayerCardId,
    selectedBarrageOpponentCardId,
    onTogglePlayerBarrageCard,
    onToggleOpponentBarrageCard,
    onSubmitPlayerBarragePlay,
    onSubmitOpponentBarragePlay,
    onSortPlayerBarrageHandBySuitValue,
    onSortOpponentBarrageHandBySuitValue,
    onSortPlayerBarrageHandByValue,
    onSortOpponentBarrageHandByValue,
    onShufflePlayerBarrageHand,
    onShuffleOpponentBarrageHand,
    isOpponentAi,
    playerCornerColor,
    opponentCornerColor,
    commentaryEntries,
    isRoundIntroComplete,
    activeOpponentAnimation,
    activePlayerAnimation,
    isPlayerSouthpaw,
    onOpponentAnimationComplete,
    onPlayerAnimationComplete
}) {
    const combatBarRef = useRef(null);
    const spriteStageRef = useRef(null);
    const prevPlayedCountRef = useRef(0);
    const isEntryAnimatingRef = useRef(false);
    const pendingCombatSideRef = useRef(null);
    const liveCombatSideRef = useRef("player1");
    const [spriteStageWidth, setSpriteStageWidth] = useState(0);
    const [spriteStageHeight, setSpriteStageHeight] = useState(0);

    const playerName = decodeHtmlEntities(playerBoxer?.name) || "You";
    const opponentName = decodeHtmlEntities(opponent?.name) || "Opponent";

    const playerActive = barrage?.activeBarrageDeckName === "player1Deck";
    const opponentActive = barrage?.activeBarrageDeckName === "player2Deck";
    const isRoundLocked = !isRoundIntroComplete;
    const hidePlayerDuringOpponentIntro = !isRoundIntroComplete && activePlayerAnimation !== "walk_in";

    const playerHasLegalCard = (barrage?.playerHand || []).some(
        (c) => (barrage?.pegCount ?? 0) + c.pegValue <= 31
    );
    const opponentHasLegalCard = (barrage?.opponentHand || []).some(
        (c) => (barrage?.pegCount ?? 0) + c.pegValue <= 31
    );

    const canPlayerSend =
        !isRoundLocked &&
        playerActive &&
        !barrage?.isComplete &&
        !barrage?.isKO &&
        (!playerHasLegalCard || Boolean(selectedBarragePlayerCardId));

    const canOpponentSend =
        !isRoundLocked &&
        opponentActive &&
        !isOpponentAi &&
        !barrage?.isComplete &&
        !barrage?.isKO &&
        (!opponentHasLegalCard || Boolean(selectedBarrageOpponentCardId));

    const playerHp = barrage?.playerHp ?? {
        current: playerBoxer?.hp ?? 0,
        max: playerBoxer?.hp ?? 0
    };
    const opponentHp = barrage?.opponentHp ?? {
        current: opponent?.hp ?? 0,
        max: opponent?.hp ?? 0
    };

    const playedCards = useMemo(() => barrage?.playedCards ?? [], [barrage?.playedCards]);
    const lastPlayedCard = playedCards.length > 0 ? playedCards[playedCards.length - 1] : null;
    const activeDeckName = barrage?.activeBarrageDeckName;
    let combatSide = activeDeckName === "player2Deck" ? "player2" : "player1";
    if (!activeDeckName && lastPlayedCard?.ownerDeck === "player2Deck") {
        combatSide = "player2";
    }
    if (barrage?.isComplete && lastPlayedCard?.ownerDeck) {
        combatSide = lastPlayedCard.ownerDeck === "player2Deck" ? "player2" : "player1";
    }
    const [displayCombatSide, setDisplayCombatSide] = useState(combatSide);
    const visibleTrackCards = playedCards;
    const combatAccentColor = displayCombatSide === "player2" ? opponentCornerColor : playerCornerColor;

    useEffect(() => {
        liveCombatSideRef.current = combatSide;
        if (isEntryAnimatingRef.current) {
            pendingCombatSideRef.current = combatSide;
            return;
        }
        setDisplayCombatSide(combatSide);
    }, [combatSide]);

    useEffect(() => {
        const combatBarEl = combatBarRef.current;
        if (!combatBarEl) {
            prevPlayedCountRef.current = playedCards.length;
            return;
        }

        const prevCount = prevPlayedCountRef.current;
        const nextCount = playedCards.length;
        const justAddedCard = nextCount > prevCount;
        const newestCard = playedCards[nextCount - 1] ?? null;

        if (!justAddedCard || !newestCard?.id) {
            prevPlayedCountRef.current = nextCount;
            return;
        }

        const selector = `[data-card-id="${newestCard.id}"]`;
        const newCardEl = combatBarEl.querySelector(selector);
        if (!newCardEl) {
            prevPlayedCountRef.current = nextCount;
            return;
        }

        const fromSide = newestCard.ownerDeck === "player2Deck" ? "player2" : "player1";
        isEntryAnimatingRef.current = true;
        pendingCombatSideRef.current = null;
        setDisplayCombatSide(fromSide);

        const barRect = combatBarEl.getBoundingClientRect();
        const cardRect = newCardEl.getBoundingClientRect();
        const overshootPx = 12;
        const entryOffset = fromSide === "player2"
            ? Math.max(64, (barRect.right - cardRect.right) + cardRect.width + overshootPx)
            : Math.max(64, (cardRect.left - barRect.left) + cardRect.width + overshootPx);

        newCardEl.style.setProperty("--barrage-entry-offset", `${Math.round(entryOffset)}px`);
        newCardEl.classList.add("barrage-track-card--entering");
        newCardEl.classList.add(
            fromSide === "player2"
                ? "barrage-track-card--from-player2"
                : "barrage-track-card--from-player1"
        );

        const cleanupAnimation = () => {
            newCardEl.style.removeProperty("--barrage-entry-offset");
            newCardEl.classList.remove(
                "barrage-track-card--entering",
                "barrage-track-card--from-player1",
                "barrage-track-card--from-player2"
            );

            isEntryAnimatingRef.current = false;
            const nextDisplaySide = pendingCombatSideRef.current ?? liveCombatSideRef.current ?? fromSide;
            pendingCombatSideRef.current = null;
            setDisplayCombatSide(nextDisplaySide);
        };

        newCardEl.addEventListener("animationend", cleanupAnimation, { once: true });

        prevPlayedCountRef.current = nextCount;
    }, [playedCards, lastPlayedCard]);

    useEffect(() => {
        const spriteStageEl = spriteStageRef.current;
        if (!spriteStageEl) {
            return undefined;
        }

        const measureStage = () => {
            setSpriteStageWidth(spriteStageEl.clientWidth);
            setSpriteStageHeight(spriteStageEl.clientHeight);
        };

        measureStage();

        if (typeof ResizeObserver === "function") {
            const resizeObserver = new ResizeObserver(() => {
                measureStage();
            });

            resizeObserver.observe(spriteStageEl);

            return () => {
                resizeObserver.disconnect();
            };
        }

        window.addEventListener("resize", measureStage);

        return () => {
            window.removeEventListener("resize", measureStage);
        };
    }, []);

    const opponentSpriteAnimation = useMemo(() => {
        if (!spriteStageWidth || !spriteStageHeight) {
            return null;
        }

        return {
            ...opponentAnimationConfig,
            spriteSheet: opponentSpriteSheet,
            metadata: {
                ...(opponentAnimationConfig.metadata || {}),
                frameWidth: OPPONENT_FRAME_WIDTH
            }
        };
    }, [spriteStageHeight, spriteStageWidth]);

    const playerSpriteAnimation = useMemo(() => {
        if (!spriteStageWidth || !spriteStageHeight) {
            return null;
        }

        return {
            ...playerAnimationConfig,
            spriteSheet: playerSpriteSheet,
            metadata: {
                ...(playerAnimationConfig.metadata || {}),
                frameWidth: PLAYER_FRAME_WIDTH
            }
        };
    }, [spriteStageHeight, spriteStageWidth]);

    const renderCribZone = (side) => (
        <div className={`barrage-crib-zone barrage-crib-zone--${side}`}>
            {/*<p className="barrage-zone-label">Crib ({cribOwnerName})</p>*/}
            <div className="barrage-crib-cards">
                {(barrage?.cribCards || []).map((card, i) => (
                    <div
                        key={card.id ?? i}
                        className="corner-card corner-card--facedown small"
                        aria-label="Crib card"
                    />
                ))}
                {Array.from({
                    length: Math.max(0, 4 - (barrage?.cribCards?.length ?? 0))
                }).map((_, i) => (
                    <div
                        key={`slot-${i}`}
                        className="corner-card barrage-crib-placeholder"
                        aria-label="Empty crib slot"
                    />
                ))}
            </div>
        </div>
    );

    return (
        <section className="screen screen-ring">
            {/*}
            <header className="ring-header">
                <h2>Round {roundNumber}</h2>
                <p className="score-line">
                    You {playerRoundsWon} — {opponentRoundsWon} Opponent
                </p>
            </header>
            */}
            {/* Hit bars */}
            <div className="ring-hit-bars">
                <div className="ring-hit-bars__column">
                    <HitBar
                        label={playerName}
                        value={playerHp.current}
                        maxValue={playerHp.max}
                        side="player"
                        accentColor={playerCornerColor}
                    />
                </div>

                <div className="ring-hit-bars__middle">
                    <div className="barrage-flip-zone">
                        {/*<p className="barrage-zone-label">Starter</p>*/}
                        <StarterCard card={barrage?.starterCard} />
                        {barrage?.nibsPoints > 0 ? (
                            <p className="barrage-nibs-note">Nibs! +{barrage.nibsPoints}</p>
                        ) : null}
                    </div>
                </div>

                <div className="ring-hit-bars__column">
                    <HitBar
                        label={opponentName}
                        value={opponentHp.current}
                        maxValue={opponentHp.max}
                        side="opponent"
                        accentColor={opponentCornerColor}
                    />
                </div>
            </div>

            <div ref={spriteStageRef} className="barrage-sprite-stage" aria-label="Barrage sprite stage">
                {playerSpriteAnimation ? (
                    <PlayerSpriteAnimator
                        stageWidth={spriteStageWidth}
                        stageHeight={spriteStageHeight}
                        animationToRun={playerSpriteAnimation}
                        activeAnimation={activePlayerAnimation}
                        className={hidePlayerDuringOpponentIntro ? "barrage-player-sprite--intro-hidden" : ""}
                        floorOffset={PLAYER_STAGE_FLOOR_OFFSET}
                        mirrorX={Boolean(isPlayerSouthpaw)}
                        onAnimationComplete={onPlayerAnimationComplete}
                    />
                ) : null}

                {opponentSpriteAnimation ? (
                    <OpponentSpriteAnimator
                        stageWidth={spriteStageWidth}
                        stageHeight={spriteStageHeight}
                        animationToRun={opponentSpriteAnimation}
                        activeAnimation={activeOpponentAnimation}
                        className="barrage-opponent-sprite"
                        floorOffset={OPPONENT_STAGE_FLOOR_OFFSET}
                        onAnimationComplete={onOpponentAnimationComplete}
                    />
                ) : null}

                <div className="barrage-crib-row">
                    {barrage?.cribOwner === 1 ? renderCribZone("player") : null}
                    {barrage?.cribOwner === 2 ? renderCribZone("opponent") : null}
                </div>

                {/* Peg counter overlays the bottom of the sprite stage. */}
                <div className="barrage-table-row">
                    <div
                        ref={combatBarRef}
                        className={`barrage-combat-bar barrage-combat-bar--${displayCombatSide}`}
                        style={combatAccentColor ? { "--barrage-combat-accent": combatAccentColor } : undefined}
                    >
                        <div className="barrage-combat-bar__impact-layer">
                            <div className="barrage-combat-bar__marker">
                                {String(barrage?.pegCount ?? 0).padStart(2, "0")}
                            </div>
                            <div className="barrage-combat-bar__track">
                                {visibleTrackCards.map((card, index) => (
                                    <BarrageTrackCard key={`${card.id}-${index}`} card={card} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Both fighters' hands */}
            <div className="barrage-players">
                <article className={`barrage-player-side${playerActive ? " barrage-player-side--active" : ""}`}>
                    {/*<h3 className="barrage-player-name" style={playerCornerColor ? { color: playerCornerColor } : undefined}>{playerName}</h3>*/}
                    <HandDisplay
                        hand={barrage?.playerHand || []}
                        selectedCardIds={
                            selectedBarragePlayerCardId ? [selectedBarragePlayerCardId] : []
                        }
                        onToggleCard={onTogglePlayerBarrageCard}
                        onSend={onSubmitPlayerBarragePlay}
                        sendDisabled={!canPlayerSend}
                        onSortBySuit={onSortPlayerBarrageHandBySuitValue}
                        onSortByValue={onSortPlayerBarrageHandByValue}
                        onShuffle={onShufflePlayerBarrageHand}
                        disabled={
                            isRoundLocked ||
                            !playerActive ||
                            barrage?.isComplete ||
                            barrage?.isKO
                        }
                        label={`${playerName}'s barrage hand`}
                    />
                    {/*playerActive && !playerHasLegalCard && !barrage?.isComplete ? (<p className="barrage-go-note">No legal card — click Send to call Go</p>) : null*/}
                </article>

                <article className={`barrage-player-side${opponentActive ? " barrage-player-side--active" : ""}`}>
                    {/*<h3 className="barrage-player-name" style={opponentCornerColor ? { color: opponentCornerColor } : undefined}>{opponentName}</h3>*/}
                    <HandDisplay
                        hand={barrage?.opponentHand || []}
                        selectedCardIds={
                            selectedBarrageOpponentCardId ? [selectedBarrageOpponentCardId] : []
                        }
                        onToggleCard={onToggleOpponentBarrageCard}
                        onSend={!isOpponentAi ? onSubmitOpponentBarragePlay : null}
                        sendDisabled={!canOpponentSend}
                        onSortBySuit={!isOpponentAi ? onSortOpponentBarrageHandBySuitValue : null}
                        onSortByValue={!isOpponentAi ? onSortOpponentBarrageHandByValue : null}
                        onShuffle={!isOpponentAi ? onShuffleOpponentBarrageHand : null}
                        faceDown={isOpponentAi}
                        disabled={
                            isRoundLocked ||
                            isOpponentAi ||
                            !opponentActive ||
                            barrage?.isComplete ||
                            barrage?.isKO
                        }
                        label={`${opponentName}'s barrage hand`}
                    />
                    {/*isOpponentAi && opponentActive && !barrage?.isComplete ? (<p className="barrage-go-note">Opponent is thinking…</p>) : null*/}
                </article>
            </div>

            <GameLog entries={commentaryEntries} />
        </section>
    );
}

export default Ring;
