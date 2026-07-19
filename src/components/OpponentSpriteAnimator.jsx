import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_FRAME = [0, 0, 60, 120];
const DEFAULT_ANIMATION = {
    frames: [DEFAULT_FRAME],
    frameDurations: [250],
    loop: true
};

const toFiniteNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveAxisValue = (value, maxRange, normalizedMode) => {
    const numericValue = toFiniteNumber(value, 0);
    if (!normalizedMode) {
        return numericValue;
    }

    const normalizedValue = Math.min(1, Math.max(0, numericValue));
    return normalizedValue * Math.max(0, maxRange);
};

const getAnimationDefinition = (animationToRun, activeAnimation) => {
    const fallbackName = animationToRun?.defaultAnimation;
    const animationName = activeAnimation || fallbackName;
    const animationDef = animationToRun?.animations?.[animationName] || DEFAULT_ANIMATION;

    return {
        animationName: animationName || "default",
        animationDef
    };
};

const normalizeFrameDurations = (frameDurations, frameCount) => {
    if (!Array.isArray(frameDurations) || frameDurations.length === 0) {
        return Array.from({ length: frameCount }, () => 120);
    }

    return Array.from({ length: frameCount }, (_, index) => {
        const duration = frameDurations[index] ?? frameDurations[frameDurations.length - 1] ?? 120;
        return Math.max(1, Math.round(duration));
    });
};

const getPointAtElapsed = (segments, elapsedMs, fallbackPoint = { x: 0, y: 0 }) => {
    if (!Array.isArray(segments) || segments.length === 0) {
        return fallbackPoint;
    }

    let remainingMs = Math.max(0, elapsedMs);
    for (let i = 0; i < segments.length; i += 1) {
        const segment = segments[i];
        const durationMs = Math.max(1, segment.durationMs);

        if (remainingMs <= durationMs) {
            const t = remainingMs / durationMs;
            return {
                x: segment.from.x + ((segment.to.x - segment.from.x) * t),
                y: segment.from.y + ((segment.to.y - segment.from.y) * t)
            };
        }

        remainingMs -= durationMs;
    }

    return segments[segments.length - 1].to;
};

const buildPathRuntime = ({
    animationDef,
    animationToRun,
    stageWidth,
    stageHeight,
    frameWidth,
    frameHeight,
    sidePadding
}) => {
    const defaultAnchorX = Math.max(sidePadding, Math.round((stageWidth / 2) - (frameWidth / 2)));
    const defaultPoint = { x: defaultAnchorX, y: 0 };

    const animationPathing = animationDef?.pathing;
    const animationPathingDurations = animationDef?.pathingDurations;

    if (Array.isArray(animationPathing) && animationPathing.length > 0) {
        const firstPathingEntry = animationPathing[0];
        const isNormalizedPathing = Boolean(
            animationDef?.pathingNormalized ?? animationToRun?.metadata?.pathingNormalized
        );
        const xRange = Math.max(0, stageWidth - frameWidth);
        const yRange = Math.max(0, stageHeight - frameHeight);
        const segmentDurationList = Array.isArray(animationPathingDurations)
            ? animationPathingDurations.map((duration) => Math.max(1, Math.round(toFiniteNumber(duration, 1000))))
            : [];

        const segments = [];

        if (Array.isArray(firstPathingEntry) && firstPathingEntry.length === 4) {
            for (let i = 0; i < animationPathing.length; i += 1) {
                const [fromX, fromY, toX, toY] = animationPathing[i];
                segments.push({
                    from: {
                        x: resolveAxisValue(fromX, xRange, isNormalizedPathing),
                        y: resolveAxisValue(fromY, yRange, isNormalizedPathing)
                    },
                    to: {
                        x: resolveAxisValue(toX, xRange, isNormalizedPathing),
                        y: resolveAxisValue(toY, yRange, isNormalizedPathing)
                    },
                    durationMs: segmentDurationList[i] ?? segmentDurationList[segmentDurationList.length - 1] ?? 1000
                });
            }
        } else {
            const points = animationPathing
                .filter((point) => Array.isArray(point) && point.length >= 2)
                .map((point) => ({
                    x: resolveAxisValue(point[0], xRange, isNormalizedPathing),
                    y: resolveAxisValue(point[1], yRange, isNormalizedPathing)
                }));

            for (let i = 0; i < points.length - 1; i += 1) {
                segments.push({
                    from: points[i],
                    to: points[i + 1],
                    durationMs: segmentDurationList[i] ?? segmentDurationList[segmentDurationList.length - 1] ?? 1000
                });
            }
        }

        const totalDurationMs = segments.reduce((sum, segment) => sum + segment.durationMs, 0);
        return {
            segments,
            totalDurationMs,
            loopPath: Boolean(animationDef?.loopPath),
            restartDelayMs: Math.max(0, toFiniteNumber(animationDef?.restartDelayMs, 0)),
            fallbackPoint: segments[0]?.from || defaultPoint
        };
    }

    const legacyPath = animationToRun?.pathing?.[0] || null;
    if (legacyPath && Array.isArray(legacyPath.points) && legacyPath.points.length > 1) {
        const speed = Math.max(1, toFiniteNumber(legacyPath.speed, 72));
        const legacyPoints = legacyPath.points.map((point) => ({
            x: toFiniteNumber(point?.x),
            y: toFiniteNumber(point?.y)
        }));

        const segments = [];
        for (let i = 0; i < legacyPoints.length - 1; i += 1) {
            const from = legacyPoints[i];
            const to = legacyPoints[i + 1];
            const distance = Math.hypot(to.x - from.x, to.y - from.y);
            const durationMs = Math.max(1, Math.round((distance / speed) * 1000));
            segments.push({ from, to, durationMs });
        }

        const totalDurationMs = segments.reduce((sum, segment) => sum + segment.durationMs, 0);
        return {
            segments,
            totalDurationMs,
            loopPath: Boolean(legacyPath.loopPath),
            restartDelayMs: Math.max(0, toFiniteNumber(legacyPath.restartDelayMs, 0)),
            fallbackPoint: segments[0]?.from || defaultPoint
        };
    }

    return {
        segments: [],
        totalDurationMs: 0,
        loopPath: false,
        restartDelayMs: 0,
        fallbackPoint: defaultPoint
    };
};

function OpponentSpriteAnimator({
    stageWidth,
    stageHeight,
    animationToRun,
    activeAnimation,
    className,
    floorOffset = 106,
    sidePadding = 24,
    ariaLabel = "Animated opponent sprite",
    onAnimationComplete
}) {
    const [loopCycle, setLoopCycle] = useState(0);
    const onAnimationCompleteRef = useRef(onAnimationComplete);
    const [spriteState, setSpriteState] = useState({
        ready: false,
        x: 0,
        y: 0,
        frame: DEFAULT_FRAME
    });

    useEffect(() => {
        onAnimationCompleteRef.current = onAnimationComplete;
    }, [onAnimationComplete]);

    const spriteRuntime = useMemo(() => {
        if (!animationToRun) {
            return null;
        }

        const { animationName, animationDef } = getAnimationDefinition(animationToRun, activeAnimation);
        const frames = Array.isArray(animationDef?.frames) && animationDef.frames.length > 0
            ? animationDef.frames
            : DEFAULT_ANIMATION.frames;
        const frameDurations = normalizeFrameDurations(animationDef?.frameDurations, frames.length);
        const totalFrameDuration = frameDurations.reduce((sum, duration) => sum + duration, 0);
        const shouldLoopFrames = Boolean(animationDef?.loop);

        const firstFrame = frames[0] ?? DEFAULT_FRAME;
        const frameWidth = firstFrame[2] ?? DEFAULT_FRAME[2];
        const frameHeight = firstFrame[3] ?? DEFAULT_FRAME[3];

        const metadata = animationToRun?.metadata || {};
        const totalWidth = metadata.totalWidth ?? firstFrame[2] ?? 240;
        const totalHeight = metadata.totalHeight ?? firstFrame[3] ?? 120;
        const scale = Number.isFinite(metadata.scale) && metadata.scale > 0 ? metadata.scale : 1;

        const path = buildPathRuntime({
            animationDef,
            animationToRun,
            stageWidth,
            stageHeight,
            frameWidth: frameWidth * scale,
            frameHeight: frameHeight * scale,
            sidePadding
        });

        return {
            animationName,
            frames,
            frameDurations,
            totalFrameDuration,
            shouldLoopFrames,
            path,
            spriteSheet: animationToRun?.spriteSheet,
            metadata: {
                totalWidth,
                totalHeight,
                scale
            }
        };
    }, [activeAnimation, animationToRun, sidePadding, stageHeight, stageWidth]);

    useEffect(() => {
        if (!spriteRuntime || !stageWidth) {
            setSpriteState((previous) => ({
                ...previous,
                ready: false
            }));
            return undefined;
        }

        let animationFrameId = 0;
        let restartTimeoutId = 0;
        let didNotifyComplete = false;
        const startTime = performance.now();

        const {
            frames,
            frameDurations,
            totalFrameDuration,
            shouldLoopFrames,
            path
        } = spriteRuntime;

        const resolveTimeBasedFrame = (elapsedMs) => {
            if (shouldLoopFrames) {
                const wrappedTime = totalFrameDuration > 0 ? elapsedMs % totalFrameDuration : 0;
                let accumulator = 0;
                for (let i = 0; i < frameDurations.length; i += 1) {
                    accumulator += frameDurations[i];
                    if (wrappedTime < accumulator) {
                        return i;
                    }
                }
                return frameDurations.length - 1;
            }

            const cappedTime = Math.min(elapsedMs, totalFrameDuration);
            let accumulator = 0;
            for (let i = 0; i < frameDurations.length; i += 1) {
                accumulator += frameDurations[i];
                if (cappedTime <= accumulator) {
                    return i;
                }
            }
            return frameDurations.length - 1;
        };

        const tick = (now) => {
            const elapsedMs = Math.max(0, now - startTime);
            const pathHasDuration = path.totalDurationMs > 0;
            const pathElapsedMs = pathHasDuration
                ? (path.loopPath && path.restartDelayMs === 0
                    ? elapsedMs % path.totalDurationMs
                    : Math.min(path.totalDurationMs, elapsedMs))
                : 0;

            const currentPoint = pathHasDuration
                ? getPointAtElapsed(path.segments, pathElapsedMs, path.fallbackPoint)
                : path.fallbackPoint;

            const frameIndex = resolveTimeBasedFrame(elapsedMs);

            const selectedFrame = frames[frameIndex] || frames[0] || DEFAULT_FRAME;

            setSpriteState({
                ready: true,
                x: currentPoint.x,
                y: currentPoint.y,
                frame: selectedFrame
            });

            const framesComplete = shouldLoopFrames ? false : elapsedMs >= totalFrameDuration;
            const pathComplete = path.loopPath ? false : (!pathHasDuration || elapsedMs >= path.totalDurationMs);
            const timelineComplete = pathComplete && framesComplete;

            if (
                timelineComplete &&
                !didNotifyComplete &&
                typeof onAnimationCompleteRef.current === "function"
            ) {
                didNotifyComplete = true;
                onAnimationCompleteRef.current({
                    animationName: spriteRuntime.animationName
                });
            }

            const shouldContinueAnimating =
                !timelineComplete ||
                shouldLoopFrames ||
                (path.loopPath && path.restartDelayMs === 0);

            if (shouldContinueAnimating) {
                animationFrameId = window.requestAnimationFrame(tick);
                return;
            }

            if (path.loopPath && path.restartDelayMs > 0) {
                restartTimeoutId = window.setTimeout(() => {
                    setLoopCycle((previous) => previous + 1);
                }, path.restartDelayMs);
            }
        };

        animationFrameId = window.requestAnimationFrame(tick);

        return () => {
            window.cancelAnimationFrame(animationFrameId);
            window.clearTimeout(restartTimeoutId);
        };
    }, [loopCycle, spriteRuntime, stageWidth]);

    if (!spriteState.ready || !spriteRuntime?.spriteSheet) {
        return null;
    }

    const [frameX, frameY, frameWidth, frameHeight] = spriteState.frame;
    const scale = spriteRuntime.metadata.scale;

    return (
        <div
            className={`barrage-opponent-sprite ${className || ""}`.trim()}
            style={{
                "--barrage-opponent-sprite-x": `${spriteState.x}px`,
                "--barrage-opponent-sprite-y": `${floorOffset + spriteState.y}px`
            }}
        >
            <div
                className="barrage-opponent-sprite__viewport"
                role="img"
                aria-label={ariaLabel}
                style={{
                    width: `${frameWidth * scale}px`,
                    height: `${frameHeight * scale}px`
                }}
            >
                <div
                    className="barrage-opponent-sprite__sheet"
                    style={{
                        width: `${spriteRuntime.metadata.totalWidth * scale}px`,
                        height: `${spriteRuntime.metadata.totalHeight * scale}px`,
                        backgroundImage: `url(${spriteRuntime.spriteSheet})`,
                        backgroundSize: `${spriteRuntime.metadata.totalWidth * scale}px ${spriteRuntime.metadata.totalHeight * scale}px`,
                        backgroundPosition: `${-frameX * scale}px ${-frameY * scale}px`
                    }}
                />
            </div>
        </div>
    );
}

export default OpponentSpriteAnimator;
