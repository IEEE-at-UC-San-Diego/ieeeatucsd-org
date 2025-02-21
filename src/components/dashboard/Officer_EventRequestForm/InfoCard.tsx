import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';

interface InfoCardProps {
    title: string;
    items: readonly string[] | string[];
    type?: 'info' | 'warning' | 'success';
    icon?: React.ReactNode;
    className?: string;
}

const defaultIcons = {
    info: <Icon icon="mdi:information-outline" className="text-info shrink-0 w-6 h-6" />,
    warning: <Icon icon="mdi:alert-outline" className="text-warning shrink-0 w-6 h-6" />,
    success: <Icon icon="mdi:check-circle-outline" className="text-success shrink-0 w-6 h-6" />
};

const typeStyles = {
    info: 'alert-info bg-info/10',
    warning: 'alert-warning bg-warning/10',
    success: 'alert-success bg-success/10'
};

export const InfoCard: React.FC<InfoCardProps> = ({
    title,
    items,
    type = 'info',
    icon,
    className = ''
}) => {
    const listVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -20 },
        show: { opacity: 1, x: 0 }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`alert ${typeStyles[type]} shadow-sm ${className}`}
        >
            {icon || defaultIcons[type]}
            <div className="text-sm space-y-2 text-white">
                <p className="font-medium text-white">{title}</p>
                <motion.ul
                    className="space-y-1 ml-1 text-white"
                    variants={listVariants}
                    initial="hidden"
                    animate="show"
                >
                    {items.map((item, index) => (
                        <motion.li
                            key={index}
                            variants={itemVariants}
                            className="flex items-start gap-2 text-white"
                        >
                            <span className="text-base leading-6 text-white">•</span>
                            <span>{item}</span>
                        </motion.li>
                    ))}
                </motion.ul>
            </div>
        </motion.div>
    );
};

export default InfoCard; 