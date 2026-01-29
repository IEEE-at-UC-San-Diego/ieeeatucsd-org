/**
 * Tests for Major Name Normalization Utility
 */

import {
    toTitleCase,
    normalizeMajorName,
    getUniqueNormalizedMajors,
    getMajorNormalizationMap,
    normalizeToCanonical,
    getMajorStats,
} from '../majorNormalization';

describe('toTitleCase', () => {
    it('should convert simple strings to title case', () => {
        expect(toTitleCase('computer science')).toBe('Computer Science');
        expect(toTitleCase('ELECTRICAL ENGINEERING')).toBe('Electrical Engineering');
        expect(toTitleCase('mechanical engineering')).toBe('Mechanical Engineering');
    });

    it('should keep conjunctions lowercase', () => {
        expect(toTitleCase('computer science and engineering')).toBe('Computer Science and Engineering');
        expect(toTitleCase('COMPUTER SCIENCE AND ENGINEERING')).toBe('Computer Science and Engineering');
    });

    it('should keep prepositions lowercase', () => {
        expect(toTitleCase('bachelor of science')).toBe('Bachelor of Science');
        expect(toTitleCase('master of arts in education')).toBe('Master of Arts in Education');
    });

    it('should always capitalize the first word', () => {
        expect(toTitleCase('and engineering')).toBe('And Engineering');
        expect(toTitleCase('of science')).toBe('Of Science');
    });

    it('should handle multiple spaces', () => {
        expect(toTitleCase('computer  science')).toBe('Computer  Science');
    });
});

describe('normalizeMajorName', () => {
    it('should normalize basic major names', () => {
        expect(normalizeMajorName('computer science')).toBe('Computer Science');
        expect(normalizeMajorName('ELECTRICAL ENGINEERING')).toBe('Electrical Engineering');
        expect(normalizeMajorName('  mechanical engineering  ')).toBe('Mechanical Engineering');
    });

    it('should handle empty or null values', () => {
        expect(normalizeMajorName('')).toBe('');
        expect(normalizeMajorName(null)).toBe('');
        expect(normalizeMajorName(undefined)).toBe('');
    });

    it('should normalize multiple spaces', () => {
        expect(normalizeMajorName('computer   science')).toBe('Computer Science');
    });

    it('should handle conjunctions properly', () => {
        expect(normalizeMajorName('computer science and engineering')).toBe('Computer Science and Engineering');
        expect(normalizeMajorName('Computer Science And Engineering')).toBe('Computer Science and Engineering');
    });
});

describe('getUniqueNormalizedMajors', () => {
    it('should return unique normalized majors', () => {
        const majors = [
            'computer science',
            'Computer Science',
            'COMPUTER SCIENCE',
            'electrical engineering',
            'Electrical Engineering'
        ];
        const result = getUniqueNormalizedMajors(majors);
        expect(result).toHaveLength(2);
        expect(result).toContain('Computer Science');
        expect(result).toContain('Electrical Engineering');
    });

    it('should merge similar majors with fuzzy matching', () => {
        const majors = [
            'Computer Science',
            'Comp Sci',
            'Computer Sci',
            'Electrical Engineering',
            'Elec Engineering'
        ];
        const result = getUniqueNormalizedMajors(majors, 0.7);
        // With 70% similarity threshold, similar majors should be merged
        expect(result.length).toBeLessThan(majors.length);
    });

    it('should filter out null and undefined values', () => {
        const majors = [
            'Computer Science',
            null,
            undefined,
            '',
            'Electrical Engineering'
        ];
        const result = getUniqueNormalizedMajors(majors);
        expect(result).toHaveLength(2);
    });

    it('should return sorted results', () => {
        const majors = [
            'Mechanical Engineering',
            'Computer Science',
            'Electrical Engineering'
        ];
        const result = getUniqueNormalizedMajors(majors);
        expect(result[0]).toBe('Computer Science');
        expect(result[1]).toBe('Electrical Engineering');
        expect(result[2]).toBe('Mechanical Engineering');
    });
});

describe('getMajorNormalizationMap', () => {
    it('should create a mapping from variants to canonical forms', () => {
        const majors = [
            'computer science',
            'Computer Science',
            'COMPUTER SCIENCE',
            'electrical engineering'
        ];
        const map = getMajorNormalizationMap(majors);
        
        expect(map.get('Computer Science')).toBe('Computer Science');
        expect(map.get('Electrical Engineering')).toBe('Electrical Engineering');
    });

    it('should map similar majors to the same canonical form', () => {
        const majors = [
            'Computer Science',
            'Computer Science',
            'Computer Science',
            'Comp Sci'
        ];
        const map = getMajorNormalizationMap(majors, 0.7);
        
        // The most common version should be the canonical form
        const canonical = map.get('Computer Science');
        expect(canonical).toBe('Computer Science');
    });
});

describe('normalizeToCanonical', () => {
    it('should normalize to canonical form from known majors', () => {
        const knownMajors = [
            'Computer Science',
            'Computer Science',
            'Electrical Engineering'
        ];
        
        expect(normalizeToCanonical('computer science', knownMajors)).toBe('Computer Science');
        expect(normalizeToCanonical('COMPUTER SCIENCE', knownMajors)).toBe('Computer Science');
    });

    it('should return normalized form for unknown majors', () => {
        const knownMajors = ['Computer Science'];
        
        expect(normalizeToCanonical('mechanical engineering', knownMajors)).toBe('Mechanical Engineering');
    });

    it('should handle empty values', () => {
        const knownMajors = ['Computer Science'];
        
        expect(normalizeToCanonical('', knownMajors)).toBe('');
        expect(normalizeToCanonical(null, knownMajors)).toBe('');
        expect(normalizeToCanonical(undefined, knownMajors)).toBe('');
    });
});

describe('getMajorStats', () => {
    it('should return statistics about majors', () => {
        const majors = [
            'Computer Science',
            'computer science',
            'COMPUTER SCIENCE',
            'Electrical Engineering',
            'electrical engineering'
        ];
        
        const stats = getMajorStats(majors);
        expect(stats).toHaveLength(2);
        
        const csStats = stats.find(s => s.canonical === 'Computer Science');
        expect(csStats).toBeDefined();
        expect(csStats?.count).toBe(3);
        expect(csStats?.variants).toContain('Computer Science');
    });

    it('should sort by count descending', () => {
        const majors = [
            'Computer Science',
            'Computer Science',
            'Computer Science',
            'Electrical Engineering',
            'Mechanical Engineering',
            'Mechanical Engineering'
        ];
        
        const stats = getMajorStats(majors);
        expect(stats[0].canonical).toBe('Computer Science');
        expect(stats[0].count).toBe(3);
    });

    it('should handle empty input', () => {
        const stats = getMajorStats([]);
        expect(stats).toHaveLength(0);
    });

    it('should filter out null and undefined', () => {
        const majors = [
            'Computer Science',
            null,
            undefined,
            '',
            'Computer Science'
        ];
        
        const stats = getMajorStats(majors);
        expect(stats).toHaveLength(1);
        expect(stats[0].count).toBe(2);
    });
});

describe('Real-world examples', () => {
    it('should handle common engineering major variations', () => {
        const majors = [
            'electrical engineering',
            'Electrical Engineering',
            'ELECTRICAL ENGINEERING',
            'Elec Eng',
            'computer science and engineering',
            'Computer Science And Engineering',
            'Computer Science and Engineering'
        ];
        
        const unique = getUniqueNormalizedMajors(majors, 0.8);
        
        // Should have normalized versions
        expect(unique).toContain('Computer Science and Engineering');
        
        // Conjunctions should be lowercase
        const cse = unique.find(m => m.includes('Computer Science'));
        expect(cse).toContain('and');
        expect(cse).not.toContain('And');
    });

    it('should handle degree types with prepositions', () => {
        const majors = [
            'bachelor of science',
            'Bachelor Of Science',
            'BACHELOR OF SCIENCE',
            'master of arts in education',
            'Master Of Arts In Education'
        ];
        
        const unique = getUniqueNormalizedMajors(majors);
        
        expect(unique).toContain('Bachelor of Science');
        expect(unique).toContain('Master of Arts in Education');
        
        // Prepositions should be lowercase
        unique.forEach(major => {
            if (major.includes(' of ')) {
                expect(major).toContain(' of ');
                expect(major).not.toContain(' Of ');
            }
            if (major.includes(' in ')) {
                expect(major).toContain(' in ');
                expect(major).not.toContain(' In ');
            }
        });
    });
});

