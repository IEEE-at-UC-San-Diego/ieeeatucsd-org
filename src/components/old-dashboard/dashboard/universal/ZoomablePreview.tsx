import React, { useState, useRef, useCallback } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import FilePreview from './FilePreview';

interface ZoomablePreviewProps {
    url: string;
    filename: string;
}

export default function ZoomablePreview({ url, filename }: ZoomablePreviewProps) {
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];
    const currentZoomIndex = zoomLevels.findIndex(level => Math.abs(level - zoom) < 0.01);

    const handleZoomIn = useCallback(() => {
        const nextIndex = Math.min(currentZoomIndex + 1, zoomLevels.length - 1);
        setZoom(zoomLevels[nextIndex]);
    }, [currentZoomIndex]);

    const handleZoomOut = useCallback(() => {
        const prevIndex = Math.max(currentZoomIndex - 1, 0);
        setZoom(zoomLevels[prevIndex]);
    }, [currentZoomIndex]);

    const handleZoomReset = useCallback(() => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (zoom > 1) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - position.x,
                y: e.clientY - position.y
            });
        }
    }, [zoom, position]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isDragging && zoom > 1) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    }, [isDragging, dragStart, zoom]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -1 : 1;
        const newZoomIndex = Math.max(0, Math.min(zoomLevels.length - 1, currentZoomIndex + delta));
        setZoom(zoomLevels[newZoomIndex]);
        
        // Reset position when zooming out to 100% or less
        if (zoomLevels[newZoomIndex] <= 1) {
            setPosition({ x: 0, y: 0 });
        }
    }, [currentZoomIndex]);

    return (
        <div className="relative h-full">
            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-base-100/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="btn btn-xs btn-ghost"
                    onClick={handleZoomIn}
                    disabled={currentZoomIndex >= zoomLevels.length - 1}
                    title="Zoom In"
                >
                    <Icon icon="heroicons:plus" className="h-3 w-3" />
                </motion.button>
                
                <div className="text-xs text-center font-mono px-1">
                    {Math.round(zoom * 100)}%
                </div>
                
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="btn btn-xs btn-ghost"
                    onClick={handleZoomOut}
                    disabled={currentZoomIndex <= 0}
                    title="Zoom Out"
                >
                    <Icon icon="heroicons:minus" className="h-3 w-3" />
                </motion.button>
                
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="btn btn-xs btn-ghost"
                    onClick={handleZoomReset}
                    disabled={zoom === 1 && position.x === 0 && position.y === 0}
                    title="Reset Zoom"
                >
                    <Icon icon="heroicons:arrows-pointing-out" className="h-3 w-3" />
                </motion.button>
            </div>

            {/* Zoom Indicator */}
            {zoom !== 1 && (
                <div className="absolute top-4 left-4 z-10 bg-primary/90 backdrop-blur-sm text-primary-content text-xs px-2 py-1 rounded">
                    {zoom > 1 ? 'Click and drag to pan' : ''}
                </div>
            )}

            {/* Preview Container */}
            <div
                ref={containerRef}
                className="relative h-full overflow-hidden rounded-lg cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                style={{
                    cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}
            >
                <div
                    className="h-full transition-transform duration-100"
                    style={{
                        transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                        transformOrigin: 'center center'
                    }}
                >
                    <div className="p-4 h-full">
                        <FilePreview
                            url={url}
                            filename={filename}
                            isModal={false}
                        />
                    </div>
                </div>
            </div>

            {/* Usage Hint */}
            <div className="absolute bottom-4 left-4 z-10 text-xs text-base-content/50 bg-base-100/80 backdrop-blur-sm px-2 py-1 rounded">
                Scroll to zoom • Click and drag to pan
            </div>
        </div>
    );
} 