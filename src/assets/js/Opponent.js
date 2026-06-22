import { Player2Controller } from './Player2Controller.js';

/**
 * AI opponent that makes strategic cribbage decisions.
 * The "incompetence" stat (0-100) determines how often random moves are made.
 * 0 = always optimal, 100 = always random
 */
class Opponent extends Player2Controller {
    constructor(incompetence = 50) {
        super();
        // Clamp incompetence between 0 and 100
        this.incompetence = Math.max(0, Math.min(100, incompetence));
        this.name = 'Opponent';
    }

    /**
     * Decide whether to use smart logic or random selection based on incompetence stat.
     */
    useRandomLogic() {
        return Math.random() * 100 < this.incompetence;
    }

    /**
     * Get the peg value of a card (face value, with face cards worth 10).
     */
    getPegValue(card) {
        if (!card) return 0;
        if (card.rank === 'A') return 1;
        if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
        const numValue = parseInt(card.rank);
        return isNaN(numValue) ? 10 : numValue;
    }

    /**
     * For corner break phase: select 2 cards to discard to crib.
     * Strategy: discard cards that are least likely to score well as a hand.
     */
    async selectCardsForCribDiscard(hand, context) {
        if (this.useRandomLogic()) {
            return this.selectRandomCards(hand, 2);
        }

        // Smart strategy: keep cards that pair well, avoid scattered values
        const cardsToDiscard = this.selectOptimalCribDiscard(hand);
        return cardsToDiscard;
    }

    /**
     * For barrage phase: select 1 card to play.
     * Strategy: prefer cards that maximize peg points, avoid busting, think ahead.
     */
    async selectCardToPlay(hand, validCards, context) {
        if (this.useRandomLogic()) {
            const randomIndex = Math.floor(Math.random() * validCards.length);
            return validCards[randomIndex];
        }

        // Smart strategy: prioritize good scoring opportunities
        return this.selectOptimalBarrageCard(hand, validCards, context);
    }

    /**
     * Select random cards from hand (used when incompetence triggers randomness).
     */
    selectRandomCards(hand, count) {
        const shuffled = [...hand].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, count);
    }

    /**
     * Smart crib discard strategy: keep 4 cards that score well, discard the worst 2.
     */
    selectOptimalCribDiscard(hand) {
        // A simple heuristic: prefer keeping pairs, runs, and 15-makers
        // Discard the 2 cards that contribute least to potential hands
        const scores = hand.map((card, index) => {
            let score = 0;

            // Reward pairs (same rank)
            const pairCount = hand.filter(c => c.rank === card.rank).length;
            if (pairCount > 1) score += 10 * (pairCount - 1);

            // Reward 5s (many cards make 15 with 5)
            if (card.rank === '5') score += 8;

            // Reward face cards (can make 15 easily)
            if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') score += 3;

            // Reward mid-range cards (good for runs)
            const pegVal = this.getPegValue(card);
            if (pegVal >= 3 && pegVal <= 8) score += 2;

            return { card, score, index };
        });

        // Sort by score (ascending) and discard the 2 lowest scoring cards
        const sorted = scores.sort((a, b) => a.score - b.score);
        return [sorted[0].card, sorted[1].card];
    }

    /**
     * Smart barrage card selection strategy.
     * If it can hit 31, play that card.
     * Otherwise, if it can make 15, play that card.
     * Otherwise, prefer a card that leaves the running total in the 10 to 20 range.
     * Otherwise, play the lowest-value legal card.
     */
    selectOptimalBarrageCard(hand, validCards, context) {
        const pegCount = context?.pegCount ?? 0;

        // Prefer cards that hit 31 if possible
        const thirtyOneCards = validCards.filter(c =>
            pegCount + this.getPegValue(c) === 31
        );
        if (thirtyOneCards.length > 0) {
            return thirtyOneCards[0];
        }

        // Prefer cards that make 15 (1 point) if available
        const fifteenCards = validCards.filter(c =>
            pegCount + this.getPegValue(c) === 15
        );
        if (fifteenCards.length > 0) {
            return fifteenCards[0];
        }

        // Avoid playing cards that leave opponent in a strong position
        // (e.g., cards that get close to 31 with few peg values left)
        const defensiveCards = validCards.filter(c => {
            const newPegCount = pegCount + this.getPegValue(c);
            return newPegCount >= 10 && newPegCount <= 20; // mid-range is safer
        });

        if (defensiveCards.length > 0) {
            return defensiveCards[0];
        }

        // Fallback: play the lowest peg value card to stay safe
        return validCards.reduce((best, card) =>
            this.getPegValue(card) < this.getPegValue(best) ? card : best
        );
    }
}

export { Opponent };