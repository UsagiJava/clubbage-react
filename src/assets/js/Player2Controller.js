/**
 * Base class for controlling Player 2 actions.
 * Subclasses can implement human interaction or AI logic.
 */
class Player2Controller {
    /**
     * Select cards to discard to the crib during the corner break phase.
     * @param {Card[]} hand - The player's current hand (6 cards)
     * @param {Object} context - Game context (unused in base, available for subclasses)
     * @returns {Promise<Card[]>} - Array of exactly 2 cards to discard
     */
    async selectCardsForCribDiscard(hand, context) {
        throw new Error('selectCardsForCribDiscard must be implemented by subclass');
    }

    /**
     * Select a card to play during the barrage phase.
     * @param {Card[]} hand - The player's current hand
     * @param {Card[]} validCards - Cards that can be legally played (won't exceed 31)
     * @param {Object} context - Game context with pegCount, pegSequence, etc.
     * @returns {Promise<Card>} - The card to play
     */
    async selectCardToPlay(hand, validCards, context) {
        throw new Error('selectCardToPlay must be implemented by subclass');
    }
}

/**
 * Human player controller - waits for UI interactions.
 */
class HumanPlayer2Controller extends Player2Controller {
    constructor() {
        super();
        this.selectedCards = [];
        this.selectionPromiseResolve = null;
        this.selectionPromiseReject = null;
        this.maxSelectableCards = 1;
    }

    /**
     * Set up event listener for the send button and card clicks.
     * This is called once per phase and resolved when the player sends cards.
     */
    waitForCardSelection(maxCards) {
        return new Promise((resolve, reject) => {
            this.selectedCards = [];
            this.selectionPromiseResolve = resolve;
            this.selectionPromiseReject = reject;
            this.maxSelectableCards = maxCards;
        });
    }

    /**
     * Called by the UI when cards are selected and sent.
     * Passes the selected card objects to the waiting promise.
     */
    resolveCardSelection(cardObjects) {
        if (this.selectionPromiseResolve) {
            this.selectionPromiseResolve(cardObjects);
            this.selectionPromiseResolve = null;
            this.selectionPromiseReject = null;
        }
    }

    /**
     * Called by the UI if selection is cancelled.
     */
    rejectCardSelection(reason) {
        if (this.selectionPromiseReject) {
            this.selectionPromiseReject(new Error(reason));
            this.selectionPromiseReject = null;
            this.selectionPromiseResolve = null;
        }
    }

    async selectCardsForCribDiscard(hand, context) {
        return this.waitForCardSelection(2);
    }

    async selectCardToPlay(hand, validCards, context) {
        return this.waitForCardSelection(1).then(cards => cards[0]);
    }
}

export { Player2Controller, HumanPlayer2Controller };
