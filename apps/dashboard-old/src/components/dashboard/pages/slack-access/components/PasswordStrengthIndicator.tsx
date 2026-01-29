import React from 'react';
import { Check } from 'lucide-react';

interface PasswordStrengthIndicatorProps {
    validation: {
        isValid: boolean;
        strength: number;
        requirements: {
            minLength: boolean;
            hasUppercase: boolean;
            hasLowercase: boolean;
            hasNumber: boolean;
            hasSpecialChar: boolean;
        };
    };
}

export default function PasswordStrengthIndicator({ validation }: PasswordStrengthIndicatorProps) {
    const getStrengthColor = (strength: number) => {
        if (strength <= 2) return 'bg-red-500';
        if (strength <= 3) return 'bg-yellow-500';
        if (strength <= 4) return 'bg-blue-500';
        return 'bg-green-500';
    };

    const getStrengthText = (strength: number) => {
        if (strength <= 2) return 'Weak';
        if (strength <= 3) return 'Fair';
        if (strength <= 4) return 'Good';
        return 'Strong';
    };

    return (
        <div className="mt-2 space-y-2">
            {/* Strength Bar */}
            <div className="flex items-center space-x-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                        className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(validation.strength)}`}
                        style={{ width: `${(validation.strength / 5) * 100}%` }}
                    />
                </div>
                <span className={`text-xs font-medium ${validation.strength <= 2 ? 'text-red-600' : validation.strength <= 3 ? 'text-yellow-600' : validation.strength <= 4 ? 'text-blue-600' : 'text-green-600'}`}>
                    {getStrengthText(validation.strength)}
                </span>
            </div>

            {/* Requirements List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                <div className={`flex items-center space-x-1 ${validation.requirements.minLength ? 'text-green-600' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 ${validation.requirements.minLength ? 'text-green-600' : 'text-gray-400'}`} />
                    <span>8+ characters</span>
                </div>
                <div className={`flex items-center space-x-1 ${validation.requirements.hasUppercase ? 'text-green-600' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 ${validation.requirements.hasUppercase ? 'text-green-600' : 'text-gray-400'}`} />
                    <span>Uppercase letter</span>
                </div>
                <div className={`flex items-center space-x-1 ${validation.requirements.hasLowercase ? 'text-green-600' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 ${validation.requirements.hasLowercase ? 'text-green-600' : 'text-gray-400'}`} />
                    <span>Lowercase letter</span>
                </div>
                <div className={`flex items-center space-x-1 ${validation.requirements.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 ${validation.requirements.hasNumber ? 'text-green-600' : 'text-gray-400'}`} />
                    <span>Number</span>
                </div>
                <div className={`flex items-center space-x-1 ${validation.requirements.hasSpecialChar ? 'text-green-600' : 'text-gray-500'}`}>
                    <Check className={`w-3 h-3 ${validation.requirements.hasSpecialChar ? 'text-green-600' : 'text-gray-400'}`} />
                    <span>Special character</span>
                </div>
            </div>
        </div>
    );
}
