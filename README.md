# Welcome to the Clubbage!! Game ReadMe File

PRESS to open preview window in VSC with, CTRL+SHIFT+V

## Overview
Clubbage!! is a blend of the card game "Cribbage" with the video game "Mike Tyson's Punch-Out!!".  Instead of taking steps around a track, Players will deal damage to win boxing matches.


1. **Phase: Corner Selection (Red/Blue):** A coin is flipped at the start of a fight to determine which corner a player will get.  If the Player guesses correctly, they will get the red/home corner.  This means they'll start as "dealer" and gets the first crib.

2. **Phase: Corner Break:** Six cards are dealt to each player. Each player discards 2 cards to the crib. The dealer gets the crib.

3. **Phase: Round Start:** Bell Rings. The round starts and a shared top card of the deck is turned up.

4. **Barrage Phase:** Starting with the non-dealer, each player takes turns playing one card at a time, and a display of the cumulative total of the cards played is shown. The total cannot exceed 31.

   If a player cannot play a card without exceeding 31, they make a taunt sound effect and the other player continues to play until they also cannot play or reach 31. The player who plays the last card scores 1 point for "Go" or 2 points for reaching 31.

   Players alternate playing cards until all cards have been played.

   Ways to score points,
   - 2 points to dealer if shared card is a Jack.
   - 2 points to Player that hits 15.
   - 1 point for last card played or 2 points if the total is exactly 31.
   - 2 points for a pair, 6 points for three of a kind, 12 points for four of a kind.
   - 3 points for a run of three, 4 points for a run of four, etc.

5. **Closing the Round Phase:** Players score their hands and their burst/crib. The non-dealer scores first, then the dealer scores.

   Ways to score points,
   - 1 point if the player has a Jack of the same suit as the starter card.
   - 2 points for each sum of 15.
   - 2 points for a pair, 6 points for three of a kind, 12 points for four of a kind.
   - 3 points for a run of three, 4 points for a run of four, etc.
   - 4 points having a flush of four, 5 points for a flush of five.

6. **Phase Round End:** The bell rings (saved by the bell), and players go back to their corners. Goto step 2 above.


## Miscellaneous Game Mechanics

**Attack Animations:** Jab animation for hitting 1-2 points, cross animation for hitting 3-4 points, hook animation for hitting 5-6 points, uppercut animation for hitting 7 or more points. Adjective describing hit should be based on high and low end of damage for the animation.

**Shuffle Animations:** Sorting by suit will turn player's feet to face left. Sorting by value will turn player's feet to face right. Shuffling will make player cock their arms.

**Ask for Advice:** A Player may ask for advice from their trainer on what two cards they should drop into the burst/crib. A Player can only do this once per match.*

**Technical Knock Out:** If a Player gets 3 or more points at one time, the opponent is knocked down.  Three knockdowns on an opponent within one Barrage Phase results in a TKO. Note that TKOs are only alloswed during the Barrage Phase and they are not allowed during the Closing the Round Phase (where only Knock Outs are allowed).

**Knock Out:** If a Player's health drops below zero, they are knocked out.

**Decision Win:** Each match lasts until one Player's hitpoints are depleted, or if a Player is knocked down three times in a one round, or after the fifth round. The "judges" look at the following stats to make a decision,
- Total damage dealt
- Total damage done during Barrage
- Total damage done during Closing the Round
- Total damage done during Bursts

**Ride A Bike:** A training cutscene plays between bouts.  This increases the hitpoints for a user for next match.

**Opponents:** The game has three main opponents to beat to get the belt,
- First match: Grisáceo Sieger (both start with 50 HP)
- Second match: Loquito Carlito (both start with 60 HP)
- Title match: Andre the Uncompliant (both start with 70 HP)

**Punch Drunk Debuff:** An opponent can become "woozy". This is where they might not make the best decisions as they take more and more heavy blows. The "woozy" debuff can increase and will lead to a batter chance that a random decision for an attack is made by the opponent.






# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.



# Animation Flow:

- Game.js triggers on scoring during barrage play (~1055)
  - When player or opponent plays a card: triggerPlayerAnimationFromDamage(pegResult.total) triggerOpponentAnimationFromDamage(pegResult.total) is called
  - Damage mapping: 1–2 pts → jab | 3–4 → cross | 5+ → attack

- State managed in Game.jsx (96, 242–250)
  - activeOpponentAnimation state starts at "idle"
  - triggerPlayerAnimationFromDamage() and triggerOpponentAnimationFromDamage() switches to attack type, auto-reverts to idle after 4.0 seconds
  - handlePlayerAnimationComplete() and handleOpponentAnimationComplete() callback for when non-looping animations finish

- Round.jsx passes to sprite animator (352, 364)
  - Accepts both props and forwards them to PlayerSpriteAnimator and OpponentSpriteAnimator
  - activeAnimation tells the animator which animation def to use

- Animator switches frames (PlayerSpriteAnimator and OpponentSpriteAnimator.jsx)
  - Reads activeAnimation from props
  - Dynamically swaps frame set from config JSON


Todo:

- Add more animations to boxer0x.animations.json, player0x.animations.json, boxer0x.png, and player0x.png. Examples: "lay", "stumble", "taunt", and "victoryPose"
- Use onAnimationComplete callback to chain animations or trigger follow-up events. Example: stumble off-balanced to fall and then to be laying on the mat.



