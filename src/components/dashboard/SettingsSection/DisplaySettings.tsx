import { useState, useEffect } from 'react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { Update } from '../../../scripts/pocketbase/Update';
import { Collections } from '../../../schemas/pocketbase/schema';
import { toast } from 'react-hot-toast';
import { ThemeService, DEFAULT_THEME_SETTINGS, type ThemeSettings } from '../../../scripts/database/ThemeService';

export default function DisplaySettings() {
    const auth = Authentication.getInstance();
    const update = Update.getInstance();
    const themeService = ThemeService.getInstance();

    // Current applied settings
    const [currentSettings, setCurrentSettings] = useState<ThemeSettings | null>(null);

    // Form state (unsaved changes)
    const [theme, setTheme] = useState<'light' | 'dark'>(DEFAULT_THEME_SETTINGS.theme);
    const [fontSize, setFontSize] = useState(DEFAULT_THEME_SETTINGS.fontSize);
    const [colorBlindMode, setColorBlindMode] = useState(DEFAULT_THEME_SETTINGS.colorBlindMode);
    const [reducedMotion, setReducedMotion] = useState(DEFAULT_THEME_SETTINGS.reducedMotion);
    const [saving, setSaving] = useState(false);

    // Track if form has unsaved changes
    const [hasChanges, setHasChanges] = useState(false);

    // Load saved preferences on component mount
    useEffect(() => {
        const loadPreferences = async () => {
            try {
                // First load theme settings from IndexedDB
                const themeSettings = await themeService.getThemeSettings();

                // Store current settings
                setCurrentSettings(themeSettings);

                // Set form state from theme settings
                setTheme(themeSettings.theme);
                setFontSize(themeSettings.fontSize);
                setColorBlindMode(themeSettings.colorBlindMode);
                setReducedMotion(themeSettings.reducedMotion);

                // Reset changes flag
                setHasChanges(false);

                // Then check if user has saved preferences in their profile
                const user = auth.getCurrentUser();
                if (user) {
                    let needsDisplayPrefsUpdate = false;
                    let needsAccessibilityUpdate = false;

                    // Check and handle display preferences
                    if (user.display_preferences && typeof user.display_preferences === 'string' && user.display_preferences.trim() !== '') {
                        try {
                            const userPrefs = JSON.parse(user.display_preferences);

                            // Only update if values exist and are different from IndexedDB
                            if (userPrefs.theme && ['light', 'dark'].includes(userPrefs.theme) && userPrefs.theme !== themeSettings.theme) {
                                setTheme(userPrefs.theme as 'light' | 'dark');
                                // Don't update theme service yet, wait for save
                                setHasChanges(true);
                            } else if (!['light', 'dark'].includes(userPrefs.theme)) {
                                // If theme is not valid, mark for update
                                needsDisplayPrefsUpdate = true;
                            }

                            if (userPrefs.fontSize && userPrefs.fontSize !== themeSettings.fontSize) {
                                setFontSize(userPrefs.fontSize);
                                // Don't update theme service yet, wait for save
                                setHasChanges(true);
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
                                accessibilityPrefs.colorBlindMode !== themeSettings.colorBlindMode) {
                                setColorBlindMode(accessibilityPrefs.colorBlindMode);
                                // Don't update theme service yet, wait for save
                                setHasChanges(true);
                            }

                            if (typeof accessibilityPrefs.reducedMotion === 'boolean' &&
                                accessibilityPrefs.reducedMotion !== themeSettings.reducedMotion) {
                                setReducedMotion(accessibilityPrefs.reducedMotion);
                                // Don't update theme service yet, wait for save
                                setHasChanges(true);
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

    // Check for changes when form values change
    useEffect(() => {
        if (!currentSettings) return;

        const hasThemeChanged = theme !== currentSettings.theme;
        const hasFontSizeChanged = fontSize !== currentSettings.fontSize;
        const hasColorBlindModeChanged = colorBlindMode !== currentSettings.colorBlindMode;
        const hasReducedMotionChanged = reducedMotion !== currentSettings.reducedMotion;

        setHasChanges(
            hasThemeChanged ||
            hasFontSizeChanged ||
            hasColorBlindModeChanged ||
            hasReducedMotionChanged
        );
    }, [theme, fontSize, colorBlindMode, reducedMotion, currentSettings]);

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
            }
        } catch (error) {
            console.error('Error initializing default settings:', error);
        }
    };

    // Handle theme change
    const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTheme = e.target.value as 'light' | 'dark';
        setTheme(newTheme);
        // Changes will be applied on save
    };

    // Handle font size change
    const handleFontSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = e.target.value as 'small' | 'medium' | 'large' | 'extra-large';
        setFontSize(newSize);
        // Changes will be applied on save
    };

    // Handle color blind mode toggle
    const handleColorBlindModeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const enabled = e.target.checked;
        setColorBlindMode(enabled);
        // Changes will be applied on save
    };

    // Handle reduced motion toggle
    const handleReducedMotionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const enabled = e.target.checked;
        setReducedMotion(enabled);
        // Changes will be applied on save
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

            // First update IndexedDB with the new settings
            await themeService.saveThemeSettings({
                id: "current",
                theme,
                fontSize,
                colorBlindMode,
                reducedMotion,
                updatedAt: Date.now()
            });

            // Then update user record in PocketBase
            await update.updateFields(
                Collections.USERS,
                user.id,
                {
                    display_preferences: JSON.stringify(displayPreferences),
                    accessibility_settings: JSON.stringify(accessibilitySettings)
                }
            );

            // Update current settings state to match the new settings
            setCurrentSettings({
                id: "current",
                theme,
                fontSize,
                colorBlindMode,
                reducedMotion,
                updatedAt: Date.now()
            });

            // Reset changes flag
            setHasChanges(false);

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
                    These settings are saved to your browser using IndexedDB and your IEEE UCSD account. They will be applied whenever you log in.
                </p>

                <div className="form-control">
                    <div className="flex flex-col gap-2">
                        {hasChanges && (
                            <p className="text-sm text-warning">
                                You have unsaved changes. Click "Save Settings" to apply them.
                            </p>
                        )}
                        <button
                            type="submit"
                            className={`btn btn-primary ${saving ? 'loading' : ''}`}
                            disabled={saving || !hasChanges}
                        >
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}