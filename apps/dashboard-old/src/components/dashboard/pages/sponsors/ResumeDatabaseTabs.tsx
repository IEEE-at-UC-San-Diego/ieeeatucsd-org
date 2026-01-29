import React, { useState } from 'react';
import { FileText, Building2 } from 'lucide-react';

interface Tab {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}

interface ResumeDatabaseTabsProps {
    children: React.ReactNode[];
}

const tabs: Tab[] = [
    { id: 'resumes', label: 'Resume Database', icon: FileText },
    { id: 'info', label: 'Sponsor Information', icon: Building2 },
];

export default function ResumeDatabaseTabs({ children }: ResumeDatabaseTabsProps) {
    const [activeTab, setActiveTab] = useState('resumes');

    return (
        <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                                    ${isActive
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                `}
                            >
                                <Icon
                                    className={`
                                        -ml-0.5 mr-2 h-5 w-5
                                        ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
                                    `}
                                />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === 'resumes' && children[0]}
                {activeTab === 'info' && children[1]}
            </div>
        </div>
    );
}

