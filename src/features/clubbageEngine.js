import { Deck } from "../assets/js/Deck";
import { Opponent } from "../assets/js/Opponent";
import * as cribbageRules from "../assets/js/cribbageRules";

const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

const DECK_MAIN_SIZE = 52;
const DECK_CRIB_SIZE = 4;
const DECK_PLAYER_SIZE = 6;

function getPegValue(rank) {
    if (rank === "A") return 1;
    if (["J", "Q", "K"].includes(rank)) return 10;
    return Number.parseInt(rank, 10);
}

function getRunValue(rank) {
    if (rank === "A") return 1;
    if (rank === "J") return 11;
    if (rank === "Q") return 12;
    if (rank === "K") return 13;
    return Number.parseInt(rank, 10);
}

function setCardOwner(deckName, cards) {
    for (const card of cards) {
        card.ownerDeck = deckName;
    }
}

function makeDeck(id, maxSize) {
    return new Deck(id, maxSize, SUITS, RANKS);
}

export function createCornerBreakRound({
    cribOwner = 1,
    opponentIncompetence = 50
} = {}) {
    const mainDeck = makeDeck("mainDeck", DECK_MAIN_SIZE);
    const player1Deck = makeDeck("player1Deck", DECK_PLAYER_SIZE);
    const player2Deck = makeDeck("player2Deck", DECK_PLAYER_SIZE);
    const cribDeck = makeDeck("cribDeck", DECK_CRIB_SIZE);

    const cards = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            cards.push({
                id: `${rank}-${suit}`,
                rank,
                suit,
                pegValue: getPegValue(rank),
                runValue: getRunValue(rank)
            });
        }
    }

    mainDeck.cards = cards;
    mainDeck.shuffle();
    mainDeck.deal([player1Deck, player2Deck], [DECK_PLAYER_SIZE, DECK_PLAYER_SIZE], "top");

    setCardOwner("player1Deck", player1Deck.getCards());
    setCardOwner("player2Deck", player2Deck.getCards());

    return {
        phase: "cornerBreak",
        cribOwner,
        opponentController: new Opponent(opponentIncompetence),
        decks: {
            mainDeck: {
                deck: mainDeck
            },
            player1Deck: {
                deck: player1Deck,
                hasSentToCrib: false
            },
            player2Deck: {
                deck: player2Deck,
                hasSentToCrib: false
            },
            cribDeck: {
                deck: cribDeck
            }
        }
    };
}

export function isCornerBreakComplete(roundState) {
    return Boolean(
        roundState?.phase === "cornerBreak" &&
            roundState?.decks?.player1Deck?.hasSentToCrib &&
            roundState?.decks?.player2Deck?.hasSentToCrib &&
            roundState?.decks?.cribDeck?.deck?.getCardCount() === DECK_CRIB_SIZE
    );
}

export function getCornerBreakSnapshot(roundState, selectedPlayerCardIds = [], selectedOpponentCardIds = []) {
    return {
        phase: roundState.phase,
        cribOwner: roundState.cribOwner,
        playerHand: [...roundState.decks.player1Deck.deck.getCards()],
        opponentHand: [...roundState.decks.player2Deck.deck.getCards()],
        opponentHandCount: roundState.decks.player2Deck.deck.getCardCount(),
        cribCards: [...roundState.decks.cribDeck.deck.getCards()],
        playerSentToCrib: roundState.decks.player1Deck.hasSentToCrib,
        opponentSentToCrib: roundState.decks.player2Deck.hasSentToCrib,
        selectedPlayerCardIds,
        selectedOpponentCardIds,
        isComplete: isCornerBreakComplete(roundState)
    };
}

export function submitCornerBreakSelectionForDeck(roundState, deckName, selectedCardIds) {
    if (!Array.isArray(selectedCardIds) || selectedCardIds.length !== 2) {
        throw new Error("Select exactly 2 cards to send to crib.");
    }

    const deckState = roundState?.decks?.[deckName];
    if (!deckState?.deck) {
        throw new Error("Corner break deck is unavailable.");
    }

    if (deckState.hasSentToCrib) {
        throw new Error("Cards already sent to crib for this hand.");
    }

    const selectedCards = deckState.deck
        .getCards()
        .filter((card) => selectedCardIds.includes(card.id));

    if (selectedCards.length !== 2) {
        throw new Error("Selected cards are not available in this hand.");
    }

    deckState.deck.pass(roundState.decks.cribDeck.deck, selectedCards);
    deckState.hasSentToCrib = true;
}

// ─── Barrage (Play Phase) ─────────────────────────────────────────────────────

const DECK_FLIP_SIZE = 1;
const DECK_PLAY_SIZE = 8; // 4 cards per player × 2 players

function getActiveBarrageDeckName(roundState) {
    const p1 = roundState.player1HasPlayedOne;
    const p2 = roundState.player2HasPlayedOne;
    if (!p1 && p2) return "player1Deck";
    if (!p2 && p1) return "player2Deck";
    return null;
}

function isBarrageRoundComplete(roundState) {
    return (
        roundState?.phase === "barrage" &&
        roundState?.decks?.playDeck?.deck?.getCardCount() === DECK_PLAY_SIZE
    );
}

function canDeckPlayAtCount(deck, pegCount) {
    return deck.getCards().some((c) => pegCount + c.pegValue <= 31);
}

/**
 * Transition a completed cornerBreak roundState into the barrage phase.
 * Deals 1 card from mainDeck → flipDeck (starter card), checks nibs.
 * Mutates roundState in-place and returns it.
 *
 * playerHp / opponentHp: { current, max } — carry the live HP from the previous round.
 */
export function createBarrageFromCornerBreak(
    cornerState,
    playerHp = { current: 50, max: 50 },
    opponentHp = { current: 50, max: 50 }
) {
    const flipDeck = makeDeck("flipDeck", DECK_FLIP_SIZE);
    const playDeck = makeDeck("playDeck", DECK_PLAY_SIZE);

    cornerState.decks.mainDeck.deck.deal([flipDeck], [1], "top");

    const starterCard = flipDeck.getCards()[0] ?? null;
    const nibsPoints = starterCard ? cribbageRules.scoreNibs(starterCard) : 0;
    const nibsOwnerDeckName =
        nibsPoints > 0
            ? cornerState.cribOwner === 1
                ? "player1Deck"
                : "player2Deck"
            : null;

    // Dealer has "played" (cut the deck) → non-dealer leads the barrage
    const player1HasPlayedOne = cornerState.cribOwner === 1;
    const player2HasPlayedOne = cornerState.cribOwner === 2;

    // Apply nibs HP damage to the non-crib-owner
    const nibsDamagedSide = nibsOwnerDeckName === "player1Deck" ? "opponent" : "player";
    const playerHpStart =
        nibsDamagedSide === "player" && nibsPoints > 0
            ? Math.max(0, playerHp.current - nibsPoints)
            : playerHp.current;
    const opponentHpStart =
        nibsDamagedSide === "opponent" && nibsPoints > 0
            ? Math.max(0, opponentHp.current - nibsPoints)
            : opponentHp.current;

    cornerState.phase = "barrage";
    cornerState.decks.flipDeck = { deck: flipDeck };
    cornerState.decks.playDeck = { deck: playDeck };
    cornerState.barrage = {
        pegSequence: [],
        pegCount: 0,
        nibsPoints,
        nibsOwnerDeckName
    };
    cornerState.hp = {
        player: { current: playerHpStart, max: playerHp.max },
        opponent: { current: opponentHpStart, max: opponentHp.max }
    };
    cornerState.player1HasPlayedOne = player1HasPlayedOne;
    cornerState.player2HasPlayedOne = player2HasPlayedOne;

    return cornerState;
}

/**
 * Snapshot of the current barrage state for React rendering.
 */
export function getBarrageSnapshot(
    roundState,
    selectedPlayerCardId = null,
    selectedOpponentCardId = null
) {
    const playerHand = [...roundState.decks.player1Deck.deck.getCards()];
    const opponentHand = [...roundState.decks.player2Deck.deck.getCards()];
    const cribCards = [...roundState.decks.cribDeck.deck.getCards()];
    const playedCards = [...(roundState.decks.playDeck?.deck?.getCards() ?? [])];
    const starterCard = roundState.decks.flipDeck?.deck?.getCards()[0] ?? null;

    const activeBarrageDeckName = getActiveBarrageDeckName(roundState);
    const isComplete = isBarrageRoundComplete(roundState);
    const isKO =
        roundState.hp.player.current <= 0 || roundState.hp.opponent.current <= 0;

    return {
        phase: roundState.phase,
        cribOwner: roundState.cribOwner,
        starterCard,
        nibsPoints: roundState.barrage.nibsPoints,
        nibsOwnerDeckName: roundState.barrage.nibsOwnerDeckName,
        cribCards,
        playerHand,
        opponentHand,
        opponentHandCount: opponentHand.length,
        playedCards,
        pegCount: roundState.barrage.pegCount,
        pegSequence: [...roundState.barrage.pegSequence],
        activeBarrageDeckName,
        selectedPlayerCardId,
        selectedOpponentCardId,
        isComplete,
        isKO,
        playerHp: { ...roundState.hp.player },
        opponentHp: { ...roundState.hp.opponent }
    };
}

/**
 * Play a card during barrage. Throws on invalid moves.
 * Returns the cribbageRules scorePegging result.
 */
export function submitBarrageCard(roundState, deckName, selectedCardId) {
    const activeDeckName = getActiveBarrageDeckName(roundState);
    if (activeDeckName !== deckName) {
        throw new Error("Not this player's turn.");
    }

    const deckState = roundState.decks[deckName];
    const card = deckState.deck.getCards().find((c) => c.id === selectedCardId);
    if (!card) throw new Error("Card not found in hand.");

    if (roundState.barrage.pegCount + card.pegValue > 31) {
        throw new Error(
            `Playing ${card.rank} (${card.pegValue}) would exceed 31. Current count: ${roundState.barrage.pegCount}.`
        );
    }

    // Move card to play deck
    deckState.deck.pass(roundState.decks.playDeck.deck, [card]);

    // The player who just played has "played", other player is now active
    roundState.player1HasPlayedOne = deckName === "player1Deck";
    roundState.player2HasPlayedOne = deckName === "player2Deck";

    // Update peg sequence
    roundState.barrage.pegSequence.push(card);
    roundState.barrage.pegCount += card.pegValue;

    // Determine isLastCard
    const otherDeckName = deckName === "player1Deck" ? "player2Deck" : "player1Deck";
    const currentCanPlay = canDeckPlayAtCount(
        roundState.decks[deckName].deck,
        roundState.barrage.pegCount
    );
    const otherCanPlay = canDeckPlayAtCount(
        roundState.decks[otherDeckName].deck,
        roundState.barrage.pegCount
    );
    const isLastCard = !currentCanPlay && !otherCanPlay;

    const pegResult = cribbageRules.scorePegging(roundState.barrage.pegSequence, isLastCard);

    if (pegResult.total > 0) {
        if (deckName === "player1Deck") {
            roundState.hp.opponent.current = Math.max(
                0,
                roundState.hp.opponent.current - pegResult.total
            );
        } else {
            roundState.hp.player.current = Math.max(
                0,
                roundState.hp.player.current - pegResult.total
            );
        }
    }

    // Reset peg sequence after 31 or last card
    if (pegResult.thirtyOne > 0 || isLastCard) {
        roundState.barrage.pegSequence = [];
        roundState.barrage.pegCount = 0;
    }

    return pegResult;
}

/**
 * Declare a Go for the given deck when no legal card can be played.
 * Returns true if the Go was accepted, false if the deck has legal cards (Go not valid).
 */
export function submitBarrageGo(roundState, deckName) {
    const activeDeckName = getActiveBarrageDeckName(roundState);
    if (activeDeckName !== deckName) return false;

    // Player must genuinely have no legal play
    if (canDeckPlayAtCount(roundState.decks[deckName].deck, roundState.barrage.pegCount)) {
        return false;
    }

    const otherDeckName = deckName === "player1Deck" ? "player2Deck" : "player1Deck";
    const otherCanPlay = canDeckPlayAtCount(
        roundState.decks[otherDeckName].deck,
        roundState.barrage.pegCount
    );

    if (otherCanPlay) {
        // Partial Go: pass turn to the opponent
        roundState.player1HasPlayedOne = deckName === "player1Deck" ? true : false;
        roundState.player2HasPlayedOne = deckName === "player2Deck" ? true : false;
    } else {
        // Full Go: award last-card point to whoever last played, then reset
        if (roundState.barrage.pegSequence.length > 0 && roundState.barrage.pegCount < 31) {
            const lastCard =
                roundState.barrage.pegSequence[roundState.barrage.pegSequence.length - 1];
            const scorerDeckName = lastCard.ownerDeck;
            if (scorerDeckName === "player1Deck") {
                roundState.hp.opponent.current = Math.max(0, roundState.hp.opponent.current - 1);
            } else {
                roundState.hp.player.current = Math.max(0, roundState.hp.player.current - 1);
            }
        }
        roundState.barrage.pegSequence = [];
        roundState.barrage.pegCount = 0;
        // Player who said Go leads the next count
        roundState.player1HasPlayedOne = deckName === "player1Deck" ? false : true;
        roundState.player2HasPlayedOne = deckName === "player2Deck" ? false : true;
    }

    return true;
}

// ─── Closing the Round (Show) Phase ─────────────────────────────────────────────────────

function applyClosingRoundDamage(hpState, scoringDeckName, points) {
    if (points <= 0) return;

    if (scoringDeckName === "player1Deck") {
        hpState.opponent.current = Math.max(0, hpState.opponent.current - points);
    } else {
        hpState.player.current = Math.max(0, hpState.player.current - points);
    }
}

function describeShowScoring(result) {
    const reasons = [];
    if (result.fifteens > 0) reasons.push(`fifteens (${result.fifteens})`);
    if (result.pairs > 0) reasons.push(`pairs (${result.pairs})`);
    if (result.runs > 0) reasons.push(`runs (${result.runs})`);
    if (result.flush > 0) reasons.push(`flush (${result.flush})`);
    if (result.nobs > 0) reasons.push(`nobs (${result.nobs})`);
    return reasons.length > 0 ? reasons.join(", ") : "no score";
}

/**
 * Apply end-of-round show scoring (both hands + crib) after barrage is complete.
 * Returns scoring events and warnings for UI commentary.
 */
export function applyClosingRoundScoring(roundState, { applyDamage = true } = {}) {
    const warnings = [];
    const events = [];
    const result = {
        warnings,
        events,
        isKO: false,
        knockoutDeckName: null
    };

    const hpState = {
        player: { ...roundState.hp.player },
        opponent: { ...roundState.hp.opponent }
    };

    const syncRoundHpState = () => {
        if (!applyDamage) return;
        roundState.hp.player = { ...hpState.player };
        roundState.hp.opponent = { ...hpState.opponent };
    };

    const detectKnockoutDeckName = () => {
        if (hpState.player.current <= 0) return "player1Deck";
        if (hpState.opponent.current <= 0) return "player2Deck";
        return null;
    };

    const starterCard = roundState?.decks?.flipDeck?.deck?.getCards()?.[0] ?? null;
    if (!starterCard) {
        warnings.push("[Closing Round] no starter card in flip deck; skipping hand scoring.");
        return result;
    }

    const playCards = [...(roundState?.decks?.playDeck?.deck?.getCards() ?? [])];
    const player1Hand = playCards.filter((card) => card.ownerDeck === "player1Deck");
    const player2Hand = playCards.filter((card) => card.ownerDeck === "player2Deck");

    if (player1Hand.length !== 4 || player2Hand.length !== 4) {
        warnings.push(
            `[Closing Round] expected 4 cards per player in play deck, found ${player1Hand.length} and ${player2Hand.length}.`
        );
    }

    const nonDealerDeckName = roundState.cribOwner === 1 ? "player2Deck" : "player1Deck";
    const dealerDeckName = roundState.cribOwner === 1 ? "player1Deck" : "player2Deck";

    const scoringOrder = [
        {
            deckName: nonDealerDeckName,
            hand: nonDealerDeckName === "player1Deck" ? player1Hand : player2Hand,
            label: "hand"
        },
        {
            deckName: dealerDeckName,
            hand: dealerDeckName === "player1Deck" ? player1Hand : player2Hand,
            label: "hand"
        }
    ];

    // Score each player's hand before the crib.
    for (const item of scoringOrder) {
        const result = cribbageRules.scoreHand(item.hand, starterCard, false);
        applyClosingRoundDamage(hpState, item.deckName, result.total);
        syncRoundHpState();
        events.push({
            scoringDeckName: item.deckName,
            points: result.total,
            reasonLabel: `${item.label}: ${describeShowScoring(result)}`
        });

        const knockoutDeckName = detectKnockoutDeckName();
        if (knockoutDeckName) {
            return {
                warnings,
                events,
                isKO: true,
                knockoutDeckName
            };
        }
    }

    // Score the crib.
    const cribCards = [...(roundState?.decks?.cribDeck?.deck?.getCards() ?? [])];
    const cribResult = cribbageRules.scoreHand(cribCards, starterCard, true);
    applyClosingRoundDamage(hpState, dealerDeckName, cribResult.total);
    syncRoundHpState();
    events.push({
        scoringDeckName: dealerDeckName,
        points: cribResult.total,
        reasonLabel: `crib: ${describeShowScoring(cribResult)}`
    });

    const knockoutDeckName = detectKnockoutDeckName();
    if (knockoutDeckName) {
        return {
            warnings,
            events,
            isKO: true,
            knockoutDeckName
        };
    }

    return result;
}

// ─── Legacy corner-break submitCornerBreakSelection (kept for compatibility) ───

export async function submitCornerBreakSelection(roundState, selectedPlayerCardIds) {
    if (!Array.isArray(selectedPlayerCardIds) || selectedPlayerCardIds.length !== 2) {
        throw new Error("Select exactly 2 cards to send to crib.");
    }

    const playerDeck = roundState.decks.player1Deck.deck;
    const playerCards = playerDeck
        .getCards()
        .filter((card) => selectedPlayerCardIds.includes(card.id));

    if (playerCards.length !== 2) {
        throw new Error("Selected cards are not available in your hand.");
    }

    if (!roundState.decks.player1Deck.hasSentToCrib) {
        playerDeck.pass(roundState.decks.cribDeck.deck, playerCards);
        roundState.decks.player1Deck.hasSentToCrib = true;
    }

    if (!roundState.decks.player2Deck.hasSentToCrib) {
        const opponentCards = await roundState.opponentController.selectCardsForCribDiscard(
            roundState.decks.player2Deck.deck.getCards(),
            { cribOwner: roundState.cribOwner }
        );

        if (!opponentCards || opponentCards.length !== 2) {
            throw new Error("Opponent failed to choose crib cards.");
        }

        roundState.decks.player2Deck.deck.pass(roundState.decks.cribDeck.deck, opponentCards);
        roundState.decks.player2Deck.hasSentToCrib = true;
    }

    return getCornerBreakSnapshot(roundState, []);
}
