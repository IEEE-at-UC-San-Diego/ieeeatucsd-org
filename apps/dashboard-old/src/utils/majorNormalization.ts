/**
 * Major Name Normalization Utility
 * 
 * Provides intelligent major name normalization and deduplication with:
 * - Fuzzy matching using Levenshtein distance
 * - Title case capitalization with proper conjunction handling
 * - Deduplication of similar major names
 */

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching of major names
 */
function levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[len1][len2];
}

/**
 * Calculate similarity percentage between two strings
 * Returns a value between 0 and 1
 */
function calculateSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;
    
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    return 1 - (distance / maxLength);
}

/**
 * Words that should remain lowercase in title case (conjunctions, prepositions, articles)
 */
const LOWERCASE_WORDS = new Set([
    'and', 'or', 'but', 'nor', 'for', 'yet', 'so',  // Conjunctions
    'of', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by', 'about', 'as', 'into', 'through', // Prepositions
    'a', 'an', 'the'  // Articles
]);

/**
 * Convert a string to title case with proper conjunction handling
 * Example: "computer science and engineering" -> "Computer Science and Engineering"
 */
export function toTitleCase(str: string): string {
    if (!str) return str;

    return str
        .toLowerCase()
        .split(/\s+/)
        .map((word, index) => {
            // Always capitalize the first word
            if (index === 0) {
                return word.charAt(0).toUpperCase() + word.slice(1);
            }
            
            // Keep conjunctions, prepositions, and articles lowercase
            if (LOWERCASE_WORDS.has(word)) {
                return word;
            }
            
            // Capitalize all other words
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
}

/**
 * Normalize a major name with title case and trimming
 */
export function normalizeMajorName(major: string | undefined | null): string {
    if (!major) return '';
    
    // Trim whitespace and normalize multiple spaces
    const trimmed = major.trim().replace(/\s+/g, ' ');
    
    // Apply title case
    return toTitleCase(trimmed);
}

/**
 * Find the canonical (most common) version of a major name from a group of similar majors
 */
function findCanonicalMajor(majors: string[]): string {
    if (majors.length === 0) return '';
    if (majors.length === 1) return majors[0];

    // Count occurrences of each exact major name
    const counts = new Map<string, number>();
    majors.forEach(major => {
        counts.set(major, (counts.get(major) || 0) + 1);
    });

    // Find the most common version
    let maxCount = 0;
    let canonical = majors[0];
    
    counts.forEach((count, major) => {
        if (count > maxCount) {
            maxCount = count;
            canonical = major;
        }
    });

    return canonical;
}

/**
 * Group similar major names together using fuzzy matching
 * Returns a map where keys are canonical major names and values are arrays of similar majors
 */
export function groupSimilarMajors(
    majors: string[],
    similarityThreshold: number = 0.8
): Map<string, string[]> {
    const normalized = majors.map(m => normalizeMajorName(m)).filter(m => m !== '');
    const groups = new Map<string, string[]>();
    const processed = new Set<string>();

    normalized.forEach(major => {
        if (processed.has(major)) return;

        // Find all similar majors
        const similarMajors = normalized.filter(other => {
            if (processed.has(other)) return false;
            if (major === other) return true;
            
            const similarity = calculateSimilarity(major, other);
            return similarity >= similarityThreshold;
        });

        // Mark all similar majors as processed
        similarMajors.forEach(m => processed.add(m));

        // Find canonical version (most common)
        const canonical = findCanonicalMajor(similarMajors);
        groups.set(canonical, similarMajors);
    });

    return groups;
}

/**
 * Get a mapping from any major variant to its canonical form
 */
export function getMajorNormalizationMap(
    majors: string[],
    similarityThreshold: number = 0.8
): Map<string, string> {
    const groups = groupSimilarMajors(majors, similarityThreshold);
    const normalizationMap = new Map<string, string>();

    groups.forEach((variants, canonical) => {
        variants.forEach(variant => {
            normalizationMap.set(variant, canonical);
        });
    });

    return normalizationMap;
}

/**
 * Get unique normalized majors from a list, with deduplication
 */
export function getUniqueNormalizedMajors(
    majors: (string | undefined | null)[],
    similarityThreshold: number = 0.8
): string[] {
    // Filter out null/undefined and normalize
    const validMajors = majors
        .filter((m): m is string => m != null && m !== '')
        .map(m => normalizeMajorName(m))
        .filter(m => m !== '');

    // Group similar majors
    const groups = groupSimilarMajors(validMajors, similarityThreshold);
    
    // Return canonical versions, sorted alphabetically
    return Array.from(groups.keys()).sort();
}

/**
 * Normalize a major name and find its canonical form from a list of known majors
 */
export function normalizeToCanonical(
    major: string | undefined | null,
    knownMajors: string[],
    similarityThreshold: number = 0.8
): string {
    const normalized = normalizeMajorName(major);
    if (!normalized) return '';

    // Get normalization map
    const normalizationMap = getMajorNormalizationMap(knownMajors, similarityThreshold);
    
    // Return canonical form if found, otherwise return normalized version
    return normalizationMap.get(normalized) || normalized;
}

/**
 * Interface for major statistics
 */
export interface MajorStats {
    canonical: string;
    count: number;
    variants: string[];
}

/**
 * Get statistics about majors including counts and variants
 */
export function getMajorStats(
    majors: (string | undefined | null)[],
    similarityThreshold: number = 0.8
): MajorStats[] {
    const validMajors = majors
        .filter((m): m is string => m != null && m !== '')
        .map(m => normalizeMajorName(m))
        .filter(m => m !== '');

    const groups = groupSimilarMajors(validMajors, similarityThreshold);
    
    return Array.from(groups.entries())
        .map(([canonical, variants]) => ({
            canonical,
            count: variants.length,
            variants: Array.from(new Set(variants)).sort()
        }))
        .sort((a, b) => b.count - a.count); // Sort by count descending
}

