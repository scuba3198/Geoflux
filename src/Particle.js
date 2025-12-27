export class Particle {
    constructor(w, h, id) {
        this.id = id;
        this.reset(w, h, true);
    }

    reset(w, h, randomY = false) {
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

    update(w, h, params, time) {
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

        // 3. Apply position update
        // Add wiggle
        const wiggle = Math.sin(time * 0.002 + this.phase) * (params.speed / 100);

        this.x += moveX + wiggle;
        this.y += moveY;

        // 4. Boundary Checks
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
    relocate(w, h, oldW, oldH) {
        if (oldW === 0 || oldH === 0) return; // Prevent division by zero

        // Scale position based on new dimensions
        const scaleX = w / oldW;
        const scaleY = h / oldH;

        this.x *= scaleX;
        this.y *= scaleY;
    }
}
