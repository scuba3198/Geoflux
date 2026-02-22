import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { useEffect, useRef, useState } from "react";
import type { HandVector } from "../types";

export type TrackingState = "IDLE" | "INITIALIZING" | "TRACKING" | "ERROR";

const VERSION = "1.2.2 - FORCE RELOAD"; // Unique string to verify update

interface UseHandTrackingProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasWidth: number;
    canvasHeight: number;
    enabled: boolean;
    minDetectionConfidence?: number;
}

export function useHandTracking({
    videoRef,
    canvasWidth,
    canvasHeight,
    enabled,
    minDetectionConfidence = 0.3,
}: UseHandTrackingProps) {
    const [state, setState] = useState<TrackingState>("IDLE");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [handCount, setHandCount] = useState(0);

    const handsRef = useRef<HandVector[]>([]);
    const rawHandsRef = useRef<any[]>([]);
    const landmarkerRef = useRef<HandLandmarker | null>(null);
    const requestRef = useRef<number>();
    const lastVideoTimeRef = useRef<number>(-1);
    const isMountedRef = useRef(false);
    const trackingStateRef = useRef<TrackingState>("IDLE");

    useEffect(() => {
        trackingStateRef.current = state;
    }, [state]);

    useEffect(() => {
        isMountedRef.current = true;
        console.log(`Geoflux: HandTracking Hook Loaded (v${VERSION})`);
        return () => { isMountedRef.current = false; };
    }, []);

    const dimsRef = useRef({ w: canvasWidth, h: canvasHeight });
    useEffect(() => {
        dimsRef.current = { w: canvasWidth, h: canvasHeight };
    }, [canvasWidth, canvasHeight]);

    const prevPositionsRef = useRef<Map<number, { x: number; y: number; time: number }>>(new Map());

    useEffect(() => {
        const stopCamera = () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(t => t.stop());
                videoRef.current.srcObject = null;
            }
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };

        const predictLoop = () => {
            const video = videoRef.current;
            const landmarker = landmarkerRef.current;
            if (!video || !landmarker || !isMountedRef.current || trackingStateRef.current === "ERROR") return;

            const now = performance.now();

            if (video.currentTime !== lastVideoTimeRef.current && video.readyState >= 2) {
                lastVideoTimeRef.current = video.currentTime;

                // Fallback to performance.now if currentTime is stuck at 0
                const timestampMs = video.currentTime > 0 ? video.currentTime * 1000 : now;
                const results = landmarker.detectForVideo(video, timestampMs);

                const newHands: HandVector[] = [];
                const newRaw: any[] = [];
                const { w, h } = dimsRef.current;

                if (results.landmarks && results.landmarks.length > 0) {
                    results.landmarks.forEach((landmarks, index) => {
                        newRaw.push(landmarks);
                        const tip = landmarks[8];
                        if (!tip) return;

                        const x = (1 - tip.x) * w;
                        const y = tip.y * h;

                        const prev = prevPositionsRef.current.get(index);
                        let vx = 0, vy = 0;
                        if (prev) {
                            const dt = Math.max(1, now - prev.time);
                            vx = (x - prev.x) / dt;
                            vy = (y - prev.y) / dt;
                        }

                        prevPositionsRef.current.set(index, { x, y, time: now });

                        const maxV = 2000;
                        vx = Math.max(-maxV, Math.min(maxV, vx));
                        vy = Math.max(-maxV, Math.min(maxV, vy));

                        newHands.push({ x, y, vx, vy, active: true, timestamp: now });
                    });
                } else {
                    prevPositionsRef.current.clear();
                }

                if (Math.floor(now / 2000) !== Math.floor((now - 16) / 2000)) {
                    if (newHands.length > 0) console.log(`Geoflux: v${VERSION} detected ${newHands.length} hands`);
                    else if (enabled) console.warn(`Geoflux: v${VERSION} seeing 0 hands. Conf: ${minDetectionConfidence}`);
                }

                if (newHands.length !== handCount) {
                    setHandCount(newHands.length);
                }

                handsRef.current = newHands;
                rawHandsRef.current = newRaw;
            }

            requestRef.current = requestAnimationFrame(predictLoop);
        };

        if (!enabled) {
            setState("IDLE");
            handsRef.current = [];
            rawHandsRef.current = [];
            stopCamera();
            return;
        }

        async function init() {
            try {
                setState("INITIALIZING");
                console.log(`Geoflux: Initializing MediaPipe (v${VERSION})...`);

                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
                ).catch(() => FilesetResolver.forVisionTasks("https://www.gstatic.com/mediapipe/solutions/hands/wasm"));

                const landmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                        // delegate: "GPU" // Removed for better compatibility
                    },
                    runningMode: "VIDEO",
                    numHands: 2,
                    minHandDetectionConfidence: minDetectionConfidence,
                    minHandPresenceConfidence: minDetectionConfidence,
                    minTrackingConfidence: minDetectionConfidence
                });

                if (!isMountedRef.current) {
                    landmarker.close();
                    return;
                }
                landmarkerRef.current = landmarker;

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480, facingMode: "user" },
                });

                if (!isMountedRef.current) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadeddata = async () => {
                        if (!isMountedRef.current) return;
                        try {
                            await videoRef.current?.play();
                            setState("TRACKING");
                            console.log(`🚀 GEOF-TRACK-122: ACTIVE`);
                            predictLoop();
                        } catch (e) {
                            console.error("Geoflux: Video play failed", e);
                        }
                    };
                }
            } catch (err: any) {
                console.error("Geoflux Tracking Error:", err);
                if (isMountedRef.current) {
                    setState("ERROR");
                    setErrorMsg(err.message || "Camera or Model failure.");
                }
            }
        }

        init();

        return () => {
            stopCamera();
            if (landmarkerRef.current) {
                landmarkerRef.current.close();
                landmarkerRef.current = null;
            }
        };
    }, [enabled, minDetectionConfidence]);

    return {
        state,
        errorMsg,
        handsRef,
        rawHandsRef,
        hasHands: handCount > 0
    };
}
