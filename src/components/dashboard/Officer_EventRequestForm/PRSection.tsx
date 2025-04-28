import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { EventRequestFormData } from './EventRequestForm';
import type { EventRequest } from '../../../schemas/pocketbase';
import { FlyerTypes, LogoOptions } from '../../../schemas/pocketbase';
import CustomAlert from '../universal/CustomAlert';

// Enhanced animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.07,
            when: "beforeChildren"
        }
    }
};

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

// Input field hover animation
const inputHoverVariants = {
    hover: {
        scale: 1.01,
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        transition: { duration: 0.2 }
    }
};

// Checkbox animation
const checkboxVariants = {
    checked: { scale: 1.05 },
    unchecked: { scale: 1 },
    hover: {
        backgroundColor: "rgba(var(--p), 0.1)",
        transition: { duration: 0.2 }
    },
    tap: { scale: 0.95 }
};

// File upload animation
const fileUploadVariants = {
    initial: { scale: 1 },
    hover: {
        scale: 1.02,
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        transition: { duration: 0.2 }
    },
    tap: { scale: 0.98 }
};

// Flyer type options
const FLYER_TYPES = [
    { value: FlyerTypes.DIGITAL_WITH_SOCIAL, label: 'Digital flyer (with social media advertising: Facebook, Instagram, Discord)' },
    { value: FlyerTypes.DIGITAL_NO_SOCIAL, label: 'Digital flyer (with NO social media advertising)' },
    { value: FlyerTypes.PHYSICAL_WITH_ADVERTISING, label: 'Physical flyer (with advertising)' },
    { value: FlyerTypes.PHYSICAL_NO_ADVERTISING, label: 'Physical flyer (with NO advertising)' },
    { value: FlyerTypes.NEWSLETTER, label: 'Newsletter (IEEE, ECE, IDEA)' },
    { value: FlyerTypes.OTHER, label: 'Other' }
];

// Logo options
const LOGO_OPTIONS = [
    { value: LogoOptions.IEEE, label: 'IEEE' },
    { value: LogoOptions.AS, label: 'AS (required if funded by AS)' },
    { value: LogoOptions.HKN, label: 'HKN' },
    { value: LogoOptions.TESC, label: 'TESC' },
    { value: LogoOptions.PIB, label: 'PIB' },
    { value: LogoOptions.TNT, label: 'TNT' },
    { value: LogoOptions.SWE, label: 'SWE' },
    { value: LogoOptions.OTHER, label: 'OTHER (please upload transparent logo files)' }
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
    const [isDragging, setIsDragging] = useState(false);

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
            const newFiles = Array.from(e.target.files) as File[];
            setOtherLogoFiles(newFiles);
            onDataChange({ other_logos: newFiles });
        }
    };

    // Handle drag events for file upload
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newFiles = Array.from(e.dataTransfer.files) as File[];
            setOtherLogoFiles(newFiles);
            onDataChange({ other_logos: newFiles });
        }
    };

    return (
        <motion.div
            className="space-y-8"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            <motion.div variants={itemVariants}>
                <h2 className="text-3xl font-bold mb-4 text-primary bg-linear-to-r from-primary to-primary-focus bg-clip-text text-transparent">
                    PR Materials
                </h2>
            </motion.div>

            <motion.div variants={itemVariants}>
                <CustomAlert
                    type="info"
                    title="Important Timeline"
                    message="If you need PR Materials, please don't forget that this form MUST be submitted at least 6 weeks in advance even if you aren't requesting AS funding or physical flyers. Also, please remember to ping PR in #-events on Slack once you've submitted this form."
                    className="mb-6"
                    icon="heroicons:clock"
                />
            </motion.div>

            {/* Type of material needed */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-xs hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Type of Material Needed</span>
                    <span className="label-text-alt text-error">*</span>
                </label>

                <div className="space-y-3 mt-3">
                    {FLYER_TYPES.map((type) => (
                        <motion.label
                            key={type.value}
                            className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg transition-colors ${formData.flyer_type.includes(type.value)
                                ? 'bg-primary/20 border border-primary/50'
                                : 'hover:bg-base-300/30'
                                }`}
                            initial="unchecked"
                            animate={formData.flyer_type.includes(type.value) ? "checked" : "unchecked"}
                            whileHover="hover"
                            whileTap="tap"
                            variants={checkboxVariants}
                            style={{ margin: '4px' }}
                        >
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary mt-1"
                                checked={formData.flyer_type.includes(type.value)}
                                onChange={() => handleFlyerTypeChange(type.value)}
                            />
                            <span className="font-medium">{type.label}</span>
                        </motion.label>
                    ))}
                </div>

                {/* Other flyer type input */}
                {formData.flyer_type.includes(FlyerTypes.OTHER) && (
                    <motion.div
                        className="mt-4 pl-8"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <motion.input
                            type="text"
                            className="input input-bordered input-primary w-full"
                            placeholder="Please specify other material needed"
                            value={formData.other_flyer_type}
                            onChange={(e) => onDataChange({ other_flyer_type: e.target.value })}
                            required
                            whileHover="hover"
                            variants={inputHoverVariants}
                        />
                    </motion.div>
                )}
            </motion.div>

            {/* Advertising start date */}
            {formData.flyer_type.some(type =>
                type === FlyerTypes.DIGITAL_WITH_SOCIAL ||
                type === FlyerTypes.PHYSICAL_WITH_ADVERTISING ||
                type === FlyerTypes.NEWSLETTER
            ) && (
                    <motion.div
                        variants={itemVariants}
                        className="form-control bg-base-200/50 p-6 rounded-xl shadow-xs hover:shadow-md transition-all duration-300"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        whileHover={{ y: -2 }}
                    >
                        <label className="label">
                            <span className="label-text font-medium text-lg">Advertising Start Date</span>
                            <span className="label-text-alt text-error">*</span>
                        </label>
                        <p className="text-sm text-gray-500 mb-3">When do you need us to start advertising?</p>

                        <motion.input
                            type="date"
                            className="input input-bordered focus:input-primary transition-all duration-300 mt-2"
                            value={formData.flyer_advertising_start_date}
                            onChange={(e) => onDataChange({ flyer_advertising_start_date: e.target.value })}
                            required
                            whileHover="hover"
                            variants={inputHoverVariants}
                        />
                    </motion.div>
                )}

            {/* Logos Required */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-xs hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Logos Required</span>
                </label>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-3">
                    {LOGO_OPTIONS.map((logo) => (
                        <motion.label
                            key={logo.value}
                            className={`flex items-start gap-3 cursor-pointer p-3 rounded-lg transition-colors ${formData.required_logos.includes(logo.value)
                                ? 'bg-primary/20 border border-primary/50'
                                : 'hover:bg-base-300/30'
                                }`}
                            initial="unchecked"
                            animate={formData.required_logos.includes(logo.value) ? "checked" : "unchecked"}
                            whileHover="hover"
                            whileTap="tap"
                            variants={checkboxVariants}
                            style={{ margin: '4px' }}
                        >
                            <input
                                type="checkbox"
                                className="checkbox checkbox-primary mt-1"
                                checked={formData.required_logos.includes(logo.value)}
                                onChange={() => handleLogoChange(logo.value)}
                            />
                            <span className="font-medium">{logo.label}</span>
                        </motion.label>
                    ))}
                </div>
            </motion.div>

            {/* Logo file upload */}
            {formData.required_logos.includes(LogoOptions.OTHER) && (
                <motion.div
                    variants={itemVariants}
                    className="form-control bg-base-200/50 p-6 rounded-xl shadow-xs hover:shadow-md transition-all duration-300"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ y: -2 }}
                >
                    <label className="label">
                        <span className="label-text font-medium text-lg">Logo Files</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>

                    <motion.div
                        className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'
                            }`}
                        variants={fileUploadVariants}
                        initial="initial"
                        whileHover="hover"
                        whileTap="tap"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById('logo-files')?.click()}
                    >
                        <input
                            id="logo-files"
                            type="file"
                            className="hidden"
                            onChange={handleLogoFileChange}
                            accept="image/*"
                            multiple
                            required
                        />

                        <div className="flex flex-col items-center justify-center gap-3">
                            <motion.div
                                className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary"
                                whileHover={{ rotate: 15, scale: 1.1 }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </motion.div>

                            {otherLogoFiles.length > 0 ? (
                                <>
                                    <p className="font-medium text-primary">{otherLogoFiles.length} file(s) selected:</p>
                                    <div className="max-h-24 overflow-y-auto text-left w-full">
                                        <ul className="list-disc list-inside text-sm">
                                            {otherLogoFiles.map((file, index) => (
                                                <li key={index} className="truncate">{file.name}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    <p className="text-xs text-gray-500">Click or drag to replace</p>
                                </>
                            ) : (
                                <>
                                    <p className="font-medium">Drop your logo files here or click to browse</p>
                                    <p className="text-xs text-gray-500">Please upload transparent logo files (PNG preferred)</p>
                                </>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}

            {/* Format */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-xs hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Required Format</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <p className="text-sm text-gray-500 mb-3">What format do you need the materials to be in?</p>

                <motion.select
                    className="select select-bordered focus:select-primary transition-all duration-300"
                    value={formData.advertising_format}
                    onChange={(e) => onDataChange({ advertising_format: e.target.value })}
                    required
                    whileHover="hover"
                    variants={inputHoverVariants}
                >
                    <option value="">Select format</option>
                    {FORMAT_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </motion.select>
            </motion.div>

            {/* Additional specifications */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-xs hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Additional Specifications</span>
                </label>
                <p className="text-sm text-gray-500 mb-3">Any other specifications and requests?</p>

                <motion.textarea
                    className="textarea textarea-bordered focus:textarea-primary transition-all duration-300 min-h-[120px]"
                    value={formData.flyer_additional_requests}
                    onChange={(e) => onDataChange({ flyer_additional_requests: e.target.value })}
                    placeholder="Color scheme, overall design, examples to consider, etc."
                    rows={4}
                    whileHover="hover"
                    variants={inputHoverVariants}
                />
            </motion.div>

            {/* Photography Needed */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-xs hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Photography</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <p className="text-sm text-gray-500 mb-3">Do you need photography for your event?</p>

                <div className="flex gap-6 mt-2">
                    <motion.label
                        className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg transition-colors ${formData.photography_needed === true
                            ? 'bg-primary/20 border border-primary/50'
                            : 'bg-base-100 hover:bg-primary/10'
                            }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <input
                            type="radio"
                            className="radio radio-primary"
                            checked={formData.photography_needed === true}
                            onChange={() => onDataChange({ photography_needed: true })}
                            required
                        />
                        <span className="font-medium">Yes, we need photography</span>
                    </motion.label>

                    <motion.label
                        className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg transition-colors ${formData.photography_needed === false
                            ? 'bg-primary/20 border border-primary/50'
                            : 'bg-base-100 hover:bg-primary/10'
                            }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <input
                            type="radio"
                            className="radio radio-primary"
                            checked={formData.photography_needed === false}
                            onChange={() => onDataChange({ photography_needed: false })}
                            required
                        />
                        <span className="font-medium">No, we don't need photography</span>
                    </motion.label>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default PRSection; 