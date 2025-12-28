import { useState, useEffect, useRef } from 'react';
import { Settings, Download, X } from 'lucide-react';
import { Particle } from './Particle';

const App = () => {
    const canvasRef = useRef(null);
    const [particles, setParticles] = useState([]);
    const [showControls, setShowControls] = useState(true);
    const [params, setParams] = useState({
        speed: 50,      // 0 - 100
        gravity: 0,     // 0 - 100
        density: 50,    // 10 - 200 (number of particles)
        colorSpeed: 20, // 0 - 100 (hue cycle speed)
        range: 40,      // 20 - 150 (connection distance)
        baseHue: 180,   // 0 - 360
    });
    const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight });

    // Store previous dimensions to calculate scale factor
    // Initialize with current window size
    const prevDimsRef = useRef({ w: window.innerWidth, h: window.innerHeight });

    // Initialize & Manage Particles (Non-destructive)
    useEffect(() => {
        const targetCount = Math.floor((params.density / 100) * 150) + 20;

        setParticles(prevParticles => {
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
                    particlesRef.current.forEach(p => p.relocate(newW, newH, oldW, oldH));
                }

                // Set logic size (CSS pixels)
                canvasRef.current.style.width = `${newW}px`;
                canvasRef.current.style.height = `${newH}px`;

                // Set physical size (Actual pixels)
                canvasRef.current.width = newW * dpr;
                canvasRef.current.height = newH * dpr;

                // Scale context to match
                const ctx = canvasRef.current.getContext('2d');
                ctx.scale(dpr, dpr);
            }

            setDims({ w: newW, h: newH });
        };
        handleResize(); // Call once on mount

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Refs for animation loop to avoid restarts
    const paramsRef = useRef(params);
    const particlesRef = useRef(particles);
    const timeRef = useRef(0); // Persistent time across re-renders

    // Update refs when state changes
    useEffect(() => {
        paramsRef.current = params;
    }, [params]);

    useEffect(() => {
        particlesRef.current = particles;
    }, [particles]);

    // Main Animation Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const render = () => {
            timeRef.current += 1; // Increment persistent time
            const time = timeRef.current;

            // Use current ref values
            const currentParams = paramsRef.current;
            const currentParticles = particlesRef.current;
            const { w, h } = dims;

            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Adjust alpha for trail length
            ctx.fillRect(0, 0, w, h);

            // Calculate Global Color
            // Slowly rotate hue based on time and param
            const hueShift = (time * (currentParams.colorSpeed / 50)) + currentParams.baseHue;

            // Update and Draw Particles
            currentParticles.forEach(p => {
                p.update(w, h, currentParams, time);

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

                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < connectDistance) {
                        // Calculate opacity based on distance
                        const opacity = 1 - (dist / connectDistance);

                        ctx.beginPath();
                        ctx.strokeStyle = `hsla(${hueShift}, 80%, 50%, ${opacity})`;
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => cancelAnimationFrame(animationFrameId);
    }, [dims]); // Only restart if canvas dimensions change significantly

    // Handlers
    const handleParamChange = (key, value) => {
        setParams(prev => ({ ...prev, [key]: parseFloat(value) }));
    };

    const downloadWallpaper = () => {
        const canvas = canvasRef.current;
        // Create a temporary link
        const link = document.createElement('a');
        // High quality output
        link.download = `geoflux-art-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
    };

    const toggleControls = () => setShowControls(!showControls);

    return (
        <div className="relative w-full h-screen h-[100svh] overflow-hidden bg-black">
            {/* The Canvas */}
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full"
            />

            {/* Header / Brand */}
            <div className="absolute top-6 left-6 pointer-events-none select-none z-10">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 opacity-80">
                    GEOFLUX
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-400 tracking-widest uppercase mt-1">Generative Sandbox</p>
            </div>

            {/* Credit - Subtle watermark in bottom left */}
            <div className="absolute left-6 pointer-events-none select-none z-10 bottom-[max(2rem,env(safe-area-inset-bottom))]">
                <p className="text-[10px] text-white/80 tracking-[0.2em] font-medium uppercase drop-shadow-md">
                    by Mumukshu D.C
                </p>
            </div>

            {/* Toggle Button (Visible when controls hidden) */}
            {!showControls && (
                <button
                    onClick={toggleControls}
                    className="absolute right-6 p-3 rounded-full glass-panel hover:bg-white/10 transition-all z-20 text-white bottom-[max(2rem,env(safe-area-inset-bottom))]"
                >
                    <Settings />
                </button>
            )}

            {/* Control Panel */}
            <div className={`absolute top-0 right-0 h-full w-full sm:w-80 glass-panel p-6 transform transition-transform duration-300 ease-in-out z-20 flex flex-col ${showControls ? 'translate-x-0' : 'translate-x-full'}`}>

                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Settings size={20} /> Parameters
                    </h2>
                    <button onClick={toggleControls} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto hide-scrollbar space-y-8 pr-2">

                    {/* Sliders */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <label className="text-cyan-300">Density</label>
                                <span className="text-gray-400">{params.density}%</span>
                            </div>
                            <input
                                type="range" min="10" max="150" step="1"
                                value={params.density}
                                onChange={(e) => handleParamChange('density', e.target.value)}
                            />
                            <p className="text-xs text-gray-500">Number of geometric nodes.</p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <label className="text-purple-300">Flow Speed</label>
                                <span className="text-gray-400">{params.speed}%</span>
                            </div>
                            <input
                                type="range" min="0" max="100" step="1"
                                value={params.speed}
                                onChange={(e) => handleParamChange('speed', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <label className="text-green-300">Gravity</label>
                                <span className="text-gray-400">{params.gravity > 10 ? 'Falling' : 'Floating'}</span>
                            </div>
                            <input
                                type="range" min="0" max="100" step="1"
                                value={params.gravity}
                                onChange={(e) => handleParamChange('gravity', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <label className="text-pink-300">Color Cycle</label>
                                <span className="text-gray-400">{params.colorSpeed}hz</span>
                            </div>
                            <input
                                type="range" min="0" max="100" step="1"
                                value={params.colorSpeed}
                                onChange={(e) => handleParamChange('colorSpeed', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <label className="text-yellow-300">Base Hue</label>
                                <div
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: `hsl(${params.baseHue}, 70%, 50%)` }}
                                ></div>
                            </div>
                            <input
                                type="range" min="0" max="360" step="1"
                                value={params.baseHue}
                                onChange={(e) => handleParamChange('baseHue', e.target.value)}
                                className="hue-slider"
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <label className="text-blue-300">Link Range</label>
                                <span className="text-gray-400">{params.range}px</span>
                            </div>
                            <input
                                type="range" min="20" max="100" step="1"
                                value={params.range}
                                onChange={(e) => handleParamChange('range', e.target.value)}
                            />
                        </div>
                    </div>

                </div>

                {/* Footer / Actions */}
                <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
                    <button
                        onClick={downloadWallpaper}
                        className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white py-3 rounded-lg font-medium transition-all"
                    >
                        <Download size={18} /> Download Wallpaper
                    </button>

                    <p className="text-center text-xs text-gray-500 mt-4">
                        Tap 'Download' to save the current frame.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default App;
