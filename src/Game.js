import { useEffect, useMemo, useRef, useState } from "react";
import { CIRCUITS } from "./data/circuits";
import { BOXERS } from "./data/boxers";
import Home from "./screens/Home";
import Select from "./screens/Select";
import Corner from "./screens/Corner";
import Ring from "./screens/Round";
import Training from "./screens/Training";
import Victory from "./screens/Victory";
import {
    createCornerBreakRound,
    getCornerBreakSnapshot,
    submitCornerBreakSelectionForDeck,
    createBarrageFromCornerBreak,
    getBarrageSnapshot,
    submitBarrageCard,
    submitBarrageGo,
    applyClosingRoundScoring
} from "./features/clubbageEngine";

const SCREENS = {
    HOME: "home",
    SELECT: "select",
    CORNER: "corner",
    RING: "ring",
    TRAINING: "training",
    VICTORY: "victory"
};

const CONTINUE_PASSCODE = "1122";
const SAVE_KEY = "clubbage-progress";
const CORNER_RED = "#F08080";
const CORNER_BLUE = "#4169E1";
const ATTACK_REACTION_MODE = "sequence"; // "sequence" | "parallel"
const ATTACK_REACTION_OFFSET_MS = 120;
const ATTACK_REACTION_BY_ATTACK = {
    jab: { mode: "parallel", offsetMs: 0 },
    cross: { mode: "parallel", offsetMs: 0 },
    hook: { mode: "sequence", offsetMs: 90 },
    uppercut: { mode: "sequence", offsetMs: 110 }
};

function createInitialMatchState() {
    return {
        roundNumber: 1,
        playerRoundsWon: 0,
        opponentRoundsWon: 0
    };
}

function getSafeOpponent(circuitIndex, opponentIndex) {
    const currentCircuit = CIRCUITS[circuitIndex] || CIRCUITS[0];
    return currentCircuit?.opponents?.[opponentIndex] || currentCircuit?.opponents?.[0] || null;
}

function getPlayerFromStorage() {
    try {
        const rawData = localStorage.getItem(SAVE_KEY);
        if (!rawData) {
            return null;
        }

        return JSON.parse(rawData);
    } catch (error) {
        return null;
    }
}

function saveProgress(progress) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
}

function rollMatchCornerSelection() {
    const playerIsRedCorner = Math.random() < 0.5;

    return {
        playerCornerColor: playerIsRedCorner ? CORNER_RED : CORNER_BLUE,
        opponentCornerColor: playerIsRedCorner ? CORNER_BLUE : CORNER_RED,
        playerCornerName: playerIsRedCorner ? "red" : "blue",
        opponentCornerName: playerIsRedCorner ? "blue" : "red",
        firstCribOwner: playerIsRedCorner ? 1 : 2
    };
}

function Game() {
    const [screen, setScreen] = useState(SCREENS.HOME);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [playerBoxer, setPlayerBoxer] = useState(null);
    const [currentCircuitIndex, setCurrentCircuitIndex] = useState(0);
    const [currentOpponentIndex, setCurrentOpponentIndex] = useState(0);
    const [matchState, setMatchState] = useState(createInitialMatchState());
    const [statusText, setStatusText] = useState("Welcome to Clubbage Fight Night.");
    const [cornerBreakState, setCornerBreakState] = useState(null);
    const [cornerBreakError, setCornerBreakError] = useState("");
    const [selectedCornerCardIds, setSelectedCornerCardIds] = useState([]);
    const [selectedOpponentCornerCardIds, setSelectedOpponentCornerCardIds] = useState([]);
    const [useAIOpponent, setUseAIOpponent] = useState(true);
    const [matchCornerSelection, setMatchCornerSelection] = useState(null);
    const [barrageState, setBarrageState] = useState(null);
    const [selectedBarragePlayerCardId, setSelectedBarragePlayerCardId] = useState(null);
    const [selectedBarrageOpponentCardId, setSelectedBarrageOpponentCardId] = useState(null);
    const [matchHp, setMatchHp] = useState(null); // { player: {current, max}, opponent: {current, max} }
    const [commentaryEntries, setCommentaryEntries] = useState([]);
    const [activeOpponentAnimation, setActiveOpponentAnimation] = useState("idle");

    const [activePlayerAnimation, setActivePlayerAnimation] = useState("idle");
    const [isShowdownRevealActive, setIsShowdownRevealActive] = useState(false);

    const [isRoundIntroComplete, setIsRoundIntroComplete] = useState(true);
    const cornerRoundRef = useRef(null);
    const cornerRoundKeyRef = useRef("");
    const barrageRoundRef = useRef(null);
    const aiBarrageInFlightRef = useRef(false);
    const commentaryIdRef = useRef(1);
    const opponentAnimationWaiterRef = useRef(null);
    const playerAnimationWaiterRef = useRef(null);
    const animationScriptTokenRef = useRef(0);

    const barrageStyleStateRef = useRef({
        player1Deck: { hasStanceOrthodox: false, hasStanceSouthpaw: false, hasChamberedArms: false },
        player2Deck: { hasStanceOrthodox: false, hasStanceSouthpaw: false, hasChamberedArms: false }
    });

    const addCommentaryEntry = (parts, type = "game_info") => {
        setCommentaryEntries((previous) => [
            ...previous,
            { id: commentaryIdRef.current++, parts, type }
        ]);
    };

    const resetCommentaryLog = () => {
        commentaryIdRef.current = 1;
        setCommentaryEntries([]);
    };

    const resetBarrageStyleState = () => {
        barrageStyleStateRef.current = {
            player1Deck: { hasStanceOrthodox: false, hasStanceSouthpaw: false, hasChamberedArms: false },
            player2Deck: { hasStanceOrthodox: false, hasStanceSouthpaw: false, hasChamberedArms: false }
        };
    };

    const logOpponentAnimationAction = (action, animation, extra = {}) => {
        console.log("[OpponentAnimation]", {
            action,
            animation,
            ...extra
        });
    };

    const logPlayerAnimationAction = (action, animation, extra = {}) => {
        console.log("[PlayerAnimation]", {
            action,
            animation,
            ...extra
        });
    };

    const getAnimationWaiterRef = (actor) => {
        return actor === "player" ? playerAnimationWaiterRef : opponentAnimationWaiterRef;
    };

    const setActorAnimation = (actor, animationName) => {
        if (actor === "player") {
            setActivePlayerAnimation(animationName);
        } else {
            setActiveOpponentAnimation(animationName);
        }
    };

    const logActorAnimationAction = (actor, action, animation, extra = {}) => {
        if (actor === "player") {
            logPlayerAnimationAction(action, animation, extra);
            return;
        }
        logOpponentAnimationAction(action, animation, extra);
    };

    const resolveAnimationWaiter = (actor, completedAnimation, extra = {}) => {
        const waiterRef = getAnimationWaiterRef(actor);
        const waiter = waiterRef.current;
        if (!waiter || waiter.animationName !== completedAnimation) {
            return false;
        }

        if (waiter.timeoutId) {
            window.clearTimeout(waiter.timeoutId);
        }

        waiterRef.current = null;

        if (waiter.returnToIdle) {
            setActorAnimation(actor, "idle");
        }

        if (typeof waiter.resolve === "function") {
            waiter.resolve(completedAnimation);
        }

        logActorAnimationAction(actor, "animation-complete", waiter.returnToIdle ? "idle" : completedAnimation, {
            completedAnimation,
            ...extra
        });

        return true;
    };

    const clearPendingAnimationWaiter = (actor, options = {}) => {
        const { resolvePending = true, setIdle = false } = options;
        const waiterRef = getAnimationWaiterRef(actor);
        const waiter = waiterRef.current;
        if (!waiter) {
            return;
        }

        if (waiter.timeoutId) {
            window.clearTimeout(waiter.timeoutId);
        }

        waiterRef.current = null;

        if (setIdle) {
            setActorAnimation(actor, "idle");
        }

        if (resolvePending && typeof waiter.resolve === "function") {
            waiter.resolve(waiter.animationName);
        }
    };

    const clearPendingOpponentAnimation = (options = {}) => {
        clearPendingAnimationWaiter("opponent", options);
    };

    const clearPendingPlayerAnimation = (options = {}) => {
        clearPendingAnimationWaiter("player", options);
    };

    const playActorAnimation = (actor, animationName, options = {}) => {
        const {
            fallbackMs = 5000,
            returnToIdle = true,
            action = "play"
        } = options;

        clearPendingAnimationWaiter(actor, { resolvePending: true, setIdle: false });
        setActorAnimation(actor, animationName);
        logActorAnimationAction(actor, action, animationName, { fallbackMs });

        return new Promise((resolve) => {
            const timeoutId = window.setTimeout(() => {
                resolveAnimationWaiter(actor, animationName, { reason: "timeout" });
            }, Math.max(1, fallbackMs));

            const waiterRef = getAnimationWaiterRef(actor);
            waiterRef.current = {
                animationName,
                returnToIdle,
                resolve,
                timeoutId
            };
        });
    };

    const runAnimationScript = async (steps, options = {}) => {
        const { lockRoundIntro = false, lightweight = false } = options;
        const scriptToken = lightweight
            ? animationScriptTokenRef.current
            : animationScriptTokenRef.current + 1;

        if (!lightweight) {
            animationScriptTokenRef.current = scriptToken;
            clearPendingOpponentAnimation({ resolvePending: true, setIdle: true });
            clearPendingPlayerAnimation({ resolvePending: true, setIdle: true });
        }

        if (lockRoundIntro) {
            setIsRoundIntroComplete(false);
        }

        for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
            if (animationScriptTokenRef.current !== scriptToken) {
                return;
            }

            const step = steps[stepIndex];
            const parallelAnimations = Array.isArray(step) ? step : [step];
            await Promise.all(
                parallelAnimations.map((entry) =>
                    playActorAnimation(entry.actor, entry.animation, entry.options)
                )
            );
        }

        if (lockRoundIntro && animationScriptTokenRef.current === scriptToken) {
            setIsRoundIntroComplete(true);
        }
    };

    const animationStep = (actor, animation, options = {}) => ({
        actor,
        animation,
        options
    });

    const playSequence = (steps, options = {}) => {
        return runAnimationScript(steps, options);
    };

    const playParallel = (steps, options = {}) => {
        return runAnimationScript([steps], options);
    };

    const waitMs = (ms = 0) => {
        return new Promise((resolve) => {
            window.setTimeout(resolve, Math.max(0, ms));
        });
    };

    const getOpposingActor = (actor) => {
        return actor === "player" ? "opponent" : "player";
    };

    const getAttackReactionSettings = (attackAnimationName) => {
        return ATTACK_REACTION_BY_ATTACK[attackAnimationName] || {};
    };

    const playAttackWithReaction = ({
        attackerActor,
        attackAnimationName,
        attackAction,
        reactionAction,
        attackFallbackMs = 4000,
        reactionFallbackMs = 2500,
        mode,
        reactionOffsetMs
    }) => {
        const reactionAnimationToPlay = getReactionName(attackAnimationName);
        const defenderActor = getOpposingActor(attackerActor);
        const attackReactionSettings = getAttackReactionSettings(attackAnimationName);
        const resolvedMode = mode ?? attackReactionSettings.mode ?? ATTACK_REACTION_MODE;
        const resolvedReactionOffsetMs =
            reactionOffsetMs ?? attackReactionSettings.offsetMs ?? ATTACK_REACTION_OFFSET_MS;

        const attackStep = animationStep(attackerActor, attackAnimationName, {
            action: attackAction,
            fallbackMs: attackFallbackMs,
            returnToIdle: true
        });

        if (!reactionAnimationToPlay) {
            return playSequence([attackStep], { lightweight: true }).then(() => attackAnimationName);
        }

        const reactionStep = animationStep(defenderActor, reactionAnimationToPlay, {
            action: reactionAction,
            fallbackMs: reactionFallbackMs,
            returnToIdle: true
        });

        if (resolvedMode === "parallel") {
            if (resolvedReactionOffsetMs <= 0) {
                return playParallel([attackStep, reactionStep], { lightweight: true }).then(() => attackAnimationName);
            }

            return Promise.all([
                playActorAnimation(attackerActor, attackAnimationName, {
                    action: attackAction,
                    fallbackMs: attackFallbackMs,
                    returnToIdle: true
                }),
                (async () => {
                    await waitMs(resolvedReactionOffsetMs);
                    await playActorAnimation(defenderActor, reactionAnimationToPlay, {
                        action: reactionAction,
                        fallbackMs: reactionFallbackMs,
                        returnToIdle: true
                    });
                })()
            ]).then(() => attackAnimationName);
        }

        return playSequence([attackStep, reactionStep], { lightweight: true }).then(() => attackAnimationName);
    };

    const playOpponentAnimationFromDamage = (damagePoints = 0) => {
        if (damagePoints <= 0) {
            setActiveOpponentAnimation("idle");
            logOpponentAnimationAction("no-scoring-play", "idle", { damagePoints });
            return Promise.resolve("idle");
        }

        const animationToPlay = getAttackName(damagePoints);
        return playAttackWithReaction({
            attackerActor: "opponent",
            attackAnimationName: animationToPlay,
            attackAction: "opponent-scored",
            reactionAction: "player-hit-reaction"
        });
    };

    const playPlayerAnimationFromDamage = (damagePoints = 0) => {
        if (damagePoints <= 0) {
            setActivePlayerAnimation("idle");
            logPlayerAnimationAction("no-scoring-play", "idle", { damagePoints });
            return Promise.resolve("idle");
        }

        const animationToPlay = getAttackName(damagePoints);
        return playAttackWithReaction({
            attackerActor: "player",
            attackAnimationName: animationToPlay,
            attackAction: "player-scored",
            reactionAction: "opponent-hit-reaction"
        });
    };

    const triggerOpponentAnimationFromDamage = (damagePoints = 0) => {
        void playOpponentAnimationFromDamage(damagePoints);
    };

    const triggerPlayerAnimationFromDamage = (damagePoints = 0) => {
        void playPlayerAnimationFromDamage(damagePoints);
    };

    const handleOpponentAnimationComplete = (animationEvent) => {
        const completedAnimation = animationEvent?.animationName;
        if (!completedAnimation) return;
        if (resolveAnimationWaiter("opponent", completedAnimation, { reason: "callback" })) return;

        if (completedAnimation !== "idle") {
            setActiveOpponentAnimation("idle");
            logOpponentAnimationAction("animation-complete", "idle", {
                completedAnimation,
                reason: "untracked"
            });
        }
    };

    const handlePlayerAnimationComplete = (animationEvent) => {
        const completedAnimation = animationEvent?.animationName;
        if (!completedAnimation) return;
        if (resolveAnimationWaiter("player", completedAnimation, { reason: "callback" })) return;

        if (completedAnimation !== "idle") {
            setActivePlayerAnimation("idle");
            logPlayerAnimationAction("animation-complete", "idle", {
                completedAnimation,
                reason: "untracked"
            });
        }
    };

    const getDeckDisplayData = (deckName) => {
        if (deckName === "player1Deck") {
            return {
                name: playerBoxer?.name || "You",
                color: matchCornerSelection?.playerCornerColor
            };
        }

        return {
            name: activeOpponent?.name || "Opponent",
            color: matchCornerSelection?.opponentCornerColor
        };
    };

    const getAttackName = (points = 0) => {
        if (points <= 2) return "jab";
        if (points <= 4) return "cross";
        if (points <= 6) return "hook";
        return "uppercut";
    };

    const getReactionName = (attackName) => {
        if (attackName === "hook" || attackName === "uppercut") {
            return "hit_face";
        }

        if (attackName === "jab" || attackName === "cross") {
            return "hit_body";
        }

        return null;
    };

    const describePeggingReason = (result = {}, playedCard = null) => {
        const playedCardLabel = playedCard ? `${playedCard.rank ?? "?"}-${playedCard.suit ?? "?"}` : "card play";
        const reasons = [`${playedCardLabel} for`];
        if (result.fifteen > 0) reasons.push("fifteen");
        if (result.thirtyOne > 0) reasons.push("thirty-one");
        if (result.pairs === 2) reasons.push("a pair");
        if (result.pairs === 6) reasons.push("3 of a kind");
        if (result.pairs === 12) reasons.push("4 of a kind");
        if (result.run > 0) reasons.push(`run of ${result.run}`);
        if (result.lastCard > 0) reasons.push("last card");
        return reasons.join(" ");
    };

    const buildAttackCommentary = (attackerDeck, defenderDeck, points, reasonLabel) => {
        const attackName = getAttackName(points);
        const attackLeadIn =
            attackName === "jab"
                ? " lands a "
                : attackName === "cross"
                    ? " hits a "
                    : attackName === "hook"
                        ? " delivers a "
                        : " smashes an ";
        const attackTargetConnector = attackName === "jab" ? " on " : " to ";

        return [
            { text: attackerDeck.name, italic: true, color: attackerDeck.color },
            attackLeadIn,
            { text: attackName, bold: true },
            attackTargetConnector,
            { text: defenderDeck.name, italic: true, color: defenderDeck.color },
            " for ",
            { text: `${points} damage`, underline: true },
            `. [${reasonLabel}]`
        ];
    };

    const activeCircuit = useMemo(() => {
        return CIRCUITS[currentCircuitIndex] || CIRCUITS[0];
    }, [currentCircuitIndex]);

    const activeOpponent = useMemo(() => {
        return getSafeOpponent(currentCircuitIndex, currentOpponentIndex);
    }, [currentCircuitIndex, currentOpponentIndex]);

    useEffect(() => {
        if (screen !== SCREENS.CORNER || !playerBoxer || !activeOpponent || !matchCornerSelection) {
            return;
        }

        const roundKey = `${currentCircuitIndex}-${currentOpponentIndex}-${matchState.roundNumber}`;
        if (cornerRoundKeyRef.current === roundKey && cornerBreakState) {
            return;
        }

        const firstCribOwner = matchCornerSelection.firstCribOwner;
        const cribOwnerForRound =
            matchState.roundNumber % 2 === 1
                ? firstCribOwner
                : firstCribOwner === 1
                    ? 2
                    : 1;

        const roundState = createCornerBreakRound({
            cribOwner: cribOwnerForRound,
            opponentIncompetence: useAIOpponent ? 100 : 45
        });

        cornerRoundRef.current = roundState;
        cornerRoundKeyRef.current = roundKey;
        setSelectedCornerCardIds([]);
        setSelectedOpponentCornerCardIds([]);
        setCornerBreakError("");
        setCornerBreakState(getCornerBreakSnapshot(roundState, [], []));
        addCommentaryEntry("[Corner Break] start.", "game_info");
    }, [
        screen,
        playerBoxer,
        activeOpponent,
        currentCircuitIndex,
        currentOpponentIndex,
        matchState.roundNumber,
        cornerBreakState,
        matchCornerSelection,
        useAIOpponent
    ]);

    const navigateWithTransition = (nextScreen, updateFn) => {
        if (isTransitioning) {
            return;
        }

        setIsTransitioning(true);

        setTimeout(() => {
            if (updateFn) {
                updateFn();
            }

            setScreen(nextScreen);

            setTimeout(() => {
                setIsTransitioning(false);
            }, 30);
        }, 240);
    };

    const startNewGame = () => {
        navigateWithTransition(SCREENS.SELECT, () => {
            resetCommentaryLog();
            setStatusText("Select your boxer.");
            setCornerBreakState(null);
            setCornerBreakError("");
            setSelectedCornerCardIds([]);
            setSelectedOpponentCornerCardIds([]);
            setMatchCornerSelection(null);
            cornerRoundRef.current = null;
            cornerRoundKeyRef.current = "";
        });
    };

    const chooseBoxer = (gender) => {
        const selectedBoxer = BOXERS[gender];
        const firstOpponent = getSafeOpponent(0, 0);

        navigateWithTransition(SCREENS.CORNER, () => {
            resetCommentaryLog();
            const nextCornerSelection = rollMatchCornerSelection();
            setPlayerBoxer(selectedBoxer);
            setCurrentCircuitIndex(0);
            setCurrentOpponentIndex(0);
            setMatchState(createInitialMatchState());
            setMatchCornerSelection(nextCornerSelection);
            setMatchHp({
                player: { current: selectedBoxer.hp ?? 50, max: selectedBoxer.hp ?? 50 },
                opponent: { current: firstOpponent?.hp ?? 50, max: firstOpponent?.hp ?? 50 }
            });
            setStatusText(`Prepare for Round 1.`);

            saveProgress({
                playerBoxer: selectedBoxer,
                currentCircuitIndex: 0,
                currentOpponentIndex: 0
            });
        });
    };

    const continueGame = (passcode) => {
        if (passcode !== CONTINUE_PASSCODE) {
            return false;
        }

        const saveData = getPlayerFromStorage();

        navigateWithTransition(SCREENS.CORNER, () => {
            resetCommentaryLog();
            const nextCornerSelection = rollMatchCornerSelection();
            const loadedBoxer = saveData?.playerBoxer || BOXERS.male;
            const loadedOpponent = getSafeOpponent(
                saveData?.currentCircuitIndex || 0,
                saveData?.currentOpponentIndex || 0
            );
            setPlayerBoxer(loadedBoxer);
            setCurrentCircuitIndex(saveData?.currentCircuitIndex || 0);
            setCurrentOpponentIndex(saveData?.currentOpponentIndex || 0);
            setMatchState(createInitialMatchState());
            setMatchCornerSelection(nextCornerSelection);
            setMatchHp({
                player: { current: loadedBoxer.hp ?? 50, max: loadedBoxer.hp ?? 50 },
                opponent: { current: loadedOpponent?.hp ?? 50, max: loadedOpponent?.hp ?? 50 }
            });
            setStatusText(`Continue loaded. Coin flip puts you in the ${nextCornerSelection.playerCornerName} corner.`);
        });

        return true;
    };

    const toggleCornerCardSelection = (cardId, deckName = "player1Deck") => {
        if (!cornerBreakState) {
            return;
        }

        const selectingPlayer1 = deckName === "player1Deck";
        if (!selectingPlayer1 && useAIOpponent) {
            return;
        }
        const handSentToCrib = selectingPlayer1 ? cornerBreakState.playerSentToCrib : cornerBreakState.opponentSentToCrib;
        if (handSentToCrib) {
            return;
        }

        setCornerBreakError("");

        const setter = selectingPlayer1 ? setSelectedCornerCardIds : setSelectedOpponentCornerCardIds;

        setter((previous) => {
            const isSelected = previous.includes(cardId);
            const next = isSelected
                ? previous.filter((id) => id !== cardId)
                : previous.length < 2
                    ? [...previous, cardId]
                    : previous;

            setCornerBreakState((current) => {
                if (!current) return current;
                return selectingPlayer1
                    ? { ...current, selectedPlayerCardIds: next }
                    : { ...current, selectedOpponentCardIds: next };
            });

            return next;
        });
    };

    const submitCornerBreak = async (deckName = "player1Deck") => {
        const roundState = cornerRoundRef.current;
        if (!roundState) {
            return;
        }

        const selectedForDeck = deckName === "player1Deck" ? selectedCornerCardIds : selectedOpponentCornerCardIds;

        try {
            submitCornerBreakSelectionForDeck(roundState, deckName, selectedForDeck);
            const actingDeck = getDeckDisplayData(deckName);
            addCommentaryEntry([
                { text: actingDeck.name, italic: true, color: actingDeck.color },
                " sends cards to crib."
            ], "game_info");

            const nextSelectedPlayerCards = deckName === "player1Deck" ? [] : selectedCornerCardIds;
            let nextSelectedOpponentCards = deckName === "player2Deck" ? [] : selectedOpponentCornerCardIds;

            if (useAIOpponent && deckName === "player1Deck" && !roundState.decks.player2Deck.hasSentToCrib) {
                const opponentCards = await roundState.opponentController.selectCardsForCribDiscard(
                    roundState.decks.player2Deck.deck.getCards(),
                    { cribOwner: roundState.cribOwner }
                );

                if (!opponentCards || opponentCards.length !== 2) {
                    throw new Error("Opponent failed to choose crib cards.");
                }

                submitCornerBreakSelectionForDeck(
                    roundState,
                    "player2Deck",
                    opponentCards.map((card) => card.id)
                );
                const opponentDeck = getDeckDisplayData("player2Deck");
                addCommentaryEntry([
                    { text: opponentDeck.name, italic: true, color: opponentDeck.color },
                    " sends cards to crib."
                ], "game_info");
                nextSelectedOpponentCards = [];
            }

            setSelectedCornerCardIds(nextSelectedPlayerCards);
            setSelectedOpponentCornerCardIds(nextSelectedOpponentCards);

            const snapshot = getCornerBreakSnapshot(roundState, nextSelectedPlayerCards, nextSelectedOpponentCards);
            setCornerBreakState(snapshot);
            setCornerBreakError("");

            if (snapshot.isComplete) {
                addCommentaryEntry("[Corner Break] end.", "game_info");
                navigateWithTransition(SCREENS.RING, () => {
                    setStatusText(`Round ${matchState.roundNumber} starts now.`);
                    const playerStartHp = matchHp?.player ?? { current: playerBoxer?.hp ?? 50, max: playerBoxer?.hp ?? 50 };
                    const opponentStartHp = matchHp?.opponent ?? { current: activeOpponent?.hp ?? 50, max: activeOpponent?.hp ?? 50 };
                    const barrageRound = createBarrageFromCornerBreak(
                        cornerRoundRef.current,
                        playerStartHp,
                        opponentStartHp
                    );
                    barrageRoundRef.current = barrageRound;
                    resetBarrageStyleState();
                    setSelectedBarragePlayerCardId(null);
                    setSelectedBarrageOpponentCardId(null);
                    setBarrageState(getBarrageSnapshot(barrageRound, null, null));
                    void playSequence([
                        animationStep("opponent", "walk_in", {
                            action: "round-start",
                            fallbackMs: 5000,
                            returnToIdle: true
                        }),
                        animationStep("player", "walk_in", {
                            action: "round-start",
                            fallbackMs: 5000,
                            returnToIdle: true
                        })
                    ], { lockRoundIntro: true });
                    addCommentaryEntry("[Barrage] start.", "game_info");
                    if (barrageRound.barrage?.nibsPoints > 0) {
                        const starterCard = barrageRound.decks.flipDeck?.deck?.getCards()?.[0] || null;
                        const nibsDeck = getDeckDisplayData(barrageRound.barrage.nibsOwnerDeckName);
                        const defenderDeck = getDeckDisplayData(
                            barrageRound.barrage.nibsOwnerDeckName === "player1Deck" ? "player2Deck" : "player1Deck"
                        );
                        const reasonLabel = `his heels ${starterCard?.rank ?? "?"}-${starterCard?.suit ?? "?"}`;
                        addCommentaryEntry(
                            buildAttackCommentary(nibsDeck, defenderDeck, barrageRound.barrage.nibsPoints, reasonLabel),
                            "game_action"
                        );
                    }
                });
            }
        } catch (error) {
            setCornerBreakError(error?.message || "Unable to send cards to crib.");
        }
    };

    const sortCornerHandBySuitValue = (deckName = "player1Deck") => {
        const roundState = cornerRoundRef.current;
        if (!roundState) {
            return;
        }

        roundState.decks[deckName].deck.sort("suit-value");
        setCornerBreakState(getCornerBreakSnapshot(roundState, selectedCornerCardIds, selectedOpponentCornerCardIds));
    };

    const sortCornerHandByValue = (deckName = "player1Deck") => {
        const roundState = cornerRoundRef.current;
        if (!roundState) {
            return;
        }

        roundState.decks[deckName].deck.sort("value");
        setCornerBreakState(getCornerBreakSnapshot(roundState, selectedCornerCardIds, selectedOpponentCornerCardIds));
    };

    const shuffleCornerHand = (deckName = "player1Deck") => {
        const roundState = cornerRoundRef.current;
        if (!roundState) {
            return;
        }

        roundState.decks[deckName].deck.shuffle();
        setCornerBreakState(getCornerBreakSnapshot(roundState, selectedCornerCardIds, selectedOpponentCornerCardIds));
    };

    const resetBarrageForNextRound = () => {
        barrageRoundRef.current = null;
        aiBarrageInFlightRef.current = false;
        animationScriptTokenRef.current += 1;
        setIsShowdownRevealActive(false);
        clearPendingOpponentAnimation({ resolvePending: true, setIdle: true });
        clearPendingPlayerAnimation({ resolvePending: true, setIdle: true });
        resetBarrageStyleState();
        setBarrageState(null);
        setSelectedBarragePlayerCardId(null);
        setSelectedBarrageOpponentCardId(null);
        setIsRoundIntroComplete(true);
        setActiveOpponentAnimation("idle");
        setActivePlayerAnimation("idle");
    };

    const resolveRound = (winner, options = {}) => {
        const { forceMatchOver = false } = options;
        const playerRoundsWon = matchState.playerRoundsWon + (winner === "player" ? 1 : 0);
        const opponentRoundsWon = matchState.opponentRoundsWon + (winner === "opponent" ? 1 : 0);
        const isMatchOver = forceMatchOver || matchState.roundNumber >= activeCircuit.roundsPerMatch;

        if (!isMatchOver) {
            navigateWithTransition(SCREENS.CORNER, () => {
                resetBarrageForNextRound();
                setMatchState({
                    roundNumber: matchState.roundNumber + 1,
                    playerRoundsWon,
                    opponentRoundsWon
                });
                setStatusText(`Prepare for Round ${matchState.roundNumber + 1}`);
            });

            return;
        }

        const playerWonMatch = playerRoundsWon >= opponentRoundsWon;

        if (!playerWonMatch) {
            navigateWithTransition(SCREENS.HOME, () => {
                resetBarrageForNextRound();
                setMatchState(createInitialMatchState());
                setMatchCornerSelection(null);
                setStatusText("You lost the match. Return home and try again.");
            });

            return;
        }

        const isLastOpponentInCircuit =
            currentOpponentIndex >= activeCircuit.opponents.length - 1;
        const isLastCircuit = currentCircuitIndex >= CIRCUITS.length - 1;

        if (isLastOpponentInCircuit && isLastCircuit) {
            navigateWithTransition(SCREENS.HOME, () => {
                resetBarrageForNextRound();
                setMatchState(createInitialMatchState());
                setMatchCornerSelection(null);
                setStatusText("Champion crowned! You beat every circuit.");
            });

            return;
        }

        if (isLastOpponentInCircuit) {
            navigateWithTransition(SCREENS.TRAINING, () => {
                resetBarrageForNextRound();
                setMatchState(createInitialMatchState());
                setStatusText(`Circuit cleared: ${activeCircuit.name}. Time to train.`);
            });

            return;
        }

        const nextOpponentIndex = currentOpponentIndex + 1;

        navigateWithTransition(SCREENS.CORNER, () => {
            resetBarrageForNextRound();
            const nextCornerSelection = rollMatchCornerSelection();
            setCurrentOpponentIndex(nextOpponentIndex);
            setMatchState(createInitialMatchState());
            setMatchCornerSelection(nextCornerSelection);
            // New opponent — reset HP to each fighter's base stats
            setMatchHp({
                player: { current: playerBoxer?.hp ?? 50, max: playerBoxer?.hp ?? 50 },
                opponent: {
                    current: getSafeOpponent(currentCircuitIndex, nextOpponentIndex)?.hp ?? 50,
                    max: getSafeOpponent(currentCircuitIndex, nextOpponentIndex)?.hp ?? 50
                }
            });
            setStatusText(`New match coin flip: You are in the ${nextCornerSelection.playerCornerName} corner.`);

            saveProgress({
                playerBoxer,
                currentCircuitIndex,
                currentOpponentIndex: nextOpponentIndex
            });
        });
    };

    const continueFromTraining = () => {
        const nextCircuitIndex = Math.min(currentCircuitIndex + 1, CIRCUITS.length - 1);

        navigateWithTransition(SCREENS.CORNER, () => {
            resetBarrageForNextRound();
            const nextCornerSelection = rollMatchCornerSelection();
            setCurrentCircuitIndex(nextCircuitIndex);
            setCurrentOpponentIndex(0);
            setMatchState(createInitialMatchState());
            setMatchCornerSelection(nextCornerSelection);
            setStatusText(`Training complete. Coin flip puts you in the ${nextCornerSelection.playerCornerName} corner.`);

            saveProgress({
                playerBoxer,
                currentCircuitIndex: nextCircuitIndex,
                currentOpponentIndex: 0
            });
        });
    };

    const canDeckPlayAtPegCount = (deckName, pegCount = null) => {
        if (!barrageState) return false;
        const hand = deckName === "player1Deck" ? barrageState.playerHand : barrageState.opponentHand;
        const activePegCount = pegCount ?? barrageState.pegCount ?? 0;
        return (hand || []).some((card) => activePegCount + (card?.pegValue ?? 0) <= 31);
    };

    const handleBarrageGo = (roundState, deckName) => {
        const handled = submitBarrageGo(roundState, deckName);
        if (!handled) return false;

        const actingDeck = getDeckDisplayData(deckName);
        addCommentaryEntry([
            { text: actingDeck.name, italic: true, color: actingDeck.color },
            " calls ",
            { text: "Go", bold: true },
            "."
        ], "game_warning");
        return true;
    };

    const triggerBarrageGoAnimation = (deckName) => {
        const actingActor = deckName === "player1Deck" ? "player" : "opponent";
        const defendingActor = actingActor === "player" ? "opponent" : "player";
        const actingDeck = getDeckDisplayData(deckName);
        const defendingDeck = getDeckDisplayData(deckName === "player1Deck" ? "player2Deck" : "player1Deck");

        addCommentaryEntry([
            { text: defendingDeck.name, italic: true, color: defendingDeck.color },
            " executes a flawless ",
            { text: "pull", bold: true },
            ", avoiding a punch telegraphed by ",
            { text: actingDeck.name, italic: true, color: actingDeck.color },
            "."
        ], "game_action");

        void playParallel([
            animationStep(actingActor, "jab", {
                action: "barrage-go-jab",
                fallbackMs: 2500,
                returnToIdle: true
            }),
            animationStep(defendingActor, "dodge", {
                action: "barrage-go-dodge",
                fallbackMs: 2500,
                returnToIdle: true
            })
        ]);
    };

    const toggleBarrageCardSelection = (cardId, deckName = "player1Deck") => {
        if (!isRoundIntroComplete) return;
        if (!barrageState || barrageState.isComplete || barrageState.isKO) return;
        const isPlayer1 = deckName === "player1Deck";
        if (isPlayer1 && barrageState.activeBarrageDeckName !== "player1Deck") return;
        if (!isPlayer1 && (useAIOpponent || barrageState.activeBarrageDeckName !== "player2Deck")) return;

        const hand = isPlayer1 ? barrageState.playerHand : barrageState.opponentHand;
        const selectedCard = (hand || []).find((card) => card.id === cardId);
        if (!selectedCard) return;
        if ((barrageState.pegCount ?? 0) + (selectedCard.pegValue ?? 0) > 31) return;

        if (isPlayer1) {
            setSelectedBarragePlayerCardId((prev) => (prev === cardId ? null : cardId));
        } else {
            setSelectedBarrageOpponentCardId((prev) => (prev === cardId ? null : cardId));
        }
    };

    const resolveBarrageEnd = (snapshot) => {
        if (!snapshot) return;
        // Persist HP so Corner and the next round start with the correct values
        setMatchHp({ player: snapshot.playerHp, opponent: snapshot.opponentHp });

        const isKnockout =
            snapshot.playerHp.current <= 0 || snapshot.opponentHp.current <= 0;

        if (snapshot.playerHp.current <= 0) {
            resolveRound("opponent", { forceMatchOver: isKnockout });
        } else if (snapshot.opponentHp.current <= 0) {
            resolveRound("player", { forceMatchOver: isKnockout });
        } else {
            // No KO — advance via points (player wins ties)
            const playerWon = snapshot.playerHp.current >= snapshot.opponentHp.current;
            resolveRound(playerWon ? "player" : "opponent");
        }
    };

    const finalizeBarrageAndResolve = async (roundState, snapshot) => {
        if (!snapshot) return;

        if (snapshot.isKO) {
            addCommentaryEntry("[Barrage] knockout!", "game_danger");
            setTimeout(() => resolveBarrageEnd(snapshot), 500);
            return;
        }

        if (!snapshot.isComplete) {
            return;
        }

        addCommentaryEntry("[Barrage] complete.", "game_info");
        addCommentaryEntry("Bell is about to ring. Close the round strong!", "game_info");

        const preClosingSnapshot = getBarrageSnapshot(roundState, null, null);
        setBarrageState(preClosingSnapshot);
        setIsShowdownRevealActive(true);
        await new Promise((resolve) => setTimeout(resolve, 900));

        let closingRound;
        try {
            closingRound = applyClosingRoundScoring(roundState, { applyDamage: false });
        } catch (error) {
            console.error("Closing round scoring failed:", error);
            addCommentaryEntry("[Closing Round] scoring failed; resolving round with current totals.", "game_warning");
            const fallbackSnapshot = getBarrageSnapshot(roundState, null, null);
            setBarrageState(fallbackSnapshot);
            setTimeout(() => resolveBarrageEnd(fallbackSnapshot), 650);
            return;
        }

        for (const warning of closingRound.warnings) {
            addCommentaryEntry(warning, "game_warning");
        }

        let runningPlayerHp = { ...preClosingSnapshot.playerHp };
        let runningOpponentHp = { ...preClosingSnapshot.opponentHp };

        const scoredEvents = closingRound.events.filter((event) => event && event.points > 0);
        for (let index = 0; index < scoredEvents.length; index += 1) {
            const event = scoredEvents[index];
            const attackerDeck = getDeckDisplayData(event.scoringDeckName);
            const defenderDeck = getDeckDisplayData(
                event.scoringDeckName === "player1Deck" ? "player2Deck" : "player1Deck"
            );
            addCommentaryEntry(
                buildAttackCommentary(attackerDeck, defenderDeck, event.points, event.reasonLabel),
                "game_action"
            );
            let animationRan = false;
            if (event.scoringDeckName === "player2Deck") {
                await playOpponentAnimationFromDamage(event.points);
                animationRan = true;
            }
            if (event.scoringDeckName === "player1Deck") {
                await playPlayerAnimationFromDamage(event.points);
                animationRan = true;
            }
            if (event.scoringDeckName === "player1Deck") {
                runningOpponentHp = {
                    ...runningOpponentHp,
                    current: Math.max(0, runningOpponentHp.current - event.points)
                };
                roundState.hp.opponent = { ...runningOpponentHp };
            } else {
                runningPlayerHp = {
                    ...runningPlayerHp,
                    current: Math.max(0, runningPlayerHp.current - event.points)
                };
                roundState.hp.player = { ...runningPlayerHp };
            }
            setBarrageState((previous) => {
                if (!previous) {
                    return previous;
                }

                return {
                    ...previous,
                    playerHp: { ...runningPlayerHp },
                    opponentHp: { ...runningOpponentHp }
                };
            });
            if (animationRan) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
            if (index < scoredEvents.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 1250));
            }
        }

        if (closingRound.isKO) {
            addCommentaryEntry("[Closing Round] knockout!", "game_danger");
        }

        const postClosingSnapshot = getBarrageSnapshot(roundState, null, null);
        setBarrageState(postClosingSnapshot);
        setTimeout(() => resolveBarrageEnd(postClosingSnapshot), 650);
    };

    const triggerAIBarragePlay = async (roundState) => {
        const opponent = roundState.opponentController;
        if (!opponent) return;

        if (getBarrageSnapshot(roundState, null, null).activeBarrageDeckName !== "player2Deck") {
            return;
        }

        const thinkMs = Math.max(600, 1000 + opponent.incompetence * 15);
        await new Promise((r) => setTimeout(r, thinkMs));

        // If phase changed while thinking, bail out
        if (roundState.phase !== "barrage") return;

        try {
            let playedCard = null;
            let pegResult = null;
            const hand = roundState.decks.player2Deck.deck.getCards();
            const pegCount = roundState.barrage.pegCount;
            const validCards = hand.filter((c) => pegCount + c.pegValue <= 31);
            if (validCards.length === 0) {
                const didCallGo = handleBarrageGo(roundState, "player2Deck");
                if (didCallGo) {
                    triggerBarrageGoAnimation("player2Deck");
                }
            } else {
                const card = await opponent.selectCardToPlay(hand, validCards, {
                    pegCount,
                    pegSequence: roundState.barrage.pegSequence
                });
                if (card) {
                    playedCard = card;
                    pegResult = submitBarrageCard(roundState, "player2Deck", card.id);
                    const opponentDeck = getDeckDisplayData("player2Deck");
                    addCommentaryEntry([
                        { text: opponentDeck.name, italic: true, color: opponentDeck.color },
                        " plays ",
                        { text: `${card.rank}-${card.suit}`, bold: true },
                        "."
                    ], "game_info");
                }
            }

            if (playedCard && pegResult?.total > 0) {
                const opponentDeck = getDeckDisplayData("player2Deck");
                const playerDeck = getDeckDisplayData("player1Deck");
                const reasonLabel = describePeggingReason(pegResult, playedCard);
                addCommentaryEntry(
                    buildAttackCommentary(opponentDeck, playerDeck, pegResult.total, reasonLabel),
                    "game_action"
                );
                triggerOpponentAnimationFromDamage(pegResult.total);
            }

            const next = getBarrageSnapshot(roundState, null, null);
            setBarrageState(next);
            setSelectedBarragePlayerCardId(null);

            if (next.isComplete || next.isKO) {
                void finalizeBarrageAndResolve(roundState, next);
                return;
            }

            // Recurse if AI still has the turn (e.g. after Go)
            if (next.activeBarrageDeckName === "player2Deck") {
                await triggerAIBarragePlay(roundState);
            }
        } catch (err) {
            console.error("AI barrage error:", err);
        }
    };

    useEffect(() => {
        if (!useAIOpponent || screen !== SCREENS.RING || !barrageState) return;
        if (!isRoundIntroComplete) return;
        if (barrageState.isComplete || barrageState.isKO) return;
        if (barrageState.activeBarrageDeckName !== "player2Deck") return;
        if (aiBarrageInFlightRef.current) return;

        const roundState = barrageRoundRef.current;
        if (!roundState) return;

        aiBarrageInFlightRef.current = true;
        triggerAIBarragePlay(roundState)
            .catch((err) => {
                console.error("AI barrage start error:", err);
            })
            .finally(() => {
                aiBarrageInFlightRef.current = false;
            });
    }, [useAIOpponent, screen, barrageState, isRoundIntroComplete]);

    const submitBarragePlay = async (deckName = "player1Deck") => {
        if (!isRoundIntroComplete) return;
        const roundState = barrageRoundRef.current;
        if (!roundState || !barrageState) return;

        const selectedId =
            deckName === "player1Deck"
                ? selectedBarragePlayerCardId
                : selectedBarrageOpponentCardId;

        const isPlayer1 = deckName === "player1Deck";
        const hand = isPlayer1 ? barrageState.playerHand : barrageState.opponentHand;
        const hasLegalCard = canDeckPlayAtPegCount(deckName);

        try {
            let playedCard = null;
            let pegResult = null;
            if (!hasLegalCard) {
                const didCallGo = handleBarrageGo(roundState, deckName);
                if (didCallGo) {
                    triggerBarrageGoAnimation(deckName);
                }
            } else if (!selectedId) {
                return;
            } else {
                playedCard = (hand || []).find((card) => card.id === selectedId) || null;
                if (!playedCard) {
                    if (isPlayer1) setSelectedBarragePlayerCardId(null);
                    else setSelectedBarrageOpponentCardId(null);
                    return;
                }

                if ((barrageState.pegCount ?? 0) + (playedCard.pegValue ?? 0) > 31) {
                    if (isPlayer1) setSelectedBarragePlayerCardId(null);
                    else setSelectedBarrageOpponentCardId(null);
                    if (!canDeckPlayAtPegCount(deckName)) {
                        const didCallGo = handleBarrageGo(roundState, deckName);
                        if (didCallGo) {
                            triggerBarrageGoAnimation(deckName);
                        }
                    }
                    return;
                }

                pegResult = submitBarrageCard(roundState, deckName, selectedId);
                const actingDeck = getDeckDisplayData(deckName);
                addCommentaryEntry([
                    { text: actingDeck.name, italic: true, color: actingDeck.color },
                    " plays ",
                    { text: `${playedCard.rank}-${playedCard.suit}`, bold: true },
                    "."
                ], "game_info");
            }

            if (playedCard && pegResult?.total > 0) {
                const actingDeck = getDeckDisplayData(deckName);
                const defenderDeck = getDeckDisplayData(deckName === "player1Deck" ? "player2Deck" : "player1Deck");
                const reasonLabel = describePeggingReason(pegResult, playedCard);
                addCommentaryEntry(
                    buildAttackCommentary(actingDeck, defenderDeck, pegResult.total, reasonLabel),
                    "game_action"
                );

                if (deckName === "player2Deck") {
                    triggerOpponentAnimationFromDamage(pegResult.total);
                } else {
                    triggerPlayerAnimationFromDamage(pegResult.total);
                }
            }

            if (deckName === "player1Deck") setSelectedBarragePlayerCardId(null);
            else setSelectedBarrageOpponentCardId(null);

            const next = getBarrageSnapshot(roundState, null, null);
            setBarrageState(next);

            if (next.isComplete || next.isKO) {
                void finalizeBarrageAndResolve(roundState, next);
                return;
            }
        } catch (err) {
            console.warn("Barrage submit ignored:", err);
            const next = getBarrageSnapshot(roundState, null, null);
            setBarrageState(next);
            setSelectedBarragePlayerCardId(null);
            setSelectedBarrageOpponentCardId(null);
        }
    };

    const sortBarrageHand = (deckName, sortType) => {
        if (!isRoundIntroComplete) return;
        const roundState = barrageRoundRef.current;
        if (!roundState) return;

        const styleState = barrageStyleStateRef.current[deckName];
        const actingDeck = getDeckDisplayData(deckName);

        if (styleState) {
            if (sortType === "value" && !styleState.hasStanceOrthodox) {
                addCommentaryEntry([
                    { text: actingDeck.name, italic: true, color: actingDeck.color },
                    " with an orthodox stance."
                ], "game_action");
                styleState.hasStanceOrthodox = true;
                styleState.hasStanceSouthpaw = false;
            } else if (sortType === "suit-value" && !styleState.hasStanceSouthpaw) {
                addCommentaryEntry([
                    { text: actingDeck.name, italic: true, color: actingDeck.color },
                    " with a southpaw stance."
                ], "game_action");
                styleState.hasStanceSouthpaw = true;
                styleState.hasStanceOrthodox = false;
            }
        }

        roundState.decks[deckName].deck.sort(sortType);
        setBarrageState(getBarrageSnapshot(roundState, null, null));
        if (deckName === "player1Deck") setSelectedBarragePlayerCardId(null);
        else setSelectedBarrageOpponentCardId(null);
    };

    const shuffleBarrageHand = (deckName) => {
        if (!isRoundIntroComplete) return;
        const roundState = barrageRoundRef.current;
        if (!roundState) return;

        const styleState = barrageStyleStateRef.current[deckName];
        if (styleState && !styleState.hasChamberedArms) {
            const actingDeck = getDeckDisplayData(deckName);
            addCommentaryEntry([
                { text: actingDeck.name, italic: true, color: actingDeck.color },
                " \"chambers up\" his arms for the next assault."
            ], "game_action");
            styleState.hasChamberedArms = true;
        }

        roundState.decks[deckName].deck.shuffle();
        setBarrageState(getBarrageSnapshot(roundState, null, null));
        if (deckName === "player1Deck") setSelectedBarragePlayerCardId(null);
        else setSelectedBarrageOpponentCardId(null);
    };

    return (
        <main className="game-root">
            <div className={`screen-stage ${isTransitioning ? "screen-stage--transition" : ""}`}>
                {screen === SCREENS.HOME && (
                    <Home
                        onNewGame={startNewGame}
                        onContinue={continueGame}
                        statusText={statusText}
                        useAIOpponent={useAIOpponent}
                        onToggleAIOpponent={setUseAIOpponent}
                    />
                )}

                {screen === SCREENS.SELECT && <Select onChooseBoxer={chooseBoxer} />}

                {screen === SCREENS.CORNER && (
                    <Corner
                        playerBoxer={playerBoxer || BOXERS.male}
                        opponent={activeOpponent}
                        roundNumber={matchState.roundNumber}
                        playerRoundsWon={matchState.playerRoundsWon}
                        opponentRoundsWon={matchState.opponentRoundsWon}
                        statusText={statusText}
                        cornerBreak={cornerBreakState}
                        playerCurrentHp={matchHp?.player?.current ?? playerBoxer?.hp}
                        playerMaxHp={matchHp?.player?.max ?? playerBoxer?.hp}
                        opponentCurrentHp={matchHp?.opponent?.current ?? activeOpponent?.hp}
                        opponentMaxHp={matchHp?.opponent?.max ?? activeOpponent?.hp}
                        onTogglePlayerCornerCard={(cardId) => toggleCornerCardSelection(cardId, "player1Deck")}
                        onToggleOpponentCornerCard={(cardId) => toggleCornerCardSelection(cardId, "player2Deck")}
                        onSubmitPlayerCornerBreak={() => submitCornerBreak("player1Deck")}
                        onSubmitOpponentCornerBreak={() => submitCornerBreak("player2Deck")}
                        onSortPlayerCornerHandBySuitValue={() => sortCornerHandBySuitValue("player1Deck")}
                        onSortOpponentCornerHandBySuitValue={() => sortCornerHandBySuitValue("player2Deck")}
                        onSortPlayerCornerHandByValue={() => sortCornerHandByValue("player1Deck")}
                        onSortOpponentCornerHandByValue={() => sortCornerHandByValue("player2Deck")}
                        onShufflePlayerCornerHand={() => shuffleCornerHand("player1Deck")}
                        onShuffleOpponentCornerHand={() => shuffleCornerHand("player2Deck")}
                        isOpponentAi={useAIOpponent}
                        cornerBreakError={cornerBreakError}
                        playerCornerColor={matchCornerSelection?.playerCornerColor}
                        opponentCornerColor={matchCornerSelection?.opponentCornerColor}
                        commentaryEntries={commentaryEntries}
                    />
                )}

                {screen === SCREENS.RING && (
                    <Ring
                        playerBoxer={playerBoxer || BOXERS.male}
                        opponent={activeOpponent}
                        roundNumber={matchState.roundNumber}
                        playerRoundsWon={matchState.playerRoundsWon}
                        opponentRoundsWon={matchState.opponentRoundsWon}
                        barrage={barrageState}
                        selectedBarragePlayerCardId={selectedBarragePlayerCardId}
                        selectedBarrageOpponentCardId={selectedBarrageOpponentCardId}
                        onTogglePlayerBarrageCard={(cardId) => toggleBarrageCardSelection(cardId, "player1Deck")}
                        onToggleOpponentBarrageCard={(cardId) => toggleBarrageCardSelection(cardId, "player2Deck")}
                        onSubmitPlayerBarragePlay={() => submitBarragePlay("player1Deck")}
                        onSubmitOpponentBarragePlay={() => submitBarragePlay("player2Deck")}
                        onSortPlayerBarrageHandBySuitValue={() => sortBarrageHand("player1Deck", "suit-value")}
                        onSortOpponentBarrageHandBySuitValue={() => sortBarrageHand("player2Deck", "suit-value")}
                        onSortPlayerBarrageHandByValue={() => sortBarrageHand("player1Deck", "value")}
                        onSortOpponentBarrageHandByValue={() => sortBarrageHand("player2Deck", "value")}
                        onShufflePlayerBarrageHand={() => shuffleBarrageHand("player1Deck")}
                        onShuffleOpponentBarrageHand={() => shuffleBarrageHand("player2Deck")}
                        isOpponentAi={useAIOpponent}
                        playerCornerColor={matchCornerSelection?.playerCornerColor}
                        opponentCornerColor={matchCornerSelection?.opponentCornerColor}
                        commentaryEntries={commentaryEntries}
                        isRoundIntroComplete={isRoundIntroComplete}
                        activeOpponentAnimation={activeOpponentAnimation}
                        onOpponentAnimationComplete={handleOpponentAnimationComplete}
                        activePlayerAnimation={activePlayerAnimation}
                        isPlayerSouthpaw={Boolean(barrageStyleStateRef.current.player1Deck?.hasStanceSouthpaw)}
                        isOpponentSouthpaw={Boolean(barrageStyleStateRef.current.player2Deck?.hasStanceSouthpaw)}
                        isShowdownRevealActive={isShowdownRevealActive}
                        onPlayerAnimationComplete={handlePlayerAnimationComplete}
                    />
                )}

                {screen === SCREENS.TRAINING && (
                    <Training
                        circuitName={activeCircuit.name}
                        onContinue={continueFromTraining}
                    />
                )}
            </div>
        </main>
    );
}

export default Game;
