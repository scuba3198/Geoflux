/** Simulation control parameters bound to the UI sliders */
export interface ParticleParams {
	speed: number; // 0–100
	gravity: number; // 0–100
	density: number; // 10–200
	colorSpeed: number; // 0–100
	range: number; // 20–150
	baseHue: number; // 0–360
}

/** Canvas / viewport dimensions */
export interface Dimensions {
	w: number;
	h: number;
}
