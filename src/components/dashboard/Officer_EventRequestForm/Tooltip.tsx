import React from 'react';
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
                        transition={{
                            duration: 0.15,
                            ease: 'easeOut'
                        }}
                        style={{ maxWidth }}
                        className={`absolute z-50 p-3 bg-base-200/95 border border-base-300 rounded-lg shadow-lg backdrop-blur-sm 
                            ${positionStyles[position]}`}
                    >
                        <div className={`absolute w-0 h-0 border-[6px] ${arrowStyles[position]}`} />
                        <div className="flex items-start gap-2">
                            <Icon icon={icon} className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="font-medium text-base text-base-content">{title}</h3>
                                <p className="text-sm leading-relaxed text-base-content/80 mt-0.5 whitespace-pre-wrap">{description}</p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Tooltip; 