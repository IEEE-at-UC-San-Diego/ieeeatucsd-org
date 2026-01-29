import React, { useEffect, useState } from 'react';

// Random integer between min and max
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// Type for a circuit path
type CircuitPath = {
    d: string;
    delay: number;
    duration: number;
    id: number;
};

export default function CircuitBackground() {
    const [paths, setPaths] = useState<CircuitPath[]>([]);

    // Generate paths on client-side only to avoid hydration mismatch
    useEffect(() => {
        const generatePaths = () => {
            // Dimensions (approximate content area)
            const width = window.innerWidth;
            const height = window.innerHeight;

            const newPaths: CircuitPath[] = [];
            const count = 15; // Number of active lines

            for (let i = 0; i < count; i++) {
                // Determine start edge: 0=top, 1=right, 2=bottom, 3=left
                const edge = random(0, 3);
                let startX = 0, startY = 0;
                let midX = 0, midY = 0;
                let endX = 0, endY = 0;

                // Random target roughly near center but scattered
                const targetX = random(width * 0.2, width * 0.8);
                const targetY = random(height * 0.2, height * 0.8);

                switch (edge) {
                    case 0: // Top
                        startX = random(0, width);
                        startY = -10; // Start off-screen
                        // Orthogonal: Down then sideways
                        midX = startX;
                        midY = targetY;
                        endX = targetX;
                        endY = targetY;
                        break;
                    case 1: // Right
                        startX = width + 10;
                        startY = random(0, height);
                        // Orthogonal: Left then up/down
                        midX = targetX;
                        midY = startY;
                        endX = targetX;
                        endY = targetY;
                        break;
                    case 2: // Bottom
                        startX = random(0, width);
                        startY = height + 10;
                        // Orthogonal: Up then sideways
                        midX = startX;
                        midY = targetY;
                        endX = targetX;
                        endY = targetY;
                        break;
                    case 3: // Left
                        startX = -10;
                        startY = random(0, height);
                        // Orthogonal: Right then up/down
                        midX = targetX;
                        midY = startY;
                        endX = targetX;
                        endY = targetY;
                        break;
                }

                // Construct Path Data: M -> L (Horizontal/Vertical) -> L (Remaining)
                // Note: The switch logic above creates a simple L-shape (1 corner)
                // To look more "circuit-y" we might want stepping, but L-shape is a good start.
                // Let's ensure strict orthogonality.

                let d = "";
                // Logic: Move from Start to Mid, then Mid to End.
                // Case 0 (Top): Start(x, -10) -> L(x, targetY) -> L(targetX, targetY)
                if (edge === 0 || edge === 2) {
                    // Vertical first
                    d = `M ${startX} ${startY} L ${startX} ${targetY} L ${targetX} ${targetY}`;
                } else {
                    // Horizontal first
                    d = `M ${startX} ${startY} L ${targetX} ${startY} L ${targetX} ${targetY}`;
                }

                newPaths.push({
                    id: i,
                    d,
                    delay: random(0, 5000) / 1000, // 0-5s delay
                    duration: random(3000, 8000) / 1000 // 3-8s duration
                });
            }
            setPaths(newPaths);
        };

        generatePaths();

        // Optional: Regenerate periodically or on resize? 
        // For now, static set on load is fine, but maybe regenerate on valid resize
        const handleResize = () => generatePaths();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-gray-50">
            <svg
                className="absolute w-full h-full opacity-[0.3]"
                xmlns="http://www.w3.org/2000/svg"
            >
                <defs>
                    <linearGradient id="circuit-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#94a3b8" stopOpacity="0" />
                        <stop offset="50%" stopColor="#64748b" stopOpacity="1" />
                        <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {paths.map((path) => (
                    <g key={path.id}>
                        <path
                            d={path.d}
                            fill="none"
                            stroke="url(#circuit-gradient)"
                            strokeWidth="2"
                            className="circuit-line"
                            style={{
                                animationDelay: `${path.delay}s`,
                                animationDuration: `${path.duration}s`
                            }}
                        />
                        {/* Optional: Add a node at the end */}
                        {/* To parse coordinates from d string is hard in render, let's just skip circle for random paths or pass coords */}
                    </g>
                ))}
            </svg>
            <style>{`
                .circuit-line {
                    stroke-dasharray: 200 1000; /* Short dash, long gap */
                    stroke-dashoffset: 1200;
                    animation-name: flow;
                    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
                    animation-iteration-count: infinite;
                    stroke-linecap: round;
                }
                
                @keyframes flow {
                    0% {
                        stroke-dashoffset: 1200;
                        opacity: 0;
                    }
                    10% {
                         opacity: 1;
                    }
                    90% {
                        opacity: 1;
                    }
                    100% {
                        stroke-dashoffset: -1200;
                        opacity: 0;
                    }
                }
            `}</style>
        </div>
    );
}
