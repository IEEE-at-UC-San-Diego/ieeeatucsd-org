import { useState, useEffect } from 'react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Update } from '../../../scripts/pocketbase/Update';
import { Collections } from '../../../schemas/pocketbase/schema';
import { toast } from 'react-hot-toast';

// Default display preferences
const DEFAULT_DISPLAY_PREFERENCES = {
    theme: 'dark',
    fontSize: 'medium'
};

// Default accessibility settings
const DEFAULT_ACCESSIBILITY_SETTINGS = {
    colorBlindMode: false,
    reducedMotion: false
};

export default function DisplaySettings() {
    const auth = Authentication.getInstance();
    const update = Update.getInstance();
    const [theme, setTheme] = useState(DEFAULT_DISPLAY_PREFERENCES.theme);
    const [fontSize, setFontSize] = useState(DEFAULT_DISPLAY_PREFERENCES.fontSize);
    const [colorBlindMode, setColorBlindMode] = useState(DEFAULT_ACCESSIBILITY_SETTINGS.colorBlindMode);
    const [reducedMotion, setReducedMotion] = useState(DEFAULT_ACCESSIBILITY_SETTINGS.reducedMotion);
    const [saving, setSaving] = useState(false);

    // Load saved preferences on component mount
    useEffect(() => {
        const loadPreferences = async () => {
            try {
                // First check localStorage for immediate UI updates
                const savedTheme = localStorage.getItem('theme') || DEFAULT_DISPLAY_PREFERENCES.theme;
                // Ensure theme is either light or dark
                const validTheme = ['light', 'dark'].includes(savedTheme) ? savedTheme : DEFAULT_DISPLAY_PREFERENCES.theme;
                const savedFontSize = localStorage.getItem('fontSize') || DEFAULT_DISPLAY_PREFERENCES.fontSize;
                const savedColorBlindMode = localStorage.getItem('colorBlindMode') === 'true';
                const savedReducedMotion = localStorage.getItem('reducedMotion') === 'true';

                setTheme(validTheme);
                setFontSize(savedFontSize);
                setColorBlindMode(savedColorBlindMode);
                setReducedMotion(savedReducedMotion);

                // Apply theme to document
                document.documentElement.setAttribute('data-theme', validTheme);

                // Apply font size
                applyFontSize(savedFontSize);

                // Apply accessibility settings
                if (savedColorBlindMode) {
                    document.documentElement.classList.add('color-blind-mode');
                }

                if (savedReducedMotion) {
                    document.documentElement.classList.add('reduced-motion');
                }

                // Then check if user has saved preferences in their profile
                const user = auth.getCurrentUser();
                if (user) {
                    let needsDisplayPrefsUpdate = false;
                    let needsAccessibilityUpdate = false;

                    // Check and handle display preferences
                    if (user.display_preferences && typeof user.display_preferences === 'string' && user.display_preferences.trim() !== '') {
                        try {
                            const userPrefs = JSON.parse(user.display_preferences);

                            // Only update if values exist and are different from localStorage
                            if (userPrefs.theme && ['light', 'dark'].includes(userPrefs.theme) && userPrefs.theme !== validTheme) {
                                setTheme(userPrefs.theme);
                                localStorage.setItem('theme', userPrefs.theme);
                                document.documentElement.setAttribute('data-theme', userPrefs.theme);
                            } else if (!['light', 'dark'].includes(userPrefs.theme)) {
                                // If theme is not valid, mark for update
                                needsDisplayPrefsUpdate = true;
                            }

                            if (userPrefs.fontSize && userPrefs.fontSize !== savedFontSize) {
                                setFontSize(userPrefs.fontSize);
                                localStorage.setItem('fontSize', userPrefs.fontSize);
                                applyFontSize(userPrefs.fontSize);
                            }
                        } catch (e) {
                            console.error('Error parsing display preferences:', e);
                            needsDisplayPrefsUpdate = true;
                        }
                    } else {
                        needsDisplayPrefsUpdate = true;
                    }

                    // Check and handle accessibility settings
                    if (user.accessibility_settings && typeof user.accessibility_settings === 'string' && user.accessibility_settings.trim() !== '') {
                        try {
                            const accessibilityPrefs = JSON.parse(user.accessibility_settings);

                            if (typeof accessibilityPrefs.colorBlindMode === 'boolean' &&
                                accessibilityPrefs.colorBlindMode !== savedColorBlindMode) {
                                setColorBlindMode(accessibilityPrefs.colorBlindMode);
                                localStorage.setItem('colorBlindMode', accessibilityPrefs.colorBlindMode.toString());

                                if (accessibilityPrefs.colorBlindMode) {
                                    document.documentElement.classList.add('color-blind-mode');
                                } else {
                                    document.documentElement.classList.remove('color-blind-mode');
                                }
                            }

                            if (typeof accessibilityPrefs.reducedMotion === 'boolean' &&
                                accessibilityPrefs.reducedMotion !== savedReducedMotion) {
                                setReducedMotion(accessibilityPrefs.reducedMotion);
                                localStorage.setItem('reducedMotion', accessibilityPrefs.reducedMotion.toString());

                                if (accessibilityPrefs.reducedMotion) {
                                    document.documentElement.classList.add('reduced-motion');
                                } else {
                                    document.documentElement.classList.remove('reduced-motion');
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing accessibility settings:', e);
                            needsAccessibilityUpdate = true;
                        }
                    } else {
                        needsAccessibilityUpdate = true;
                    }

                    // Initialize default settings if needed
                    if (needsDisplayPrefsUpdate || needsAccessibilityUpdate) {
                        await initializeDefaultSettings(user.id, needsDisplayPrefsUpdate, needsAccessibilityUpdate);
                    }
                }
            } catch (error) {
                console.error('Error loading preferences:', error);
                toast.error('Failed to load display preferences');
            }
        };

        loadPreferences();
    }, []);

    // Initialize default settings if not set
    const initializeDefaultSettings = async (userId: string, updateDisplayPrefs: boolean, updateAccessibility: boolean) => {
        try {
            const updateData: any = {};

            if (updateDisplayPrefs) {
                updateData.display_preferences = JSON.stringify({
                    theme,
                    fontSize
                });
            }

            if (updateAccessibility) {
                updateData.accessibility_settings = JSON.stringify({
                    colorBlindMode,
                    reducedMotion
                });
            }

            if (Object.keys(updateData).length > 0) {
                await update.updateFields(Collections.USERS, userId, updateData);
                console.log('Initialized default display and accessibility settings');
            }
        } catch (error) {
            console.error('Error initializing default settings:', error);
        }
    };

    // Apply font size to document
    const applyFontSize = (size: string) => {
        const htmlElement = document.documentElement;

        // Remove existing font size classes
        htmlElement.classList.remove('text-sm', 'text-base', 'text-lg', 'text-xl');

        // Add new font size class
        switch (size) {
            case 'small':
                htmlElement.classList.add('text-sm');
                break;
            case 'medium':
                htmlElement.classList.add('text-base');
                break;
            case 'large':
                htmlElement.classList.add('text-lg');
                break;
            case 'extra-large':
                htmlElement.classList.add('text-xl');
                break;
        }
    };

    // Handle theme change
    const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTheme = e.target.value;
        setTheme(newTheme);

        // Apply theme to document
        document.documentElement.setAttribute('data-theme', newTheme);

        // Save to localStorage
        localStorage.setItem('theme', newTheme);
    };

    // Handle font size change
    const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = e.target.value;
        setFontSize(newSize);

        // Apply font size
        applyFontSize(newSize);

        // Save to localStorage
        localStorage.setItem('fontSize', newSize);
    };

    // Handle color blind mode toggle
    const handleColorBlindModeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const enabled = e.target.checked;
        setColorBlindMode(enabled);

        // Apply to document
        if (enabled) {
            document.documentElement.classList.add('color-blind-mode');
        } else {
            document.documentElement.classList.remove('color-blind-mode');
        }

        // Save to localStorage
        localStorage.setItem('colorBlindMode', enabled.toString());
    };

    // Handle reduced motion toggle
    const handleReducedMotionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const enabled = e.target.checked;
        setReducedMotion(enabled);

        // Apply to document
        if (enabled) {
            document.documentElement.classList.add('reduced-motion');
        } else {
            document.documentElement.classList.remove('reduced-motion');
        }

        // Save to localStorage
        localStorage.setItem('reducedMotion', enabled.toString());
    };

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        try {
            const user = auth.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            // Save display preferences to user record
            const displayPreferences = {
                theme,
                fontSize
            };

            // Save accessibility settings to user record
            const accessibilitySettings = {
                colorBlindMode,
                reducedMotion
            };

            // Update user record
            await update.updateFields(
                Collections.USERS,
                user.id,
                {
                    display_preferences: JSON.stringify(displayPreferences),
                    accessibility_settings: JSON.stringify(accessibilitySettings)
                }
            );

            // Show success message
            toast.success('Display settings saved successfully!');
        } catch (error) {
            console.error('Error saving display settings:', error);
            toast.error('Failed to save display settings to your profile');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Theme Settings */}
                <div>
                    <h4 className="font-semibold text-lg mb-2">Theme</h4>
                    <div className="form-control w-full max-w-xs">
                        <select
                            value={theme}
                            onChange={handleThemeChange}
                            className="select select-bordered"
                        >
                            <option value="light">Light</option>
                            <option value="dark">Dark</option>
                        </select>
                        <label className="label">
                            <span className="label-text-alt">Select your preferred theme</span>
                        </label>
                    </div>
                </div>

                {/* Font Size Settings */}
                <div>
                    <h4 className="font-semibold text-lg mb-2">Font Size</h4>
                    <div className="form-control w-full max-w-xs">
                        <select
                            value={fontSize}
                            onChange={handleFontSizeChange}
                            className="select select-bordered"
                        >
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                            <option value="extra-large">Extra Large</option>
                        </select>
                        <label className="label">
                            <span className="label-text-alt">Select your preferred font size</span>
                        </label>
                    </div>
                </div>

                {/* Accessibility Settings */}
                <div>
                    <h4 className="font-semibold text-lg mb-2">Accessibility</h4>

                    <div className="form-control">
                        <label className="cursor-pointer label justify-start gap-4">
                            <input
                                type="checkbox"
                                checked={colorBlindMode}
                                onChange={handleColorBlindModeChange}
                                className="toggle toggle-primary"
                            />
                            <div>
                                <span className="label-text font-medium">Color Blind Mode</span>
                                <p className="text-xs opacity-70">Enhances color contrast and uses color-blind friendly palettes</p>
                            </div>
                        </label>
                    </div>

                    <div className="form-control mt-2">
                        <label className="cursor-pointer label justify-start gap-4">
                            <input
                                type="checkbox"
                                checked={reducedMotion}
                                onChange={handleReducedMotionChange}
                                className="toggle toggle-primary"
                            />
                            <div>
                                <span className="label-text font-medium">Reduced Motion</span>
                                <p className="text-xs opacity-70">Minimizes animations and transitions</p>
                            </div>
                        </label>
                    </div>
                </div>

                <p className="text-sm text-info">
                    These settings are saved to your browser and your IEEE UCSD account. They will be applied whenever you log in.
                </p>

                <div className="form-control">
                    <button
                        type="submit"
                        className={`btn btn-primary ${saving ? 'loading' : ''}`}
                        disabled={saving}
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
} 