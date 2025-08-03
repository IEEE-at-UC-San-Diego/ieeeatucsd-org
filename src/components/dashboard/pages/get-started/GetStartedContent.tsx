import React, { useState } from 'react';
import { auth } from '../../../../firebase/client';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { app } from '../../../../firebase/client';
import { User, GraduationCap, CreditCard, Upload, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { PublicProfileService } from '../../shared/services/publicProfile';

interface Question {
    id: string;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    required: boolean;
    type: 'text' | 'number' | 'file';
    placeholder?: string;
    min?: number;
    max?: number;
    accept?: string;
}

const questions: Question[] = [
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
    }
];

export default function GetStartedContent() {
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    const db = getFirestore(app);
    const storage = getStorage(app);
    const currentQuestion = questions[currentStep];
    const isLastStep = currentStep === questions.length - 1;

    const handleNext = () => {
        if (currentQuestion.required && !answers[currentQuestion.id]) {
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

            // Prepare update data (avoid undefined values)
            const updateData: any = {
                pid: answers.pid,
                major: answers.major,
                graduationYear: answers.graduationYear,
                signedUp: true,
                joinDate: new Date(), // Set join date when completing getting started
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
            if (answers.major) {
                publicProfileData.major = answers.major;
            }
            if (answers.graduationYear) {
                publicProfileData.graduationYear = answers.graduationYear;
            }

            // Sync to public profile
            await PublicProfileService.syncPublicProfile(auth.currentUser?.uid || '', publicProfileData);

            // Success animation
            setCurrentStep(questions.length);
            setTimeout(() => {
                window.location.href = '/dashboard/overview';
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
            default:
                return null;
        }
    };

    // Success screen
    if (currentStep === questions.length) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <CheckCircle className="w-12 h-12 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to IEEE UCSD!</h1>
                    <p className="text-gray-600 text-lg">Your profile has been set up successfully.</p>
                    <p className="text-gray-500 mt-2">Redirecting to your dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full">
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
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
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