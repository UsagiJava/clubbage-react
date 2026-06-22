import { decodeHtmlEntities } from "../utils/htmlDecoder";
import HitBar from "../components/HitBar";
import HandDisplay from "../components/HandDisplay";
import GameLog from "../components/GameLog";

function Corner({
    playerBoxer,
    opponent,
    roundNumber,
    playerRoundsWon,
    opponentRoundsWon,
    statusText,
    cornerBreak,
    playerCurrentHp,
    playerMaxHp,
    opponentCurrentHp,
    opponentMaxHp,
    onTogglePlayerCornerCard,
    onToggleOpponentCornerCard,
    onSubmitPlayerCornerBreak,
    onSubmitOpponentCornerBreak,
    onSortPlayerCornerHandBySuitValue,
    onSortOpponentCornerHandBySuitValue,
    onSortPlayerCornerHandByValue,
    onSortOpponentCornerHandByValue,
    onShufflePlayerCornerHand,
    onShuffleOpponentCornerHand,
    isOpponentAi,
    cornerBreakError,
    playerCornerColor,
    opponentCornerColor,
    commentaryEntries
}) {
    const hasBetweenRoundsChat = roundNumber > 1;
    const trainerLine = playerBoxer.sayings?.[(roundNumber - 2) % playerBoxer.sayings?.length] || "Join the &quot;Clubbage!!&quot; fan club today.";
    const opponentLine = opponent?.sayings?.[(roundNumber - 2) % opponent?.sayings?.length] || "Have a heart. I club you.";

    const suitIconClassByName = {
        hearts: "bi-suit-heart-fill text-red",
        diamonds: "bi-suit-diamond-fill text-red",
        clubs: "bi-suit-club-fill text-black",
        spades: "bi-suit-spade-fill text-black"
    };

    const selectedPlayerCardCount = cornerBreak?.selectedPlayerCardIds?.length ?? 0;
    const selectedOpponentCardCount = cornerBreak?.selectedOpponentCardIds?.length ?? 0;
    const playerHandCount = cornerBreak?.playerHand?.length ?? 0;
    const opponentHandCount = cornerBreak?.opponentHand?.length ?? 0;
    const canSubmitPlayerCrib = Boolean(cornerBreak && !cornerBreak.playerSentToCrib && selectedPlayerCardCount === 2);
    const canSubmitOpponentCrib = Boolean(cornerBreak && !cornerBreak.opponentSentToCrib && selectedOpponentCardCount === 2);
    const canManagePlayerHand = playerHandCount > 0 && !cornerBreak?.playerSentToCrib;
    const canManageOpponentHand = opponentHandCount > 0 && !cornerBreak?.opponentSentToCrib;

    return (
        <section className="screen screen-corner">
            {/* <header><h2>Corner Break: {statusText}</h2></header> */}
            <div className="corner-portraits">
                <article className="portrait portrait--player">
                    <div className="portrait-header">
                        <div className="portrait-header__top">
                            <h3>{decodeHtmlEntities(playerBoxer.name) || "Unknown Player"}</h3>
                            <HitBar
                                label="HP"
                                value={playerCurrentHp ?? playerBoxer?.hp ?? 0}
                                maxValue={playerMaxHp ?? playerBoxer?.hp ?? 0}
                                side="player"
                                accentColor={playerCornerColor}
                                className="corner-hit-bar"
                            />
                        </div>
                        {!hasBetweenRoundsChat ? (
                            <div className="portrait-header__bottom portrait-header__bottom--left mb-2">
                                {decodeHtmlEntities(playerBoxer.description)}
                            </div>
                        ) : (
                            <div className="portrait-header__bottom portrait-header__bottom--right">
                                <span className="round-win-dots" title={`${decodeHtmlEntities(playerBoxer?.name) || "Unknown Player"} rounds won: ${playerRoundsWon}`}>
                                    {playerRoundsWon > 1 ? (
                                        <span>{playerRoundsWon}x</span>
                                    ) : null}
                                    {playerRoundsWon > 0 ? (
                                        <span className="round-win-dot" aria-hidden="true" />
                                    ) : null}
                                </span>
                            </div>
                        )}
                    </div>
                    <div
                        className="portrait-image portrait-image--player"
                        style={playerCornerColor ? { background: playerCornerColor } : undefined}
                        aria-hidden="true"
                    />
                    {!hasBetweenRoundsChat ? (
                        <ul className="corner-chat p-2 mb-2">
                            <li><span>HP</span><strong>{`${playerCurrentHp ?? playerBoxer?.hp ?? 0}/${playerMaxHp ?? playerBoxer?.hp ?? 0}`}</strong></li>
                            <li><span>Age/Weight</span><strong>{playerBoxer.age}/{playerBoxer.weight}</strong></li>
                            <li><span>Wins/Losses</span><strong>{playerBoxer.wins}/{playerBoxer.losses}</strong></li>
                            <li><span>KOs (TKOs)</span><strong>{playerBoxer.kos} ({playerBoxer.tkos})</strong></li>
                        </ul>
                    ) : (
                        <p className="corner-chat">
                            <strong>Trainer:</strong> {decodeHtmlEntities(trainerLine)}
                        </p>
                    )}

                    <p className="mb-2">Select 2 cards to send to {cornerBreak?.cribOwner === 1 ? "your" : "opponent's"} crib:</p>

                    <HandDisplay
                        hand={cornerBreak?.playerHand || []}
                        selectedCardIds={cornerBreak?.selectedPlayerCardIds || []}
                        onToggleCard={onTogglePlayerCornerCard}
                        onSend={onSubmitPlayerCornerBreak}
                        sendDisabled={!canSubmitPlayerCrib}
                        onSortBySuit={onSortPlayerCornerHandBySuitValue}
                        onSortByValue={onSortPlayerCornerHandByValue}
                        onShuffle={onShufflePlayerCornerHand}
                        disabled={cornerBreak?.playerSentToCrib}
                        label="Player hand"
                    />

                </article>

                <article className="portrait portrait--opponent">
                    <div className="portrait-header">
                        <div className="portrait-header__top">
                            <h3>{decodeHtmlEntities(opponent?.name) || "Unknown Opponent"}</h3>
                            <HitBar
                                label="HP"
                                value={opponentCurrentHp ?? opponent?.hp ?? 0}
                                maxValue={opponentMaxHp ?? opponent?.hp ?? 0}
                                side="opponent"
                                accentColor={opponentCornerColor}
                                className="corner-hit-bar"
                            />
                        </div>
                        {!hasBetweenRoundsChat ? (
                            <div className="portrait-header__bottom portrait-header__bottom--left mb-2">
                                {decodeHtmlEntities(opponent?.description)}
                            </div>
                        ) : (
                            <div className="portrait-header__bottom portrait-header__bottom--right">
                                <span className="round-win-dots" title={`${decodeHtmlEntities(opponent?.name) || "Unknown Player"} rounds won: ${opponentRoundsWon}`}>
                                    {opponentRoundsWon > 1 ? (
                                        <span>{opponentRoundsWon}x</span>
                                    ) : null}
                                    {opponentRoundsWon > 0 ? (
                                        <span className="round-win-dot" aria-hidden="true" />
                                    ) : null}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="portrait-image portrait-image--opponent" style={opponentCornerColor ? { background: opponentCornerColor } : undefined} aria-hidden="true" />
                    {!hasBetweenRoundsChat ? (
                        <ul className="corner-chat p-2 mb-2">
                            <li><span>HP</span><strong>{`${opponentCurrentHp ?? opponent?.hp ?? 0}/${opponentMaxHp ?? opponent?.hp ?? 0}`}</strong></li>
                            <li><span>Age/Weight</span><strong>{opponent.age}/{opponent.weight}</strong></li>
                            <li><span>Wins/Losses</span><strong>{opponent.wins}/{opponent.losses}</strong></li>
                            <li><span>KOs (TKOs)</span><strong>{opponent.kos} ({opponent.tkos})</strong></li>
                        </ul>
                    ) : (
                        <p className="corner-chat">
                            <strong>{decodeHtmlEntities(opponent?.name) || "Opponent"}:</strong> {decodeHtmlEntities(opponentLine)}
                        </p>
                    )}


                    {!isOpponentAi ? (
                        <p className="mb-2">Select 2 cards to send to {cornerBreak?.cribOwner === 2 ? "your" : "opponent's"} crib:</p>
                    ) : (
                        <p className="mb-2">Opponent is thinking cards to send to {cornerBreak?.cribOwner === 2 ? "their" : "your"} crib...</p>
                    )}

                    <div id="player2_hand">
                        <HandDisplay
                            hand={cornerBreak?.opponentHand || []}
                            selectedCardIds={cornerBreak?.selectedOpponentCardIds || []}
                            onToggleCard={!isOpponentAi ? onToggleOpponentCornerCard : undefined}
                            onSend={!isOpponentAi ? onSubmitOpponentCornerBreak : undefined}
                            sendDisabled={!canSubmitOpponentCrib}
                            onSortBySuit={!isOpponentAi ? onSortOpponentCornerHandBySuitValue : undefined}
                            onSortByValue={!isOpponentAi ? onSortOpponentCornerHandByValue : undefined}
                            onShuffle={!isOpponentAi ? onShuffleOpponentCornerHand : undefined}
                            faceDown={isOpponentAi}
                            disabled={isOpponentAi || cornerBreak?.opponentSentToCrib}
                            label="Opponent hand"
                        />
                    </div>
                </article>
            </div>

            {cornerBreakError ? <p className="home-error mt-2 mb-0">{cornerBreakError}</p> : null}
            <GameLog entries={commentaryEntries} />
        </section>
    );
}

export default Corner;
