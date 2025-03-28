import { ThemeService } from "../scripts/database/ThemeService";

/**
 * Initialize theme settings from IndexedDB
 * This function can be used in client-side scripts
 */
export const initializeTheme = async (): Promise<void> => {
  // Check if we're in a browser environment
  if (typeof window === "undefined") return;
  
  try {
    const themeService = ThemeService.getInstance();
    await themeService.initializeTheme();
  } catch (error) {
    console.error("Error initializing theme:", error);
    // Apply default theme if there's an error
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }
};

/**
 * Get the current theme
 * @returns The current theme ('light' or 'dark')
 */
export const getCurrentTheme = (): 'light' | 'dark' => {
  // Check if we're in a browser environment
  if (typeof document === "undefined") return 'dark';
  
  const theme = document.documentElement.getAttribute("data-theme");
  return (theme === 'light' ? 'light' : 'dark');
};

/**
 * Toggle between light and dark themes
 */
export const toggleTheme = async (): Promise<void> => {
  // Check if we're in a browser environment
  if (typeof window === "undefined") return;
  
  try {
    const themeService = ThemeService.getInstance();
    const settings = await themeService.getThemeSettings();
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    await themeService.updateThemeSetting('theme', newTheme);
  } catch (error) {
    console.error("Error toggling theme:", error);
  }
};