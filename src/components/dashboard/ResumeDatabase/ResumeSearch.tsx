import { useState, useEffect } from 'react';

export default function ResumeSearch() {
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');

    // Debounce search input to avoid too many updates
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 300);

        return () => {
            clearTimeout(timer);
        };
    }, [searchQuery]);

    // When debounced query changes, dispatch event to notify parent
    useEffect(() => {
        dispatchSearchChange();
    }, [debouncedQuery]);

    const dispatchSearchChange = () => {
        window.dispatchEvent(
            new CustomEvent('resumeSearchChange', {
                detail: {
                    searchQuery: debouncedQuery
                }
            })
        );
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
    };

    return (
        <div className="relative">
            <div className="flex items-center">
                <div className="relative grow">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search by name or major..."
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-700 rounded-lg 
            bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 focus:outline-hidden 
            focus:ring-2 focus:ring-primary focus:border-transparent"
                        value={searchQuery}
                        onChange={handleSearchChange}
                    />
                    {searchQuery && (
                        <button
                            className="absolute inset-y-0 right-0 flex items-center pr-3"
                            onClick={handleClearSearch}
                        >
                            <svg className="w-5 h-5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}