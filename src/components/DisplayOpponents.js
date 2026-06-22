function DisplayOpponents(props) {
    const decodeHtmlEntities = (text = "") => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        return doc.documentElement.textContent || "";
    };

    return (
        <li key={props.circuit.id}>{props.circuit.name}
            <ol>
                {props.circuit.opponents.map((opponent) => (
                    <li key={opponent.id}>{decodeHtmlEntities(opponent.name)} ({opponent.ethnicity})
                        <ul>
                            <li>Rank: {opponent.rank}</li>
                            <li>Hitpoints: {opponent.hp}</li>
                            <li>From: {opponent.from}</li>
                            <li>Age: {opponent.age}</li>
                            <li>Weight: {opponent.weight}</li>
                            <li>Favorite Food: {opponent.food}</li>
                            <li>Record: {opponent.wins}-{opponent.losses}, {opponent.kos}KOs/{opponent.tkos}TKOs</li>
                            {opponent.sayings && opponent.sayings.length > 0 && (
                                <li>Sayings:
                                    <ul>
                                        {opponent.sayings.map((saying, index) => (
                                            <li key={index}>{decodeHtmlEntities(saying)}</li>
                                        ))}
                                    </ul>
                                </li>
                            )}
                        </ul>
                    </li>
                ))}
            </ol>
        </li>

    )
}
export default DisplayOpponents;