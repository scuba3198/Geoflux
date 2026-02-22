import type { HandVector, ParticleParams } from "./types";

export class Particle {
	id: number;
	x: number;
	y: number;
	vx: number;
	vy: number;
	gVy: number;
	size: number;
	phase: number;

	constructor(w: number, h: number, id: number) {
		this.id = id;
		this.x = 0;
		this.y = 0;
		this.vx = 0;
		this.vy = 0;
		this.gVy = 0;
		this.size = 0;
		this.phase = 0;
		this.reset(w, h, true);
	}

	reset(w: number, h: number, randomY: boolean = false): void {
		this.x = Math.random() * w;
		this.y = randomY ? Math.random() * h : -20;

		// Base velocity vector (Inherent "Float" movement)
		const angle = Math.random() * Math.PI * 2;
		const speed = Math.random() * 0.5 + 0.2;
		this.vx = Math.cos(angle) * speed;
		this.vy = Math.sin(angle) * speed;

		// Gravity-induced velocity (Separate component)
		this.gVy = 0;

		this.size = Math.random() * 2 + 1;
		// Unique phase for oscillation
		this.phase = Math.random() * Math.PI * 2;
	}

	update(w: number, h: number, params: ParticleParams, time: number, hands: HandVector[] = []): void {
		const speedMultiplier = params.speed / 50;

		// 1. Calculate Gravity Component
		// Gravity force accumulates into gVy
		const gravityAccel = (params.gravity / 50) * 0.2;
		this.gVy += gravityAccel;

		// Apply drag/damping to gravity velocity ONLY
		// This ensures terminal velocity AND decay when gravity is removed
		this.gVy *= 0.95;

		// 2. Calculate Total Velocity
		// Base velocity (floating) scaled by speed param
		let moveX = this.vx * speedMultiplier;
		let moveY = this.vy * speedMultiplier;

		// Add gravity component (also scaled slightly by speed to keep time-scale consistent, or keep independent)
		// Let's keep gravity independent of flow speed to make it feel physically weighty
		moveY += this.gVy;

		// 3. Apply Hand Force (Wind / Drag)
		if (params.handForce > 0 && hands.length > 0) {
			const effectRadius = params.range * 12; // Massive radius for easier targeting

			for (const hand of hands) {
				if (!hand.active) continue;

				const dx = this.x - hand.x;
				const dy = this.y - hand.y;
				const dist = Math.sqrt(dx * dx + dy * dy);

				const safeDist = Math.max(dist, 5);

				if (safeDist < effectRadius) {
					// Quadratic falloff for smoother boundary transitions
					const forceBase = 1 - safeDist / effectRadius;
					const force = forceBase * forceBase * (params.handForce / 50);

					// Viscous Drag: Particles follow the hand's vector
					// We use a high multiplier but don't let it exceed a reasonable "touch" speed
					const handInfluence = 20;
					const targetVx = hand.vx * handInfluence;
					const targetVy = hand.vy * handInfluence;

					// Blend current velocity with hand velocity (Lerp)
					moveX += (targetVx - moveX) * force * 0.2;
					moveY += (targetVy - moveY) * force * 0.2;

					// Slight outward pressure (Physical "Push")
					moveX += (dx / safeDist) * force * 5;
					moveY += (dy / safeDist) * force * 5;
				}
			}
		}

		// 4. Apply position update
		// Add wiggle
		const wiggle = Math.sin(time * 0.002 + this.phase) * (params.speed / 100);

		this.x += moveX + wiggle;
		this.y += moveY;

		// 5. Boundary Checks
		if (this.x < 0 || this.x > w || this.y > h + 20) {
			// Wrap around or reset
			if (params.gravity > 10) {
				// FALLING BEHAVIOR
				// If falling off bottom, reset to top
				if (this.y > h) {
					this.reset(w, h, false);
					// Preserve some gathered momentum? No, reset simulates new drop.
				}
				// Wrap X
				if (this.x < 0) this.x = w;
				if (this.x > w) this.x = 0;
			} else {
				// FLOATING BEHAVIOR
				// Bounce off walls or wrap
				if (this.x < 0) this.x = w;
				else if (this.x > w) this.x = 0;

				if (this.y < 0) this.y = h;
				else if (this.y > h) this.y = 0;
			}
		}
	}

	relocate(w: number, h: number, oldW: number, oldH: number): void {
		if (oldW === 0 || oldH === 0) return; // Prevent division by zero

		// Scale position based on new dimensions
		const scaleX = w / oldW;
		const scaleY = h / oldH;

		this.x *= scaleX;
		this.y *= scaleY;
	}
}
