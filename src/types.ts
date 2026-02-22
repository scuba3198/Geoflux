/** Simulation control parameters bound to the UI sliders */
export interface ParticleParams {
	speed: number; // 0–100
	gravity: number; // 0–100
	density: number; // 10–200
	colorSpeed: number; // 0–100
	range: number; // 20–150
	baseHue: number; // 0–360
	handForce: number; // 0-100 (Wind strength from hands)
}

/** Canvas / viewport dimensions */
export interface Dimensions {
	w: number;
	h: number;
}

/** 
 * Represents the structured positional velocity of a tracked hand.
 * Guaranteed to be within valid coordinates and not NaN.
 */
export interface HandVector {
	x: number; // Absolute canvas X
	y: number; // Absolute canvas Y
	vx: number; // Velocity X between frames
	vy: number; // Velocity Y between frames
	active: boolean;
	timestamp: number;
}
