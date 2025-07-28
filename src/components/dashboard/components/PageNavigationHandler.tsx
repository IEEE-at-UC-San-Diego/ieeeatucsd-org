import React, { useEffect, useRef, useCallback } from 'react';

interface PageNavigationHandlerProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    children: React.ReactNode;
    enableExportOptimizations?: boolean;
}

/**
 * Page Navigation Handler that enhances preview functionality
 * for optimal integration with the enhanced PDF export system
 */
const PageNavigationHandler: React.FC<PageNavigationHandlerProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    children,
    enableExportOptimizations = false
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const pageChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Handle page change with optimizations for export system
     */
    const handlePageChange = useCallback((newPage: number) => {
        if (newPage < 1 || newPage > totalPages || newPage === currentPage) {
            return;
        }

        // Clear any pending page changes
        if (pageChangeTimeoutRef.current) {
            clearTimeout(pageChangeTimeoutRef.current);
        }

        // Optimize page transition for export system
        if (enableExportOptimizations) {
            // Add capture-ready class for export system
            const container = containerRef.current;
            if (container) {
                container.classList.add('page-transitioning');

                // Remove transition class after page change
                pageChangeTimeoutRef.current = setTimeout(() => {
                    container.classList.remove('page-transitioning');
                    container.classList.add('capture-ready');
                }, 100);
            }
        }

        onPageChange(newPage);
    }, [currentPage, totalPages, onPageChange, enableExportOptimizations]);

    /**
     * Handle keyboard navigation
     */
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        switch (event.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                event.preventDefault();
                handlePageChange(currentPage - 1);
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                event.preventDefault();
                handlePageChange(currentPage + 1);
                break;
            case 'Home':
                event.preventDefault();
                handlePageChange(1);
                break;
            case 'End':
                event.preventDefault();
                handlePageChange(totalPages);
                break;
            case 'PageUp':
                event.preventDefault();
                handlePageChange(Math.max(1, currentPage - 5));
                break;
            case 'PageDown':
                event.preventDefault();
                handlePageChange(Math.min(totalPages, currentPage + 5));
                break;
        }
    }, [currentPage, totalPages, handlePageChange]);

    /**
     * Setup event listeners and optimizations
     */
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        // Add keyboard navigation
        container.addEventListener('keydown', handleKeyDown);
        container.setAttribute('tabindex', '0');

        // Add export optimization classes
        if (enableExportOptimizations) {
            container.classList.add('export-optimized');

            // Add data attributes for export system
            container.setAttribute('data-current-page', currentPage.toString());
            container.setAttribute('data-total-pages', totalPages.toString());
        }

        return () => {
            container.removeEventListener('keydown', handleKeyDown);
            if (pageChangeTimeoutRef.current) {
                clearTimeout(pageChangeTimeoutRef.current);
            }
        };
    }, [handleKeyDown, currentPage, totalPages, enableExportOptimizations]);

    /**
     * Expose navigation methods for export system
     */
    useEffect(() => {
        if (enableExportOptimizations && containerRef.current) {
            // Attach navigation methods to container for export system access
            const container = containerRef.current as any;
            container.navigateToPage = handlePageChange;
            container.getCurrentPage = () => currentPage;
            container.getTotalPages = () => totalPages;
        }
    }, [handlePageChange, currentPage, totalPages, enableExportOptimizations]);

    return (
        <div
            ref={containerRef}
            className={`page-navigation-container ${enableExportOptimizations ? 'export-ready' : ''}`}
            style={{
                position: 'relative',
                outline: 'none'
            }}
        >
            {children}

            {/* Export optimization styles */}
            {enableExportOptimizations && (
                <style dangerouslySetInnerHTML={{
                    __html: `
            .export-optimized {
              font-feature-settings: "kern" 1, "liga" 1;
              text-rendering: optimizeLegibility;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            
            .page-transitioning * {
              pointer-events: none;
              transition: none !important;
            }
            
            .capture-ready .constitution-page {
              transform: translateZ(0);
              backface-visibility: hidden;
              -webkit-backface-visibility: hidden;
            }
            
            .capture-ready img {
              image-rendering: -webkit-optimize-contrast;
              image-rendering: optimize-contrast;
              image-rendering: crisp-edges;
            }
            
            /* Ensure consistent font rendering */
            .capture-ready * {
              font-kerning: normal;
              font-variant-ligatures: common-ligatures;
              font-variant-numeric: oldstyle-nums;
            }
            
            /* Optimize for screen capture */
            .capture-ready .constitution-page {
              filter: contrast(1.05) brightness(1.02);
            }
          `
                }} />
            )}
        </div>
    );
};

export default PageNavigationHandler; 