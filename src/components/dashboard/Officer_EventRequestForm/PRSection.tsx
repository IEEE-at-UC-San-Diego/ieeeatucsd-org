import React, { useState } from 'react';

interface PRSectionProps {
    onDataChange?: (data: any) => void;
}

const PRSection: React.FC<PRSectionProps> = ({ onDataChange }) => {
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [selectedLogos, setSelectedLogos] = useState<string[]>([]);

    const flyerTypes = [
        { value: 'digital_with_social', label: 'Digital flyer (with social media advertising: Facebook, Instagram, Discord)' },
        { value: 'digital_no_social', label: 'Digital flyer (with NO social media advertising)' },
        { value: 'physical_with_advertising', label: 'Physical flyer (with advertising)' },
        { value: 'physical_no_advertising', label: 'Physical flyer (with NO advertising)' },
        { value: 'newsletter', label: 'Newsletter (IEEE, ECE, IDEA)' },
        { value: 'other', label: 'Other' }
    ];

    const logoOptions = [
        { value: 'IEEE', label: 'IEEE' },
        { value: 'AS', label: 'AS' },
        { value: 'HKN', label: 'HKN' },
        { value: 'TESC', label: 'TESC' },
        { value: 'PIB', label: 'PIB' },
        { value: 'TNT', label: 'TNT' },
        { value: 'SWE', label: 'SWE' },
        { value: 'OTHER', label: 'OTHER' }
    ];

    const handleTypeChange = (value: string) => {
        const newTypes = selectedTypes.includes(value)
            ? selectedTypes.filter(type => type !== value)
            : [...selectedTypes, value];
        setSelectedTypes(newTypes);

        if (onDataChange) {
            onDataChange({ flyer_type: newTypes });
        }
    };

    const handleLogoChange = (value: string) => {
        const newLogos = selectedLogos.includes(value)
            ? selectedLogos.filter(logo => logo !== value)
            : [...selectedLogos, value];
        setSelectedLogos(newLogos);

        if (onDataChange) {
            onDataChange({ required_logos: newLogos });
        }
    };

    return (
        <div className="card bg-base-100/95 backdrop-blur-md shadow-lg">
            <div className="card-body">
                <h2 className="card-title text-xl mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    PR Materials
                </h2>

                <div className="space-y-4 mt-4">
                    <label className="form-control w-full">
                        <div className="label">
                            <span className="label-text font-medium text-lg flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Type of material needed
                            </span>
                        </div>
                        <div className="space-y-2">
                            {flyerTypes.map(type => (
                                <label key={type.value} className="label cursor-pointer justify-start gap-3 hover:bg-base-200/50 p-4 rounded-lg transition-colors duration-300">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-primary"
                                        checked={selectedTypes.includes(type.value)}
                                        onChange={() => handleTypeChange(type.value)}
                                    />
                                    <span className="label-text">{type.label}</span>
                                </label>
                            ))}
                        </div>
                    </label>
                </div>

                {selectedTypes.length > 0 && (
                    <>
                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text font-medium text-lg flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Advertising Start Date
                                </span>
                            </label>
                            <input
                                type="datetime-local"
                                name="flyer_advertising_start_date"
                                className="input input-bordered w-full"
                                onChange={(e) => onDataChange?.({ flyer_advertising_start_date: e.target.value })}
                            />
                        </div>

                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text font-medium text-lg flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Logos Required
                                </span>
                            </label>
                            <div className="space-y-2">
                                {logoOptions.map(logo => (
                                    <label key={logo.value} className="label cursor-pointer justify-start gap-3 hover:bg-base-200/50 p-4 rounded-lg transition-colors duration-300">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-primary"
                                            checked={selectedLogos.includes(logo.value)}
                                            onChange={() => handleLogoChange(logo.value)}
                                        />
                                        <span className="label-text">{logo.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {selectedLogos.includes('OTHER') && (
                            <div className="form-control w-full">
                                <label className="label">
                                    <span className="label-text font-medium text-lg flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        Upload Logo Files
                                    </span>
                                </label>
                                <input
                                    type="file"
                                    name="other_logos"
                                    multiple
                                    accept="image/*"
                                    className="file-input file-input-bordered w-full"
                                    onChange={(e) => onDataChange?.({ other_logos: e.target.files })}
                                />
                            </div>
                        )}

                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text font-medium text-lg flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Format Needed
                                </span>
                            </label>
                            <select
                                name="advertising_format"
                                className="select select-bordered w-full"
                                onChange={(e) => onDataChange?.({ advertising_format: e.target.value })}
                            >
                                <option value="">Select a format...</option>
                                <option value="pdf">PDF</option>
                                <option value="png">PNG</option>
                                <option value="jpeg">JPG</option>
                                <option value="does_not_matter">DOES NOT MATTER</option>
                            </select>
                        </div>

                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text font-medium text-lg flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Additional Specifications
                                </span>
                            </label>
                            <textarea
                                name="flyer_additional_requests"
                                className="textarea textarea-bordered h-32"
                                placeholder="Color scheme, overall design, examples to consider..."
                                onChange={(e) => onDataChange?.({ flyer_additional_requests: e.target.value })}
                            />
                        </div>

                        <div className="form-control w-full">
                            <label className="label">
                                <span className="label-text font-medium text-lg flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Photography Needed
                                </span>
                            </label>
                            <div className="flex gap-4">
                                <label className="label cursor-pointer justify-start gap-3 hover:bg-base-200/50 p-4 rounded-lg transition-colors duration-300">
                                    <input
                                        type="radio"
                                        name="photography_needed"
                                        value="true"
                                        className="radio radio-primary"
                                        onChange={(e) => onDataChange?.({ photography_needed: e.target.value === 'true' })}
                                    />
                                    <span className="label-text">Yes</span>
                                </label>
                                <label className="label cursor-pointer justify-start gap-3 hover:bg-base-200/50 p-4 rounded-lg transition-colors duration-300">
                                    <input
                                        type="radio"
                                        name="photography_needed"
                                        value="false"
                                        className="radio radio-primary"
                                        onChange={(e) => onDataChange?.({ photography_needed: e.target.value === 'true' })}
                                    />
                                    <span className="label-text">No</span>
                                </label>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PRSection; 