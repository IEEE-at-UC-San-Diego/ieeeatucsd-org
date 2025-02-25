import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { EventRequestFormData } from './EventRequestForm';

// Animation variants
const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 300,
            damping: 24
        }
    }
};

// Flyer type options
const FLYER_TYPES = [
    { value: 'digital_with_social', label: 'Digital flyer (with social media advertising: Facebook, Instagram, Discord)' },
    { value: 'digital_no_social', label: 'Digital flyer (with NO social media advertising)' },
    { value: 'physical_with_advertising', label: 'Physical flyer (with advertising)' },
    { value: 'physical_no_advertising', label: 'Physical flyer (with NO advertising)' },
    { value: 'newsletter', label: 'Newsletter (IEEE, ECE, IDEA)' },
    { value: 'other', label: 'Other' }
];

// Logo options
const LOGO_OPTIONS = [
    { value: 'IEEE', label: 'IEEE' },
    { value: 'AS', label: 'AS (required if funded by AS)' },
    { value: 'HKN', label: 'HKN' },
    { value: 'TESC', label: 'TESC' },
    { value: 'PIB', label: 'PIB' },
    { value: 'TNT', label: 'TNT' },
    { value: 'SWE', label: 'SWE' },
    { value: 'OTHER', label: 'OTHER (please upload transparent logo files)' }
];

// Format options
const FORMAT_OPTIONS = [
    { value: 'pdf', label: 'PDF' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'png', label: 'PNG' },
    { value: 'does_not_matter', label: 'DOES NOT MATTER' }
];

interface PRSectionProps {
    formData: EventRequestFormData;
    onDataChange: (data: Partial<EventRequestFormData>) => void;
}

const PRSection: React.FC<PRSectionProps> = ({ formData, onDataChange }) => {
    const [otherLogoFiles, setOtherLogoFiles] = useState<File[]>(formData.other_logos || []);

    // Handle checkbox change for flyer types
    const handleFlyerTypeChange = (type: string) => {
        const updatedTypes = formData.flyer_type.includes(type)
            ? formData.flyer_type.filter(t => t !== type)
            : [...formData.flyer_type, type];

        onDataChange({ flyer_type: updatedTypes });
    };

    // Handle checkbox change for required logos
    const handleLogoChange = (logo: string) => {
        const updatedLogos = formData.required_logos.includes(logo)
            ? formData.required_logos.filter(l => l !== logo)
            : [...formData.required_logos, logo];

        onDataChange({ required_logos: updatedLogos });
    };

    // Handle file upload for other logos
    const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setOtherLogoFiles(newFiles);
            onDataChange({ other_logos: newFiles });
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4 text-primary">PR Materials</h2>

            <div className="bg-base-300/50 p-4 rounded-lg mb-6">
                <p className="text-sm">
                    If you need PR Materials, please don't forget that this form MUST be submitted at least 6 weeks in advance even if you aren't requesting AS funding or physical flyers. Also, please remember to ping PR in #-events on Slack once you've submitted this form.
                </p>
            </div>

            {/* Type of material needed */}
            <motion.div variants={itemVariants} className="form-control bg-base-200/50 p-4 rounded-lg">
                <label className="label">
                    <span className="label-text font-medium text-lg">Type of material needed?</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <div className="space-y-2 mt-2">
                    {FLYER_TYPES.map((type) => (
                        <label key={type.value} className="flex items-start gap-2 cursor-pointer hover:bg-base-300/30 p-2 rounded-md transition-colors">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary mt-1"
                                checked={formData.flyer_type.includes(type.value)}
                                onChange={() => handleFlyerTypeChange(type.value)}
                            />
                            <span>{type.label}</span>
                        </label>
                    ))}
                </div>

                {/* Other flyer type input */}
                {formData.flyer_type.includes('other') && (
                    <div className="mt-3 pl-7">
                        <input
                            type="text"
                            className="input input-bordered w-full"
                            placeholder="Please specify other material needed"
                            value={formData.other_flyer_type}
                            onChange={(e) => onDataChange({ other_flyer_type: e.target.value })}
                            required
                        />
                    </div>
                )}
            </motion.div>

            {/* Advertising start date */}
            {formData.flyer_type.some(type =>
                type === 'digital_with_social' ||
                type === 'physical_with_advertising' ||
                type === 'newsletter'
            ) && (
                    <motion.div variants={itemVariants} className="form-control">
                        <label className="label">
                            <span className="label-text font-medium">When do you need us to start advertising?</span>
                            <span className="label-text-alt text-error">*</span>
                        </label>
                        <input
                            type="date"
                            className="input input-bordered focus:input-primary transition-all duration-300"
                            value={formData.flyer_advertising_start_date}
                            onChange={(e) => onDataChange({ flyer_advertising_start_date: e.target.value })}
                            required
                        />
                    </motion.div>
                )}

            {/* Logos Required */}
            <motion.div variants={itemVariants} className="form-control">
                <label className="label">
                    <span className="label-text font-medium">Logos Required</span>
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {LOGO_OPTIONS.map((logo) => (
                        <label key={logo.value} className="flex items-start gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary mt-1"
                                checked={formData.required_logos.includes(logo.value)}
                                onChange={() => handleLogoChange(logo.value)}
                            />
                            <span>{logo.label}</span>
                        </label>
                    ))}
                </div>
            </motion.div>

            {/* Logo file upload */}
            {formData.required_logos.includes('OTHER') && (
                <motion.div variants={itemVariants} className="form-control">
                    <label className="label">
                        <span className="label-text font-medium">Please share your logo files here</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>
                    <input
                        type="file"
                        className="file-input file-input-bordered w-full file-input-primary hover:file-input-ghost transition-all duration-300"
                        onChange={handleLogoFileChange}
                        accept="image/*"
                        multiple
                        required
                    />
                    {otherLogoFiles.length > 0 && (
                        <div className="mt-2">
                            <p className="text-sm font-medium mb-1">Selected files:</p>
                            <ul className="list-disc list-inside text-sm">
                                {otherLogoFiles.map((file, index) => (
                                    <li key={index}>{file.name}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </motion.div>
            )}

            {/* Format */}
            <motion.div variants={itemVariants} className="form-control">
                <label className="label">
                    <span className="label-text font-medium">What format do you need it to be in?</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <select
                    className="select select-bordered focus:select-primary transition-all duration-300"
                    value={formData.advertising_format}
                    onChange={(e) => onDataChange({ advertising_format: e.target.value })}
                    required
                >
                    <option value="">Select format</option>
                    {FORMAT_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </motion.div>

            {/* Additional specifications */}
            <motion.div variants={itemVariants} className="form-control">
                <label className="label">
                    <span className="label-text font-medium">Any other specifications and requests?</span>
                </label>
                <textarea
                    className="textarea textarea-bordered focus:textarea-primary transition-all duration-300 min-h-[120px]"
                    value={formData.flyer_additional_requests}
                    onChange={(e) => onDataChange({ flyer_additional_requests: e.target.value })}
                    placeholder="Color scheme, overall design, examples to consider, etc."
                    rows={4}
                />
            </motion.div>

            {/* Photography Needed */}
            <motion.div variants={itemVariants} className="form-control">
                <label className="label">
                    <span className="label-text font-medium">Photography Needed?</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            className="radio radio-primary"
                            checked={formData.photography_needed === true}
                            onChange={() => onDataChange({ photography_needed: true })}
                            required
                        />
                        <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            className="radio radio-primary"
                            checked={formData.photography_needed === false}
                            onChange={() => onDataChange({ photography_needed: false })}
                            required
                        />
                        <span>No</span>
                    </label>
                </div>
            </motion.div>
        </div>
    );
};

export default PRSection; 