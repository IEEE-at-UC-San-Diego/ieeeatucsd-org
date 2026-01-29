import React, { useState } from 'react';
import { auth, db } from '../../../../firebase/client';
import { doc, updateDoc, getDoc, Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { app } from '../../../../firebase/client';
import { User, GraduationCap, CreditCard, Upload, CheckCircle, ArrowRight, ArrowLeft, LayoutDashboard, Sidebar, PanelTop, FileText, Shield, ExternalLink } from 'lucide-react';
import { PublicProfileService } from '../../shared/services/publicProfile';
import { normalizeMajorName } from '../../../../utils/majorNormalization';
import type { NavigationLayout } from '../../shared/types/firestore';
import { Spinner, Checkbox } from '@heroui/react';
import { safeLocalStorageSet } from '../../shared/utils/storage';
import { LEGAL_VERSIONS } from '../../../../config/legalVersions';

interface Question {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    required: boolean;
    type: 'text' | 'number' | 'file' | 'navigation-layout' | 'legal-acceptance';
    placeholder?: string;
    min?: number;
    max?: number;
    accept?: string;
}

const questions: Question[] = [
    {
        id: 'legalAcceptance',
        title: 'Terms of Service & Privacy Policy',
        description: 'Please review and accept our policies to continue',
        icon: FileText,
        required: true,
        type: 'legal-acceptance'
    },
    {
        id: 'pid',
        title: 'Student PID',
        description: 'Your UCSD student ID (e.g., A12345678)',
        icon: User,
        required: true,
        type: 'text',
        placeholder: 'A12345678'
    },
    {
        id: 'major',
        title: 'Major',
        description: 'What are you studying at UCSD?',
        icon: GraduationCap,
        required: true,
        type: 'text',
        placeholder: 'Computer Science'
    },
    {
        id: 'graduationYear',
        title: 'Expected Graduation Year',
        description: 'When do you plan to graduate?',
        icon: GraduationCap,
        required: true,
        type: 'number',
        placeholder: '2025',
        min: 2024,
        max: 2030
    },
    {
        id: 'memberId',
        title: 'IEEE Member ID',
        description: 'If you\'re already an IEEE member, enter your ID (optional)',
        icon: User,
        required: false,
        type: 'text',
        placeholder: '12345678'
    },
    {
        id: 'zelle',
        title: 'Zelle Information',
        description: 'Phone number or email for reimbursements and payments (optional)',
        icon: CreditCard,
        required: false,
        type: 'text',
        placeholder: 'Phone number or email'
    },
    {
        id: 'resume',
        title: 'Resume',
        description: 'Upload your resume for networking opportunities (optional)',
        icon: Upload,
        required: false,
        type: 'file',
        accept: '.pdf,.doc,.docx'
    },
    {
        id: 'navigationLayout',
        title: 'Navigation Layout',
        description: 'Choose your preferred navigation style',
        icon: LayoutDashboard,
        required: true,
        type: 'navigation-layout'
    }
];

export default function GetStartedContent() {
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Use db from client
    const storage = getStorage(app);
    const currentQuestion = questions[currentStep];
    const isLastStep = currentStep === questions.length - 1;

    const handleNext = () => {
        // Special validation for legal-acceptance: must accept both TOS and Privacy Policy
        if (currentQuestion.type === 'legal-acceptance') {
            const legalValue = answers[currentQuestion.id];
            if (!legalValue?.tos || !legalValue?.privacy) {
                setError('You must accept both the Terms of Service and Privacy Policy to continue');
                return;
            }
        } else if (currentQuestion.required && !answers[currentQuestion.id]) {
            setError('This field is required');
            return;
        }

        setError(null);
        setIsAnimating(true);

        setTimeout(() => {
            if (isLastStep) {
                handleSubmit();
            } else {
                setCurrentStep(prev => prev + 1);
                setIsAnimating(false);
            }
        }, 300);
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setIsAnimating(true);
            setTimeout(() => {
                setCurrentStep(prev => prev - 1);
                setIsAnimating(false);
                setError(null);
            }, 300);
        }
    };

    const handleInputChange = (value: any) => {
        setAnswers(prev => ({
            ...prev,
            [currentQuestion.id]: value
        }));
        setError(null);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleNext();
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        setError(null);

        try {
            let resumeUrl = '';
            if (answers.resume) {
                try {
                    const storageRef = ref(storage, `resumes/${auth.currentUser?.uid}/${answers.resume.name}`);
                    const uploadTask = uploadBytesResumable(storageRef, answers.resume);
                    await new Promise((resolve, reject) => {
                        uploadTask.on('state_changed', null, reject, () => resolve(uploadTask.snapshot.ref));
                    });
                    resumeUrl = await getDownloadURL(storageRef);
                } catch (uploadError) {
                    console.error('Resume upload failed:', uploadError);
                    setError('Failed to upload resume. Please try again or contact an administrator if the issue persists.');
                    setLoading(false);
                    return;
                }
            }

            const userRef = doc(db, 'users', auth.currentUser?.uid || '');

            // Normalize major name before saving
            const normalizedMajor = normalizeMajorName(answers.major);

            // Prepare update data (avoid undefined values)
            const now = Timestamp.now();
            const updateData: any = {
                pid: answers.pid,
                major: normalizedMajor,
                graduationYear: answers.graduationYear,
                signedUp: true,
                joinDate: new Date(), // Set join date when completing getting started
                navigationLayout: answers.navigationLayout || 'sidebar', // Save navigation preference (default to sidebar)
                // TOS and Privacy Policy acceptance
                tosAcceptedAt: now,
                tosVersion: LEGAL_VERSIONS.TOS_VERSION,
                privacyPolicyAcceptedAt: now,
                privacyPolicyVersion: LEGAL_VERSIONS.PRIVACY_POLICY_VERSION,
            };

            // Only add optional fields if they have values
            if (answers.memberId) {
                updateData.memberId = answers.memberId;
            }
            if (answers.zelle) {
                updateData.zelleInformation = answers.zelle;
            }
            if (resumeUrl) {
                updateData.resume = resumeUrl;
            }

            // Also save navigation layout to localStorage for immediate access
            if (answers.navigationLayout) {
                if (!safeLocalStorageSet('ieee_navigation_layout', answers.navigationLayout)) {
                    console.warn('Failed to persist navigation layout preference to localStorage.');
                }
            }

            // Update private user document
            await updateDoc(userRef, updateData);

            // Get current user data for public profile
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();

            // Create public profile with the signup data
            const publicProfileData: any = {
                name: userData?.name || auth.currentUser?.displayName || 'New Member',
                points: userData?.points || 0,
                eventsAttended: userData?.eventsAttended || 0,
                position: userData?.position || userData?.role || 'Member',
                joinDate: new Date() // Also set join date in public profile
            };

            // Add optional fields if they exist
            if (normalizedMajor) {
                publicProfileData.major = normalizedMajor;
            }
            if (answers.graduationYear) {
                publicProfileData.graduationYear = answers.graduationYear;
            }

            // Sync to public profile
            await PublicProfileService.syncPublicProfile(auth.currentUser?.uid || '', publicProfileData);

            // Success animation
            setCurrentStep(questions.length);
            setTimeout(() => {
                window.location.href = '/overview';
            }, 2000);
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    const renderInput = () => {
        const question = currentQuestion;
        const value = answers[question.id] || '';

        switch (question.type) {
            case 'text':
                return (
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => handleInputChange(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={question.placeholder}
                        className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        autoFocus
                    />
                );
            case 'number':
                return (
                    <input
                        type="number"
                        value={value}
                        onChange={(e) => handleInputChange(e.target.valueAsNumber || '')}
                        onKeyPress={handleKeyPress}
                        placeholder={question.placeholder}
                        min={question.min}
                        max={question.max}
                        className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                        autoFocus
                    />
                );
            case 'file':
                return (
                    <div className="space-y-4">
                        <input
                            type="file"
                            accept={question.accept}
                            onChange={(e) => handleInputChange(e.target.files?.[0] || null)}
                            onKeyPress={handleKeyPress}
                            className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {value && (
                            <p className="text-green-600 font-medium">✓ {value.name} selected</p>
                        )}
                    </div>
                );
            case 'navigation-layout':
                return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Horizontal Navbar Option */}
                        <button
                            type="button"
                            onClick={() => handleInputChange('horizontal')}
                            className={`relative p-6 border-2 rounded-lg transition-all text-left ${value === 'horizontal'
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 hover:border-gray-400'
                                }`}
                        >
                            <div className="flex items-center space-x-3 mb-4">
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${value === 'horizontal' ? 'bg-blue-100' : 'bg-gray-100'
                                    }`}>
                                    <PanelTop className={`w-6 h-6 ${value === 'horizontal' ? 'text-blue-600' : 'text-gray-600'
                                        }`} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg text-gray-900 mb-1">Horizontal Navbar</h3>
                                    <p className="text-sm text-gray-600">Traditional top navigation bar with dropdown menus</p>
                                </div>
                            </div>
                            {value === 'horizontal' && (
                                <div className="absolute top-3 right-3">
                                    <CheckCircle className="w-6 h-6 text-blue-600" />
                                </div>
                            )}
                            {/* Visual Preview - Horizontal Navbar Only */}
                            <div className="mt-3 p-2 bg-white rounded border border-gray-200 h-28 w-full flex flex-col">
                                <div className="h-8 bg-[#0A2463] rounded flex items-center px-2 gap-1 mb-1.5 flex-shrink-0">
                                    {/* Logo */}
                                    <div className="h-4 w-4 bg-white rounded-sm flex-shrink-0"></div>
                                    {/* Nav items */}
                                    <div className="flex gap-1 ml-auto">
                                        <div className="h-2 w-8 bg-white/20 rounded"></div>
                                        <div className="h-2 w-8 bg-white/10 rounded"></div>
                                        <div className="h-2 w-8 bg-white/10 rounded"></div>
                                    </div>
                                </div>
                                <div className="flex-1 bg-gray-100 rounded min-h-0"></div>
                            </div>
                        </button>

                        {/* Sidebar Option */}
                        <button
                            type="button"
                            onClick={() => handleInputChange('sidebar')}
                            className={`relative p-6 border-2 rounded-lg transition-all text-left ${value === 'sidebar'
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-300 hover:border-gray-400'
                                }`}
                        >
                            <div className="flex items-center space-x-3 mb-4">
                                <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${value === 'sidebar' ? 'bg-blue-100' : 'bg-gray-100'
                                    }`}>
                                    <Sidebar className={`w-6 h-6 ${value === 'sidebar' ? 'text-blue-600' : 'text-gray-600'
                                        }`} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg text-gray-900 mb-1">Sidebar Navigation</h3>
                                    <p className="text-sm text-gray-600">Collapsible sidebar with organized menu groups</p>
                                </div>
                            </div>
                            {value === 'sidebar' && (
                                <div className="absolute top-3 right-3">
                                    <CheckCircle className="w-6 h-6 text-blue-600" />
                                </div>
                            )}
                            {/* Visual Preview - Sidebar Only */}
                            <div className="mt-3 p-2 bg-white rounded border border-gray-200 h-28 w-full flex gap-1.5">
                                <div className="w-20 bg-[#0A2463] rounded p-2 flex flex-col gap-1.5 flex-shrink-0">
                                    {/* Logo area */}
                                    <div className="h-3 bg-white rounded mb-1"></div>
                                    {/* Menu items */}
                                    <div className="space-y-1">
                                        <div className="h-2 bg-white/20 rounded"></div>
                                        <div className="h-2 bg-white/10 rounded"></div>
                                        <div className="h-2 bg-white/10 rounded"></div>
                                        <div className="h-2 bg-white/10 rounded"></div>
                                    </div>
                                    {/* Spacer */}
                                    <div className="flex-1 min-h-0"></div>
                                    {/* User section at bottom */}
                                    <div className="h-3 bg-white/10 rounded"></div>
                                </div>
                                <div className="flex-1 bg-gray-100 rounded min-h-0"></div>
                            </div>
                        </button>
                    </div>
                );
            case 'legal-acceptance':
                const tosAccepted = value?.tos || false;
                const privacyAccepted = value?.privacy || false;
                return (
                    <div className="space-y-4">
                        {/* Terms of Service */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    <Checkbox
                                        isSelected={tosAccepted}
                                        onValueChange={(checked) => handleInputChange({ ...value, tos: checked })}
                                        size="lg"
                                        color="primary"
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <FileText className="w-4 h-4 text-blue-600" />
                                        <span className="font-medium text-gray-900">Terms of Service</span>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                            v{LEGAL_VERSIONS.TOS_VERSION}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">
                                        I have read and agree to the Terms of Service.
                                    </p>
                                    <a
                                        href={LEGAL_VERSIONS.TOS_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                                    >
                                        Read Terms of Service
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Privacy Policy */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    <Checkbox
                                        isSelected={privacyAccepted}
                                        onValueChange={(checked) => handleInputChange({ ...value, privacy: checked })}
                                        size="lg"
                                        color="primary"
                                    />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Shield className="w-4 h-4 text-green-600" />
                                        <span className="font-medium text-gray-900">Privacy Policy</span>
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                            v{LEGAL_VERSIONS.PRIVACY_POLICY_VERSION}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">
                                        I have read and agree to the Privacy Policy.
                                    </p>
                                    <a
                                        href={LEGAL_VERSIONS.PRIVACY_POLICY_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                                    >
                                        Read Privacy Policy
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-gray-500 text-center">
                            You must accept both policies to continue.
                        </p>
                    </div>
                );
            default:
                return null;
        }
    };

    // Success screen
    if (currentStep === questions.length) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-8 md:py-12">
                <div className="text-center">
                    <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse" >
                        <CheckCircle className="w-12 h-12 text-white" />
                    </div >
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to IEEE UCSD!</h1>
                    <p className="text-gray-600 text-lg">Your profile has been set up successfully.</p>
                    <p className="text-gray-500 mt-2">Redirecting to your dashboard...</p>
                </div >
            </div >
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 py-8 md:py-12">
            <div className="max-w-2xl w-full overflow-y-auto max-h-[calc(100vh-4rem)]">
                {/* IEEE UCSD Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center mb-4">
                        <img
                            src="/logos/blue_logo_only.svg"
                            alt="IEEE UCSD Logo"
                            className="w-12 h-12 mr-3"
                        />
                        <h1 className="text-3xl font-bold text-gray-900">IEEE at UC San Diego</h1>
                    </div>
                    <p className="text-gray-600">Complete your profile to get started</p>
                </div>

                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    {/* Progress Bar */}
                    <div className="bg-white px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                            <span>Question {currentStep + 1} of {questions.length}</span>
                            <span>{Math.round(((currentStep + 1) / questions.length) * 100)}% Complete</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Question Content */}
                    <div className={`p-8 transition-all duration-500 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <currentQuestion.icon className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                {currentQuestion.title}
                                {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
                            </h2>
                            <p className="text-gray-600">{currentQuestion.description}</p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-700 text-sm">{error}</p>
                            </div>
                        )}

                        <div className="mb-8">
                            {renderInput()}
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex justify-between items-center">
                            <button
                                onClick={handleBack}
                                disabled={currentStep === 0}
                                className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 mr-2" />
                                Back
                            </button>

                            <button
                                onClick={handleNext}
                                disabled={loading}
                                className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <>
                                        <Spinner size="sm" color="current" className="mr-2" />
                                        Finishing...
                                    </>
                                ) : isLastStep ? (
                                    <>
                                        Complete Setup
                                        <CheckCircle className="w-5 h-5 ml-2" />
                                    </>
                                ) : (
                                    <>
                                        Next
                                        <ArrowRight className="w-5 h-5 ml-2" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Skip Option for Optional Questions */}
                {!currentQuestion.required && (
                    <div className="text-center mt-4">
                        <button
                            onClick={handleNext}
                            className="text-gray-500 hover:text-gray-700 text-sm underline transition-colors"
                        >
                            Skip this question
                        </button>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center mt-8 text-xs text-gray-500">
                    <p>
                        Need help? Contact us at{' '}
                        <a href="mailto:ieee@ucsd.edu" className="text-blue-600 hover:text-blue-700 transition-colors">
                            ieee@ucsd.edu
                        </a>
                    </p>
                </div>
            </div>
        </div>
    );
} 
