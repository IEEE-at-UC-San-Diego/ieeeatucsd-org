import { useState, useEffect } from 'react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { User } from '../../../schemas/pocketbase/schema';
import { Authentication } from '../../../scripts/pocketbase/Authentication';

export default function ResumeFilters() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [majors, setMajors] = useState<string[]>([]);
    const [graduationYears, setGraduationYears] = useState<number[]>([]);

    // Filter state
    const [selectedMajor, setSelectedMajor] = useState<string>('all');
    const [selectedGraduationYear, setSelectedGraduationYear] = useState<string>('all');

    const get = Get.getInstance();
    const auth = Authentication.getInstance();

    useEffect(() => {
        loadFilterOptions();

        // Listen for refresh requests
        const handleRefresh = () => {
            loadFilterOptions();
        };

        window.addEventListener('resumeDatabaseRefresh', handleRefresh);

        return () => {
            window.removeEventListener('resumeDatabaseRefresh', handleRefresh);
        };
    }, []);

    // When filters change, dispatch event to notify parent
    useEffect(() => {
        dispatchFilterChange();
    }, [selectedMajor, selectedGraduationYear]);

    const loadFilterOptions = async () => {
        try {
            setLoading(true);

            // Get all users with resumes
            const filter = "resume != null && resume != ''";
            const users = await get.getAll<User>(Collections.USERS, filter);

            // Extract unique majors
            const uniqueMajors = new Set<string>();
            users.forEach(user => {
                if (user.major) {
                    uniqueMajors.add(user.major);
                }
            });

            // Extract unique graduation years
            const uniqueGradYears = new Set<number>();
            users.forEach(user => {
                if (user.graduation_year) {
                    uniqueGradYears.add(user.graduation_year);
                }
            });

            // Sort majors alphabetically
            const sortedMajors = Array.from(uniqueMajors).sort();

            // Sort graduation years in ascending order
            const sortedGradYears = Array.from(uniqueGradYears).sort((a, b) => a - b);

            setMajors(sortedMajors);
            setGraduationYears(sortedGradYears);
        } catch (err) {
            console.error('Error loading filter options:', err);
            setError('Failed to load filter options');
        } finally {
            setLoading(false);
        }
    };

    const dispatchFilterChange = () => {
        window.dispatchEvent(
            new CustomEvent('resumeFilterChange', {
                detail: {
                    major: selectedMajor,
                    graduationYear: selectedGraduationYear
                }
            })
        );
    };

    const handleMajorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedMajor(e.target.value);
    };

    const handleGraduationYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedGraduationYear(e.target.value);
    };

    const handleResetFilters = () => {
        setSelectedMajor('all');
        setSelectedGraduationYear('all');
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="alert alert-error">
                <div className="flex-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <label>{error}</label>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Major Filter */}
            <div className="form-control">
                <label className="label">
                    <span className="label-text">Major</span>
                </label>
                <select
                    className="select select-bordered w-full"
                    value={selectedMajor}
                    onChange={handleMajorChange}
                >
                    <option value="all">All Majors</option>
                    {majors.map(major => (
                        <option key={major} value={major}>{major}</option>
                    ))}
                </select>
            </div>

            {/* Graduation Year Filter */}
            <div className="form-control">
                <label className="label">
                    <span className="label-text">Graduation Year</span>
                </label>
                <select
                    className="select select-bordered w-full"
                    value={selectedGraduationYear}
                    onChange={handleGraduationYearChange}
                >
                    <option value="all">All Years</option>
                    {graduationYears.map(year => (
                        <option key={year} value={year}>{year}</option>
                    ))}
                </select>
            </div>

            {/* Reset Filters Button */}
            <div className="form-control mt-6">
                <button
                    className="btn btn-outline btn-sm"
                    onClick={handleResetFilters}
                >
                    Reset Filters
                </button>
            </div>
        </div>
    );
}