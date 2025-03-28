import Dexie from "dexie";
import { DexieService } from "./DexieService";

// Check if we're in a browser environment
const isBrowser =
  typeof window !== "undefined" && typeof window.indexedDB !== "undefined";

// Interface for theme settings
export interface ThemeSettings {
  id: string;
  theme: "light" | "dark";
  fontSize: "small" | "medium" | "large" | "extra-large";
  colorBlindMode: boolean;
  reducedMotion: boolean;
  updatedAt: number;
}

// Default theme settings
export const DEFAULT_THEME_SETTINGS: Omit<ThemeSettings, "id" | "updatedAt"> = {
  theme: "dark",
  fontSize: "medium",
  colorBlindMode: false,
  reducedMotion: false,
};

/**
 * Service for managing theme settings using IndexedDB
 */
export class ThemeService {
  private static instance: ThemeService;
  private dexieService: DexieService;

  private constructor() {
    this.dexieService = DexieService.getInstance();
    
    // Initialize the theme table if it doesn't exist
    if (isBrowser) {
      const db = this.dexieService.getDB();
      
      // Add theme table if it doesn't exist in the schema
      if (!db.tables.some(table => table.name === "themeSettings")) {
        db.version(db.verno + 1).stores({
          themeSettings: "id, theme, fontSize, updatedAt"
        });
      }
    }
  }

  public static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  /**
   * Get the current theme settings
   * @returns The current theme settings or default settings if none exist
   */
  public async getThemeSettings(): Promise<ThemeSettings> {
    if (!isBrowser) {
      return {
        id: "default",
        ...DEFAULT_THEME_SETTINGS,
        updatedAt: Date.now(),
      };
    }

    try {
      const db = this.dexieService.getDB();
      
      // Check if themeSettings table exists
      if (!db.tables.some(table => table.name === "themeSettings")) {
        return {
          id: "default",
          ...DEFAULT_THEME_SETTINGS,
          updatedAt: Date.now(),
        };
      }
      
      // Get the theme settings
      const settings = await db.table("themeSettings").get("current");
      
      if (!settings) {
        // If no settings exist, create default settings
        const defaultSettings: ThemeSettings = {
          id: "current",
          ...DEFAULT_THEME_SETTINGS,
          updatedAt: Date.now(),
        };
        
        await this.saveThemeSettings(defaultSettings);
        return defaultSettings;
      }
      
      return settings;
    } catch (error) {
      console.error("Error getting theme settings:", error);
      
      // Return default settings if there's an error
      return {
        id: "default",
        ...DEFAULT_THEME_SETTINGS,
        updatedAt: Date.now(),
      };
    }
  }

  /**
   * Save theme settings to IndexedDB
   * @param settings The theme settings to save
   */
  public async saveThemeSettings(settings: ThemeSettings): Promise<void> {
    if (!isBrowser) return;

    try {
      const db = this.dexieService.getDB();
      
      // Check if themeSettings table exists
      if (!db.tables.some(table => table.name === "themeSettings")) {
        return;
      }
      
      // Update the updatedAt timestamp
      settings.updatedAt = Date.now();
      
      // Save the settings
      await db.table("themeSettings").put(settings);
      
      // Apply the theme to the document
      this.applyThemeToDocument(settings);
    } catch (error) {
      console.error("Error saving theme settings:", error);
    }
  }

  /**
   * Update a specific theme setting
   * @param key The setting key to update
   * @param value The new value
   */
  public async updateThemeSetting<K extends keyof Omit<ThemeSettings, "id" | "updatedAt">>(
    key: K,
    value: ThemeSettings[K]
  ): Promise<void> {
    if (!isBrowser) return;

    try {
      // Get current settings
      const currentSettings = await this.getThemeSettings();
      
      // Update the specific setting
      const updatedSettings: ThemeSettings = {
        ...currentSettings,
        [key]: value,
        updatedAt: Date.now(),
      };
      
      // Save the updated settings
      await this.saveThemeSettings(updatedSettings);
    } catch (error) {
      console.error(`Error updating theme setting ${key}:`, error);
    }
  }

  /**
   * Apply theme settings to the document
   * @param settings The theme settings to apply
   */
  public applyThemeToDocument(settings: ThemeSettings): void {
    if (!isBrowser) return;

    // Get current theme before applying new one
    const oldTheme = document.documentElement.getAttribute("data-theme");

    // Apply theme
    document.documentElement.setAttribute("data-theme", settings.theme);

    // Apply font size
    document.documentElement.classList.remove("text-sm", "text-base", "text-lg", "text-xl");
    switch (settings.fontSize) {
      case "small":
        document.documentElement.classList.add("text-sm");
        break;
      case "medium":
        document.documentElement.classList.add("text-base");
        break;
      case "large":
        document.documentElement.classList.add("text-lg");
        break;
      case "extra-large":
        document.documentElement.classList.add("text-xl");
        break;
    }

    // Apply accessibility settings
    if (settings.colorBlindMode) {
      document.documentElement.classList.add("color-blind-mode");
    } else {
      document.documentElement.classList.remove("color-blind-mode");
    }

    if (settings.reducedMotion) {
      document.documentElement.classList.add("reduced-motion");
    } else {
      document.documentElement.classList.remove("reduced-motion");
    }
    
    // Dispatch theme change event if theme changed
    if (oldTheme !== settings.theme) {
      const event = new CustomEvent('themechange', {
        detail: {
          oldTheme,
          newTheme: settings.theme
        }
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * Initialize theme from IndexedDB or create default settings
   * This should be called on app startup
   */
  public async initializeTheme(): Promise<void> {
    if (!isBrowser) return;

    try {
      const settings = await this.getThemeSettings();
      this.applyThemeToDocument(settings);
    } catch (error) {
      console.error("Error initializing theme:", error);
      
      // Apply default theme if there's an error
      document.documentElement.setAttribute("data-theme", DEFAULT_THEME_SETTINGS.theme);
    }
  }
}