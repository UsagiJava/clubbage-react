import { useEffect, useState } from "react";
import logoClubbage from "../assets/images/logo_clubbage.png";

function Home({ onNewGame, onContinue, statusText, useAIOpponent, onToggleAIOpponent }) {
    const [showCredits, setShowCredits] = useState(false);
    const [showContinueInput, setShowContinueInput] = useState(false);
    const [passcode, setPasscode] = useState("");
    const [errorText, setErrorText] = useState("");

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowCredits(true);
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    const handleContinue = () => {
        const isAllowed = onContinue(passcode.trim());

        if (!isAllowed) {
            setErrorText("Incorrect passcode. Hint: 1122");
            return;
        }

        setErrorText("");
    };

    return (
        <section className="screen screen-home">
            <div className={`text-center home-hero ${showCredits ? "home-hero--shifted" : ""}`}>
                <img src={logoClubbage} className="mb-5" alt="Clubbage!!"/>
                <p className="logo-tagline mb-5">Cards. Corners. Chaos.</p>

                <button type="button" className="me-1 menu-btn" onClick={onNewGame}>
                    New Game
                </button>

                <button type="button" className="ms-1 menu-btn menu-btn--secondary"
                    onClick={() => setShowContinueInput((prev) => !prev)}
                >
                    Continue
                </button>

                {showContinueInput && (
                    <div className="continue-panel">
                        <div className="input-group">
                            <input id="continue-passcode" type="text" className="form-control" maxLength={4} placeholder="Enter 4-digit passcode:"
                                aria-label="Enter 4-digit passcode:" aria-describedby="button-addon2"
                                value={passcode} onChange={(event) => setPasscode(event.target.value)} />
                            <button className="menu-btn--tertiary" type="button" onClick={handleContinue}>Enter Corner</button>
                        </div>
                        {errorText ? <p className="home-error mb-0 mt-3">{errorText}</p> : null}
                    </div>
                )}

                    <div className="form-check form-switch d-none">
                        <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="switchAIOpponent"
                            checked={useAIOpponent}
                            onChange={(event) => onToggleAIOpponent(event.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="switchAIOpponent">Spar with a Bot</label>
                    </div>

                <p className="score-line mt-3">{statusText}</p>


                <article className="home-credits text-start">
                    <h2>The Undercard Story</h2>
                    <p>
                        Deal with and discard a cast of challengers, as you work your way from the undercard to the main event.<br/>
                        Each victory brings you closer to claim the title of, "World Card-Fighter Champion".
                    </p>
                    <h3>Credits</h3>
                    <p>Created by: Delugeonal</p>
                </article>

            </div>
        </section>
    );
}

export default Home;
