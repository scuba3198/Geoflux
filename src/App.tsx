import { Download, Settings, X, Hand } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Particle } from "./Particle";
import type { Dimensions, ParticleParams } from "./types";
import { useHandTracking } from "./hooks/useHandTracking";

const App = () => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [particles, setParticles] = useState<Particle[]>([]);
	const [showControls, setShowControls] = useState<boolean>(false);
	const [params, setParams] = useState<ParticleParams>({
		speed: 50, // 0 - 100
		gravity: 0, // 0 - 100
		density: 50, // 10 - 200 (number of particles)
		colorSpeed: 20, // 0 - 100 (hue cycle speed)
		range: 40, // 20 - 150 (connection distance)
		baseHue: 180, // 0 - 360
		handForce: 50, // 0 - 100 (camera wind force)
	});
	const [dims, setDims] = useState<Dimensions>({
		w: window.innerWidth,
		h: window.innerHeight,
	});

	// Store previous dimensions to calculate scale factor
	// Initialize with current window size
	const prevDimsRef = useRef<Dimensions>({
		w: window.innerWidth,
		h: window.innerHeight,
	});

	// Refs for animation loop to avoid restarts
	const paramsRef = useRef<ParticleParams>(params);
	const particlesRef = useRef<Particle[]>(particles);
	const timeRef = useRef<number>(0); // Persistent time across re-renders

	const videoRef = useRef<HTMLVideoElement>(null);
	const pipCanvasRef = useRef<HTMLCanvasElement>(null);
	const [trackingEnabled, setTrackingEnabled] = useState(false);
	const [simulateHand, setSimulateHand] = useState(false);
	const [trackingSensitivity, setTrackingSensitivity] = useState(30);

	const trackingEnabledRef = useRef(trackingEnabled);
	const simulateHandRef = useRef(simulateHand);

	const { state: trackingState, handsRef, rawHandsRef, hasHands } = useHandTracking({
		videoRef,
		canvasWidth: dims.w,
		canvasHeight: dims.h,
		enabled: trackingEnabled,
		minDetectionConfidence: trackingSensitivity / 100
	});

	// Initialize & Manage Particles (Non-destructive)
	useEffect(() => {
		const targetCount = Math.floor((params.density / 100) * 150) + 20;

		setParticles((prevParticles) => {
			const currentCount = prevParticles.length;

			if (currentCount === targetCount) return prevParticles;

			// Clone array to avoid mutation
			let updated = [...prevParticles];

			if (currentCount < targetCount) {
				// Add new particles
				const toAdd = targetCount - currentCount;
				for (let i = 0; i < toAdd; i++) {
					const newId = Date.now() + i; // Simple unique ID
					updated.push(new Particle(dims.w, dims.h, newId));
				}
			} else {
				// Remove excess particles (from the end)
				updated = updated.slice(0, targetCount);
			}
			return updated;
		});
	}, [params.density, dims]); // Keep dims dependent so NEW particles spawn in view, but array isn't reset

	// Handle Resize (High DPI Support)
	useEffect(() => {
		const handleResize = () => {
			const dpr = window.devicePixelRatio || 1;
			const newW = window.innerWidth;
			const newH = window.innerHeight;

			// Get last known legitimate dimensions
			const oldW = prevDimsRef.current.w;
			const oldH = prevDimsRef.current.h;

			// Update ref immediately for next time
			prevDimsRef.current = { w: newW, h: newH };

			if (canvasRef.current) {
				// Relocate particles based on EXPLICIT old vs new dimensions
				// This decoupling prevents race conditions with DOM state
				if (oldW > 0 && oldH > 0 && particlesRef.current.length > 0) {
					particlesRef.current.forEach((p) =>
						p.relocate(newW, newH, oldW, oldH),
					);
				}

				// Set logic size (CSS pixels)
				canvasRef.current.style.width = `${newW}px`;
				canvasRef.current.style.height = `${newH}px`;

				// Set physical size (Actual pixels)
				canvasRef.current.width = newW * dpr;
				canvasRef.current.height = newH * dpr;

				// Scale context to match
				const ctx = canvasRef.current.getContext("2d");
				if (ctx) {
					ctx.scale(dpr, dpr);
				}
			}

			setDims({ w: newW, h: newH });
		};
		handleResize(); // Call once on mount

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	// Update refs when state changes
	useEffect(() => {
		paramsRef.current = params;
	}, [params]);

	useEffect(() => {
		particlesRef.current = particles;
	}, [particles]);

	useEffect(() => {
		trackingEnabledRef.current = trackingEnabled;
	}, [trackingEnabled]);

	useEffect(() => {
		simulateHandRef.current = simulateHand;
	}, [simulateHand]);

	// Main Animation Loop
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		let animationFrameId: number;

		const render = () => {
			timeRef.current += 1; // Increment persistent time
			const time = timeRef.current;

			// Use current ref values
			const currentParams = paramsRef.current;
			const currentParticles = particlesRef.current;
			const { w, h } = dims;

			ctx.fillStyle = "rgba(0, 0, 0, 0.2)"; // Adjust alpha for trail length
			ctx.fillRect(0, 0, w, h);

			// Calculate Global Color
			// Slowly rotate hue based on time and param
			const hueShift =
				time * (currentParams.colorSpeed / 50) + currentParams.baseHue;

			// Update and Draw Particles
			let currentHands = handsRef ? [...handsRef.current] : [];

			// Inject simulated hand if enabled
			if (simulateHandRef.current) {
				const orbit = time * 0.05;
				currentHands.push({
					x: w / 2 + Math.cos(orbit) * (w / 4),
					y: h / 2 + Math.sin(orbit) * (h / 4),
					vx: -Math.sin(orbit) * 2,
					vy: Math.cos(orbit) * 2,
					active: true,
					timestamp: Date.now()
				});
			}

			currentParticles.forEach((p) => {
				p.update(w, h, currentParams, time, currentHands);

				// Draw Point
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
				ctx.fillStyle = `hsl(${hueShift + p.x * 0.1}, 70%, 60%)`;
				ctx.fill();
			});

			// Draw Connections (Plexus Effect)

			const connectDistance = currentParams.range * 3; // Scale range up for pixels

			ctx.lineWidth = 0.5;

			for (let i = 0; i < currentParticles.length; i++) {
				for (let j = i + 1; j < currentParticles.length; j++) {
					const p1 = currentParticles[i];
					const p2 = currentParticles[j];

					if (!p1 || !p2) continue;

					const dx = p1.x - p2.x;
					const dy = p1.y - p2.y;
					const dist = Math.sqrt(dx * dx + dy * dy);

					if (dist < connectDistance) {
						// Calculate opacity based on distance
						const opacity = 1 - dist / connectDistance;

						ctx.beginPath();
						ctx.strokeStyle = `hsla(${hueShift}, 80%, 50%, ${opacity})`;
						ctx.moveTo(p1.x, p1.y);
						ctx.lineTo(p2.x, p2.y);
						ctx.stroke();
					}
				}
			}

			// Draw Debug Hand Points (Circles where the tracking logic thinks hands are)
			if (trackingEnabledRef.current && currentHands.length > 0) {
				currentHands.forEach(hand => {
					if (!hand.active) return;
					ctx.beginPath();
					ctx.arc(hand.x, hand.y, 10, 0, Math.PI * 2);
					ctx.strokeStyle = "rgba(0, 255, 255, 0.8)";
					ctx.lineWidth = 2;
					ctx.stroke();

					// Directional indicator
					ctx.beginPath();
					ctx.moveTo(hand.x, hand.y);
					ctx.lineTo(hand.x + hand.vx * 50, hand.y + hand.vy * 50);
					ctx.strokeStyle = "rgba(0, 255, 255, 0.4)";
					ctx.stroke();
				});
			}

			// Draw Landmarks on PIP canvas for visual debugging
			if (pipCanvasRef.current && rawHandsRef?.current && trackingEnabledRef.current) {
				const pipCtx = pipCanvasRef.current.getContext('2d');
				if (pipCtx) {
					pipCtx.clearRect(0, 0, pipCanvasRef.current.width, pipCanvasRef.current.height);
					rawHandsRef.current.forEach((landmarks: any) => {
						pipCtx.fillStyle = "#00ffff";
						landmarks.forEach((lm: any) => {
							// In PIP video is mirrored visually via CSS scale-x-[-1]
							// Landmarks from MediaPipe are already correctly aligned with the video's contents
							// If we draw on a non-mirrored canvas over a mirrored video, we need to match.
							// But the canvas itself is NOT mirrored via CSS.
							// So we mirror the drawing.
							const px = (1 - lm.x) * pipCanvasRef.current!.width;
							const py = lm.y * pipCanvasRef.current!.height;
							pipCtx.beginPath();
							pipCtx.arc(px, py, 2, 0, Math.PI * 2);
							pipCtx.fill();
						});
					});
				}
			}

			animationFrameId = requestAnimationFrame(render);
		};

		render();

		return () => cancelAnimationFrame(animationFrameId);
	}, [dims]); // Only restart if canvas dimensions change significantly

	// Handlers
	const handleParamChange = (key: keyof ParticleParams, value: string) => {
		setParams((prev) => ({ ...prev, [key]: parseFloat(value) }));
	};

	const downloadWallpaper = () => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		// Create a temporary link
		const link = document.createElement("a");
		// High quality output
		link.download = `geoflux-art-${Date.now()}.png`;
		link.href = canvas.toDataURL("image/png", 1.0);
		link.click();
	};

	const toggleControls = () => setShowControls(!showControls);

	return (
		<div className="relative w-full h-screen h-[100svh] overflow-hidden bg-black">
			{/* The Canvas */}
			<main className="absolute top-0 left-0 w-full h-full pointer-events-none">
				<canvas ref={canvasRef} className="block w-full h-full" />
			</main>

			{/* Header / Brand */}
			<header className="absolute top-6 left-6 select-none z-10">
				<button
					type="button"
					onClick={() => window.location.reload()}
					className="text-left active:scale-95 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded-lg p-1"
				>
					<h1 className="text-2xl sm:text-3xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 opacity-80">
						GEOFLUX
					</h1>
					<p className="text-[10px] sm:text-xs text-gray-400 tracking-widest uppercase mt-1">
						Generative Sandbox
					</p>
				</button>
			</header>

			{/* Credit - Subtle watermark in bottom left */}
			<footer className="absolute left-6 pointer-events-none select-none z-10 bottom-[max(8rem,calc(env(safe-area-inset-bottom)+3rem))] sm:bottom-[max(2rem,env(safe-area-inset-bottom))]">
				<p className="text-[10px] text-white/80 tracking-[0.2em] font-medium uppercase drop-shadow-md">
					by Mumukshu D.C
				</p>
			</footer>

			{/* Toggle Button (Visible when controls hidden) */}
			{!showControls && (
				<button
					type="button"
					onClick={toggleControls}
					aria-label="Open controls"
					className="absolute right-6 p-3 rounded-full glass-panel hover:bg-white/10 transition-all z-30 text-white top-[max(1.5rem,env(safe-area-inset-top))] sm:top-auto sm:bottom-[max(2rem,env(safe-area-inset-bottom))]"
				>
					<Settings />
				</button>
			)}

			{/* PIP WebCam Overlay (Mirrored visual) - Moved to left to avoid overlap */}
			<div className={`absolute bottom-[max(2rem,env(safe-area-inset-bottom))] left-6 z-10 w-48 h-36 bg-black/60 overflow-hidden rounded-xl border border-white/20 glass-panel shadow-2xl transition-all duration-300 ${trackingEnabled ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}>
				<video ref={videoRef} className="w-full h-full object-cover scale-x-[-1] opacity-90" autoPlay playsInline muted />
				<canvas
					ref={pipCanvasRef}
					width={192}
					height={144}
					className="absolute inset-0 w-full h-full pointer-events-none"
				/>
				<div className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-bold bg-black/60 px-2 py-1 rounded text-white flex items-center gap-1">
					<span className={`w-2 h-2 rounded-full ${trackingState === 'TRACKING' ? 'bg-green-500 animate-pulse' : trackingState === 'ERROR' ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
					{trackingState}
				</div>
				{trackingState === 'TRACKING' && !hasHands && !simulateHand && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
						<p className="text-[10px] text-white/80 font-bold bg-black/40 px-2 py-1 rounded">No hand detected</p>
					</div>
				)}
				{trackingState === 'ERROR' && (
					<div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4 text-center">
						<p className="text-[10px] text-red-400 font-medium">Camera/Model Failed to Load</p>
					</div>
				)}
			</div>

			{/* Control Panel */}
			<aside
				className={`absolute top-0 right-0 h-full w-full sm:w-80 glass-panel p-6 transform transition-transform duration-300 ease-in-out z-20 flex flex-col ${showControls ? "translate-x-0 opacity-100 pointer-events-auto" : "translate-x-full opacity-0 pointer-events-none"}`}
			>
				<div className="flex justify-between items-center mb-8">
					<h2 className="text-lg font-semibold text-white flex items-center gap-2">
						<Settings size={20} /> Parameters
					</h2>
					<button
						type="button"
						onClick={toggleControls}
						aria-label="Close controls"
						className="text-gray-400 hover:text-white transition-colors"
					>
						<X size={20} />
					</button>
				</div>

				<div className="flex-1 overflow-y-auto hide-scrollbar space-y-8 pr-2">
					{/* Tracking Toggle */}
					<div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium text-white flex items-center gap-2">
								<Hand size={16} className="text-cyan-400" /> Hand Control
							</span>
							<button
								onClick={() => setTrackingEnabled(!trackingEnabled)}
								className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${trackingEnabled ? 'bg-cyan-500' : 'bg-gray-600'}`}
							>
								<span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${trackingEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
							</button>
						</div>

						{trackingEnabled && (
							<div className="space-y-4 mt-4">
								<div className="space-y-2">
									<div className="flex justify-between text-xs">
										<label htmlFor="hand-force-input" className="text-cyan-300">Force</label>
										<span className="text-gray-400">{params.handForce}%</span>
									</div>
									<input
										id="hand-force-input"
										type="range"
										min="0"
										max="100"
										step="1"
										value={params.handForce}
										onChange={(e) => handleParamChange("handForce", e.target.value)}
									/>
								</div>

								<div className="space-y-2">
									<div className="flex justify-between text-xs">
										<label htmlFor="hand-sensitivity-input" className="text-cyan-300">Sensitivity</label>
										<span className="text-gray-400">{trackingSensitivity}%</span>
									</div>
									<input
										id="hand-sensitivity-input"
										type="range"
										min="5"
										max="80"
										step="1"
										value={trackingSensitivity}
										onChange={(e) => setTrackingSensitivity(parseInt(e.target.value))}
									/>
									<p className="text-[9px] text-gray-500 leading-tight">Lowering sensitivity helps in dark rooms or with older webcams.</p>
								</div>

								<div className="flex items-center justify-between border-t border-white/5 pt-3">
									<span className="text-[10px] uppercase tracking-wider text-gray-400">Simulate Movement</span>
									<button
										onClick={() => setSimulateHand(!simulateHand)}
										className={`h-4 w-4 rounded border ${simulateHand ? 'bg-cyan-500 border-cyan-500' : 'border-gray-500'}`}
									/>
								</div>
							</div>
						)}
					</div>

					{/* Sliders */}
					<div className="space-y-4">
						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<label htmlFor="density-input" className="text-cyan-300">
									Density
								</label>
								<span className="text-gray-400">{params.density}%</span>
							</div>
							<input
								id="density-input"
								type="range"
								min="10"
								max="150"
								step="1"
								value={params.density}
								onChange={(e) => handleParamChange("density", e.target.value)}
							/>
							<p className="text-xs text-gray-500">
								Number of geometric nodes.
							</p>
						</div>

						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<label htmlFor="speed-input" className="text-purple-300">
									Flow Speed
								</label>
								<span className="text-gray-400">{params.speed}%</span>
							</div>
							<input
								id="speed-input"
								type="range"
								min="0"
								max="100"
								step="1"
								value={params.speed}
								onChange={(e) => handleParamChange("speed", e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<label htmlFor="gravity-input" className="text-green-300">
									Gravity
								</label>
								<span className="text-gray-400">
									{params.gravity > 10 ? "Falling" : "Floating"}
								</span>
							</div>
							<input
								id="gravity-input"
								type="range"
								min="0"
								max="100"
								step="1"
								value={params.gravity}
								onChange={(e) => handleParamChange("gravity", e.target.value)}
							/>
						</div>

						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<label htmlFor="color-speed-input" className="text-pink-300">
									Color Cycle
								</label>
								<span className="text-gray-400">{params.colorSpeed}hz</span>
							</div>
							<input
								id="color-speed-input"
								type="range"
								min="0"
								max="100"
								step="1"
								value={params.colorSpeed}
								onChange={(e) =>
									handleParamChange("colorSpeed", e.target.value)
								}
							/>
						</div>

						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<label htmlFor="base-hue-input" className="text-yellow-300">
									Base Hue
								</label>
								<div
									className="w-4 h-4 rounded-full"
									style={{
										backgroundColor: `hsl(${params.baseHue}, 70%, 50%)`,
									}}
								></div>
							</div>
							<input
								id="base-hue-input"
								type="range"
								min="0"
								max="360"
								step="1"
								value={params.baseHue}
								onChange={(e) => handleParamChange("baseHue", e.target.value)}
								className="hue-slider"
							/>
						</div>

						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<label htmlFor="range-input" className="text-blue-300">
									Link Range
								</label>
								<span className="text-gray-400">{params.range}px</span>
							</div>
							<input
								id="range-input"
								type="range"
								min="20"
								max="100"
								step="1"
								value={params.range}
								onChange={(e) => handleParamChange("range", e.target.value)}
							/>
						</div>
					</div>
				</div>

				{/* Footer / Actions */}
				<div className="mt-6 pt-6 border-t border-white/10 space-y-3">
					<button
						type="button"
						onClick={downloadWallpaper}
						className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white py-3 rounded-lg font-medium transition-all"
					>
						<Download size={18} /> Download Wallpaper
					</button>

					<p className="text-center text-xs text-gray-500 mt-4">
						Tap &apos;Download&apos; to save the current frame.
					</p>
				</div>
			</aside>
		</div>
	);
};

export default App;
