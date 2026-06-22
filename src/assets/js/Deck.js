class Deck {

    // The order of the suits and ranks arrays defines both iteration and sort order.
    constructor(id, maxSize = 52, suits = ['hearts', 'diamonds', 'clubs', 'spades'], ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']) {
        this.id = id;
        this.cards = [];
        this.maxSize = maxSize;
        this.suits = [...suits]; // Create copy of the suits array to prevent external mutation.
        this.ranks = [...ranks]; // Create copy of the ranks array to prevent external mutation.

        // create a suitOrder object that maps each suit to its index in the suits array. IE: { hearts: 0, diamonds: 1, clubs: 2, spades: 3 }
        this.suitOrder = {};
        this.suits.forEach((suit, index) => {
            this.suitOrder[suit] = index;
        });

        // create a rankOrder object that maps each rank to its index in the ranks array. IE: { A: 0, '2': 1, '3': 2, ..., J: 10, Q: 11, K: 12 }
        this.rankOrder = {};
        this.ranks.forEach((rank, index) => {
            this.rankOrder[rank] = index;
        });
    }

    getCardCount() {
        return this.cards.length;
    }

    isFull() {
        return this.getCardCount() >= this.maxSize;
    }

    addCard(card) {
        if (this.isFull()) {
            console.warn(`Cannot add card to deck ${this.id}. Deck is full (${this.getCardCount()}/${this.maxSize})`);
            return false;
        }
        this.cards.push(card);
        return true;
    }

    // helper function to remove a card from this deck and add it to a target deck.
    removeCard(card, targetDeck) {
        const cardIndex = this.cards.findIndex(c => c.id === card.id);

        if (cardIndex === -1) {
            console.warn(`Card ${card.id} not found in deck ${this.id}`);
            return false;
        }

        if (targetDeck.isFull()) {
            console.warn(`Cannot move card to target deck ${targetDeck.id}. Target deck is full (${targetDeck.getCardCount()}/${targetDeck.maxSize})`);
            return false;
        }

        const removedCard = this.cards.splice(cardIndex, 1)[0];
        targetDeck.addCard(removedCard);
        return true;
    }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {                    // start i at the last index of the cards array and work its way down to 1 (which may swap with 0).
            const j = Math.floor(Math.random() * (i + 1));                   // generate j; a random number from 0 to i.
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]]; // swap the card at index i with j and the card at index j with i.
        }
    }

    // sort the deck by suit, value, or by suit and value.
    sort(sortType = 'suit-value') {
        switch (sortType.toLowerCase()) {
            case 'suit':
                this.cards.sort((a, b) => this.suitOrder[a.suit] - this.suitOrder[b.suit]);
                break;
            case 'value':
                this.cards.sort((a, b) => this.rankOrder[a.rank] - this.rankOrder[b.rank]);
                break;
            case 'suit-value': default:
                this.cards.sort((a, b) => {
                    const suitDiff = this.suitOrder[a.suit] - this.suitOrder[b.suit];
                    if (suitDiff !== 0) {
                        return suitDiff;
                    }
                    return this.rankOrder[a.rank] - this.rankOrder[b.rank];
                });
                break;
        }
    }

    pass(targetDeck, cards) {
        for (const card of cards) {
            if (!this.removeCard(card, targetDeck)) {
                console.warn(`Failed to pass card ${card.id} from deck ${this.id} to deck ${targetDeck.id}`);
                return false;
            } else {
                console.log(`Passed card ${card.id} from deck ${this.id} to deck ${targetDeck.id}`);
            }
        }
        return true;
    }

    // Deal a total number of cards to a list of target decks.
    // decks: array of target Deck objects to deal to.
    // total: array of numbers (of cards to deal) to each target deck.
    // location: where to deal from, either 'top' or 'bottom'.
    // EXAMPLE: deal 3 cards to deck1, 2 cards to deck2, and 1 card to deck3 from the top of the deck: deal([deck1, deck2, deck3], [3, 2, 1], 'top');
    deal(decks, total = [1], location = 'top') {
        // check that the decks length is the same as the total length, and provide a warning if it is not and quit out.
        if (decks.length !== total.length) {
            console.warn('Length of total array must match length of decks array.');
            return false;
        }
        // get the sum of the numbers found in the total array, then check if the deck has enough cards to deal, and provide a warning if it does not and quit out.
        let totalCardsToDeal = total.reduce((sum, b) => sum + b, 0);
        if (this.getCardCount() < totalCardsToDeal) {
            console.warn(`Cannot deal cards. Not enough cards in deck to deal ${totalCardsToDeal} cards.`);
            return false;
        }
        // find the highest total count to deal to any single deck, so we know how many rounds of dealing we need to do.
        const maxRounds = Math.max(...total);
        // loop through rounds of dealing a card to each deck until all decks have received their target number of cards.
        for(let round = 0; round < maxRounds; round++) {
            // loop through each target deck and deal one card to it if it has not yet received its target number of cards.
            for (let i = 0; i < decks.length; i++) {
                // Skip if this deck has already received its target number of cards.
                if (round >= total[i]) {
                    continue;
                }
                let cardToDeal = (location === 'bottom') ? this.cards[0] : this.cards[this.cards.length - 1];
                if (!this.removeCard(cardToDeal, decks[i])) {
                    return false;
                }
            }
        }
        return true;
    }

    getCards() {
        return this.cards;
    }

    clear() {
        this.cards = [];
    }
}

export { Deck };