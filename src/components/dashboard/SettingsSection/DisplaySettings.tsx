import { useState, useEffect } from 'react';

export default function DisplaySettings() {
    const [theme, setTheme] = useState('dark');
    const [fontSize, setFontSize] = useState('medium');
    const [colorBlindMode, setColorBlindMode] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // Load saved preferences from localStorage on component mount
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        const savedFontSize = localStorage.getItem('fontSize') || 'medium';
        const savedColorBlindMode = localStorage.getItem('colorBlindMode') === 'true';
        const savedReducedMotion = localStorage.getItem('reducedMotion') === 'true';

        setTheme(savedTheme);
        setFontSize(savedFontSize);
        setColorBlindMode(savedColorBlindMode);
        setReducedMotion(savedReducedMotion);

        // Apply theme to document
        document.documentElement.setAttribute('data-theme', savedTheme);

        // Apply font size
        applyFontSize(savedFontSize);

        // Apply accessibility settings
        if (savedColorBlindMode) {
            document.documentElement.classList.add('color-blind-mode');
        }

        if (savedReducedMotion) {
            document.documentElement.classList.add('reduced-motion');
        }
    }, []);

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
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Show success message
        setSuccessMessage('Display settings saved successfully!');

        // Clear success message after 3 seconds
        setTimeout(() => {
            setSuccessMessage('');
        }, 3000);
    };

    return (
        <div>
            {successMessage && (
                <div className="alert alert-success mb-4">
                    <div>
                        <span>{successMessage}</span>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Theme Selection */}
                <div className="form-control">
                    <label className="label">
                        <span className="label-text font-medium">Theme</span>
                    </label>
                    <select
                        className="select select-bordered w-full"
                        value={theme}
                        onChange={handleThemeChange}
                    >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                        <option value="cupcake">Cupcake</option>
                        <option value="bumblebee">Bumblebee</option>
                        <option value="emerald">Emerald</option>
                        <option value="corporate">Corporate</option>
                        <option value="synthwave">Synthwave</option>
                        <option value="retro">Retro</option>
                        <option value="cyberpunk">Cyberpunk</option>
                        <option value="valentine">Valentine</option>
                        <option value="halloween">Halloween</option>
                        <option value="garden">Garden</option>
                        <option value="forest">Forest</option>
                        <option value="aqua">Aqua</option>
                        <option value="lofi">Lo-Fi</option>
                        <option value="pastel">Pastel</option>
                        <option value="fantasy">Fantasy</option>
                        <option value="wireframe">Wireframe</option>
                        <option value="black">Black</option>
                        <option value="luxury">Luxury</option>
                        <option value="dracula">Dracula</option>
                        <option value="cmyk">CMYK</option>
                        <option value="autumn">Autumn</option>
                        <option value="business">Business</option>
                        <option value="acid">Acid</option>
                        <option value="lemonade">Lemonade</option>
                        <option value="night">Night</option>
                        <option value="coffee">Coffee</option>
                        <option value="winter">Winter</option>
                    </select>
                    <label className="label">
                        <span className="label-text-alt">Choose a theme for your dashboard</span>
                    </label>
                </div>

                {/* Font Size */}
                <div className="form-control">
                    <label className="label">
                        <span className="label-text font-medium">Font Size</span>
                    </label>
                    <select
                        className="select select-bordered w-full"
                        value={fontSize}
                        onChange={handleFontSizeChange}
                    >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                        <option value="extra-large">Extra Large</option>
                    </select>
                    <label className="label">
                        <span className="label-text-alt">Adjust the text size for better readability</span>
                    </label>
                </div>

                {/* Accessibility Options */}
                <div className="form-control">
                    <label className="label">
                        <span className="label-text font-medium">Accessibility Options</span>
                    </label>

                    <div className="space-y-4 p-4 bg-base-200 rounded-lg">
                        <label className="cursor-pointer label justify-start gap-4">
                            <input
                                type="checkbox"
                                className="toggle toggle-primary"
                                checked={colorBlindMode}
                                onChange={handleColorBlindModeChange}
                            />
                            <div>
                                <span className="label-text font-medium">Color Blind Mode</span>
                                <p className="text-xs opacity-70">Enhances color contrast for better visibility</p>
                            </div>
                        </label>

                        <label className="cursor-pointer label justify-start gap-4">
                            <input
                                type="checkbox"
                                className="toggle toggle-primary"
                                checked={reducedMotion}
                                onChange={handleReducedMotionChange}
                            />
                            <div>
                                <span className="label-text font-medium">Reduced Motion</span>
                                <p className="text-xs opacity-70">Minimizes animations and transitions</p>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Preview */}
                <div className="form-control">
                    <label className="label">
                        <span className="label-text font-medium">Preview</span>
                    </label>
                    <div className="p-4 bg-base-200 rounded-lg">
                        <div className="card bg-base-100 shadow-md">
                            <div className="card-body">
                                <h3 className="card-title">Theme Preview</h3>
                                <p>This is how your content will look with the selected settings.</p>
                                <div className="flex gap-2 mt-2">
                                    <button className="btn btn-primary">Primary</button>
                                    <button className="btn btn-secondary">Secondary</button>
                                    <button className="btn btn-accent">Accent</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="form-control mt-6">
                    <button type="submit" className="btn btn-primary">
                        Save Settings
                    </button>
                </div>
            </form>
        </div>
    );
} 