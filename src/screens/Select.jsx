import { BOXERS } from "../data/boxers";

function Select({ onChooseBoxer }) {
    return (
        <section className="screen screen-select">
            <h2>Choose Your Boxer</h2>
            <p>Select your fighter for this career run.</p>

            <div className="select-grid">
                <button
                    type="button"
                    className="fighter-card fighter-card--male"
                    onClick={() => onChooseBoxer("male")}
                >
                    <div className="fighter-card__content">
                        <span className="fighter-card__name">{BOXERS.male.name}</span>
                        <span className="fighter-card__style">Male • {BOXERS.male.description}</span>
                    </div>
                </button>

                <button
                    type="button"
                    className="fighter-card fighter-card--female"
                    disabled
                    onClick={() => onChooseBoxer("female")}
                >
                    <div className="fighter-card__content">
                        <span className="fighter-card__name">{BOXERS.female.name}</span>
                        <span className="fighter-card__style">Female • {BOXERS.female.description}</span>
                    </div>
                </button>
            </div>
        </section>
    );
}

export default Select;
