import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';

interface TooltipProps {
    title: string;
    description: string;
    children: React.ReactNode;
    className?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    icon?: string;
    maxWidth?: string;
}

// Define a small safety margin (in pixels) to keep tooltip from touching viewport edges
const VIEWPORT_MARGIN = 8;

const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
};

const arrowStyles = {
    top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-base-200 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-b-base-200 border-l-transparent border-r-transparent border-t-transparent',
    left: 'right-[-6px] top-1/2 -translate-y-1/2 border-l-base-200 border-t-transparent border-b-transparent border-r-transparent',
    right: 'left-[-6px] top-1/2 -translate-y-1/2 border-r-base-200 border-t-transparent border-b-transparent border-l-transparent'
};

export const Tooltip: React.FC<TooltipProps> = ({
    title,
    description,
    children,
    className = '',
    position = 'left',
    icon = 'mdi:information',
    maxWidth = '350px'
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [currentPosition, setCurrentPosition] = useState(position);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const tooltipRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isVisible || !tooltipRef.current || !containerRef.current) return;

        const updatePosition = () => {
            const tooltip = tooltipRef.current!;
            const container = containerRef.current!;
            const tooltipRect = tooltip.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Calculate overflow amounts
            const overflowRight = Math.max(0, tooltipRect.right - (viewportWidth - VIEWPORT_MARGIN));
            const overflowLeft = Math.max(0, VIEWPORT_MARGIN - tooltipRect.left);
            const overflowTop = Math.max(0, VIEWPORT_MARGIN - tooltipRect.top);
            const overflowBottom = Math.max(0, tooltipRect.bottom - (viewportHeight - VIEWPORT_MARGIN));

            // Initialize offset adjustments
            let xOffset = 0;
            let yOffset = 0;

            // Determine best position and calculate offsets
            let newPosition = position;

            if (position === 'left' || position === 'right') {
                if (position === 'left' && overflowLeft > 0) {
                    newPosition = 'right';
                } else if (position === 'right' && overflowRight > 0) {
                    newPosition = 'left';
                }

                // Adjust vertical position if needed
                if (overflowTop > 0) {
                    yOffset = overflowTop;
                } else if (overflowBottom > 0) {
                    yOffset = -overflowBottom;
                }
            } else {
                if (position === 'top' && overflowTop > 0) {
                    newPosition = 'bottom';
                } else if (position === 'bottom' && overflowBottom > 0) {
                    newPosition = 'top';
                }

                // Adjust horizontal position if needed
                if (overflowRight > 0) {
                    xOffset = -overflowRight;
                } else if (overflowLeft > 0) {
                    xOffset = overflowLeft;
                }
            }

            setCurrentPosition(newPosition);
            setOffset({ x: xOffset, y: yOffset });
        };

        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition);
        };
    }, [isVisible, position]);

    return (
        <div
            ref={containerRef}
            className={`relative inline-block ${className}`}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            onFocus={() => setIsVisible(true)}
            onBlur={() => setIsVisible(false)}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        ref={tooltipRef}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{
                            duration: 0.15,
                            ease: 'easeOut'
                        }}
                        style={{
                            maxWidth,
                            width: 'min(90vw, 350px)',
                            transform: `translate(${offset.x}px, ${offset.y}px)`
                        }}
                        className={`absolute z-50 p-3 bg-base-200/95 border border-base-300 rounded-lg shadow-lg backdrop-blur-sm 
                            ${positionStyles[currentPosition]}`}
                    >
                        <div className={`absolute w-0 h-0 border-[6px] ${arrowStyles[currentPosition]}`} />
                        <div className="flex items-start gap-2">
                            <Icon icon={icon} className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-base text-base-content break-words">{title}</h3>
                                <p className="text-sm leading-relaxed text-base-content/80 mt-0.5 whitespace-pre-wrap break-words">{description}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Tooltip; 