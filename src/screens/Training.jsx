import { useState } from "react";

function Training({ circuitName, onContinue }) {
    const [scrollY, setScrollY] = useState(0);

    return (
        <section
            className="screen screen-training"
            onScroll={(event) => setScrollY(event.currentTarget.scrollTop)}
        >
            <div
                className="parallax-layer parallax-layer--far"
                style={{ transform: `translateY(${scrollY * 0.2}px)` }}
                aria-hidden="true"
            />
            <div
                className="parallax-layer parallax-layer--mid"
                style={{ transform: `translateY(${scrollY * 0.45}px)` }}
                aria-hidden="true"
            />
            <div
                className="parallax-layer parallax-layer--near"
                style={{ transform: `translateY(${scrollY * 0.7}px)` }}
                aria-hidden="true"
            />

            <article className="training-content">
                <h2>Training Screen</h2>
                <p>Current circuit cleared: {circuitName}</p>
                <p>
                    Hit the roadwork, sharpen your timing, and level up for the next circuit. Scroll
                    this screen to feel the parallax depth.
                </p>
                <div className="training-spacer" aria-hidden="true" />
                <button type="button" className="menu-btn" onClick={onContinue}>
                    Continue to Next Circuit
                </button>
            </article>
        </section>
    );
}

export default Training;
