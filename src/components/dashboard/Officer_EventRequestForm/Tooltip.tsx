import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';

interface TooltipProps {
    title: string;
    description: string;
    children: React.ReactNode;
    className?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
};

const arrowStyles = {
    top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-base-300 border-l-transparent border-r-transparent border-b-transparent',
    bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-b-base-300 border-l-transparent border-r-transparent border-t-transparent',
    left: 'right-[-6px] top-1/2 -translate-y-1/2 border-l-base-300 border-t-transparent border-b-transparent border-r-transparent',
    right: 'left-[-6px] top-1/2 -translate-y-1/2 border-r-base-300 border-t-transparent border-b-transparent border-l-transparent'
};

export const Tooltip: React.FC<TooltipProps> = ({
    title,
    description,
    children,
    className = '',
    position = 'top'
}) => {
    const [isVisible, setIsVisible] = React.useState(false);

    return (
        <div
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
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className={`absolute z-50 min-w-[320px] max-w-md p-4 bg-base-100 border border-base-300 rounded-lg shadow-lg ${positionStyles[position]}`}
                    >
                        <div className={`absolute w-0 h-0 border-4 ${arrowStyles[position]}`} />
                        <div className="space-y-2">
                            <p className="font-medium text-base">{title}</p>
                            <p className="text-sm leading-relaxed text-base-content/80">{description}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Tooltip; 