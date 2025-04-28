import { useState, useEffect } from 'react';
import { getCurrentTheme, toggleTheme } from '../../../utils/themeUtils';
import { ThemeService } from '../../../scripts/database/ThemeService';
import { Update } from '../../../scripts/pocketbase/Update';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Collections } from '../../../schemas/pocketbase/schema';

export default function ThemeToggle() {
    const [theme, setTheme] = useState<'light' | 'dark'>(getCurrentTheme());
    const [isLoading, setIsLoading] = useState(false);
    const auth = Authentication.getInstance();
    const update = Update.getInstance();

    useEffect(() => {
        // Initialize theme from IndexedDB
        const loadTheme = async () => {
            try {
                const themeService = ThemeService.getInstance();
                const settings = await themeService.getThemeSettings();
                setTheme(settings.theme);
            } catch (error) {
                console.error('Error loading theme:', error);
            }
        };

        loadTheme();

        // Add event listener for theme changes
        const handleThemeChange = () => {
            setTheme(getCurrentTheme());
        };

        window.addEventListener('themechange', handleThemeChange);

        return () => {
            window.removeEventListener('themechange', handleThemeChange);
        };
    }, []);

    const handleToggle = async () => {
        setIsLoading(true);
        try {
            // Toggle theme in IndexedDB
            await toggleTheme();
            const newTheme = getCurrentTheme();
            setTheme(newTheme);

            // Also update user preferences in PocketBase if user is authenticated
            const user = auth.getCurrentUser();
            if (user) {
                try {
                    // Get current display preferences
                    let displayPreferences = { theme: newTheme, fontSize: 'medium' };

                    if (user.display_preferences && typeof user.display_preferences === 'string') {
                        try {
                            const userPrefs = JSON.parse(user.display_preferences);
                            displayPreferences = {
                                ...userPrefs,
                                theme: newTheme
                            };
                        } catch (e) {
                            console.error('Error parsing display preferences:', e);
                        }
                    }

                    // Update user record
                    await update.updateFields(
                        Collections.USERS,
                        user.id,
                        {
                            display_preferences: JSON.stringify(displayPreferences)
                        }
                    );
                } catch (error) {
                    console.error('Error updating user preferences:', error);
                }
            }
        } catch (error) {
            console.error('Error toggling theme:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="dropdown dropdown-end">
            <button
                onClick={handleToggle}
                className={`btn btn-circle btn-sm ${isLoading ? 'loading' : ''}`}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme (Light mode is experimental)`}
                disabled={isLoading}
            >
                {!isLoading && (
                    theme === 'light' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    )
                )}
            </button>
            <div className="dropdown-content z-1 menu p-2 shadow-sm bg-base-100 rounded-box w-52 mt-2 text-xs">
                <div className="p-2">
                    <p className="font-bold text-warning mb-1">Warning:</p>
                    <p>Light mode is experimental and not fully supported yet. Some UI elements may not display correctly.</p>
                </div>
            </div>
        </div>
    );
}