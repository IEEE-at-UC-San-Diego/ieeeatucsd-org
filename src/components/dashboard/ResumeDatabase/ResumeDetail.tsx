import { useState, useEffect } from 'react';
import { Get } from '../../../scripts/pocketbase/Get';
import { Collections } from '../../../schemas/pocketbase/schema';
import type { User } from '../../../schemas/pocketbase/schema';
import { Authentication } from '../../../scripts/pocketbase/Authentication';

interface ResumeUser {
    id: string;
    name: string;
    email: string;
    major?: string;
    graduation_year?: number;
    resume?: string;
    avatar?: string;
}

function getResumeUrl(user: ResumeUser): string | undefined {
    if (!user.resume) return undefined;
    return `https://pocketbase.ieeeucsd.org/api/files/users/${user.id}/${user.resume}`;
}

export default function ResumeDetail() {
    const [user, setUser] = useState<ResumeUser | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const get = Get.getInstance();
    const auth = Authentication.getInstance();

    useEffect(() => {
        // Listen for resume selection
        const handleResumeSelection = (event: CustomEvent) => {
            const { resumeId } = event.detail;
            if (resumeId) {
                loadResumeDetails(resumeId);
            }
        };

        window.addEventListener('loadResumeDetail', handleResumeSelection as EventListener);

        return () => {
            window.removeEventListener('loadResumeDetail', handleResumeSelection as EventListener);
        };
    }, []);

    const loadResumeDetails = async (userId: string) => {
        try {
            setLoading(true);
            setError(null);

            // Get user details
            const user = await get.getOne<User>(Collections.USERS, userId);

            if (!user || !user.resume) {
                setError('Resume not found');
                setUser(null);
                return;
            }

            // Map to our simplified format
            setUser({
                id: user.id,
                name: user.name,
                email: user.email,
                major: user.major,
                graduation_year: user.graduation_year,
                resume: user.resume,
                avatar: user.avatar
            });
        } catch (err) {
            console.error('Error loading resume details:', err);
            setError('Failed to load resume details');
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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

    if (!user) {
        return (
            <div className="text-center py-10">
                <p className="text-base-content/70">Select a resume to view details</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Student Information */}
            <div className="flex flex-col md:flex-row gap-6">
                <div className="shrink-0">
                    <div className="avatar">
                        <div className="w-24 h-24 rounded-xl">
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.name} />
                            ) : (
                                <div className="bg-primary text-primary-content flex items-center justify-center w-full h-full">
                                    <span className="text-2xl font-bold">{user.name.charAt(0)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="grow">
                    <h3 className="text-xl font-bold">{user.name}</h3>
                    <p className="text-base-content/70">{user.email}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <div>
                            <h4 className="text-sm font-semibold text-base-content/50">Major</h4>
                            <p>{user.major || 'Not specified'}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-base-content/50">Graduation Year</h4>
                            <p>{user.graduation_year || 'Not specified'}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Resume Preview */}
            <div className="border border-base-300 rounded-lg overflow-hidden">
                <div className="bg-base-200 px-4 py-2 border-b border-base-300 flex justify-between items-center">
                    <h3 className="font-medium">Resume</h3>
                    <a
                        href={getResumeUrl(user)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-primary"
                    >
                        Download
                    </a>
                </div>
                <div className="p-4 bg-base-100">
                    {user.resume && user.resume.toLowerCase().endsWith('.pdf') ? (
                        <div className="aspect-[8.5/11] w-full">
                            <iframe
                                src={`${getResumeUrl(user)}#toolbar=0&navpanes=0`}
                                className="w-full h-full border-0"
                                title={`${user.name}'s Resume`}
                            />
                        </div>
                    ) : user.resume && user.resume.toLowerCase().endsWith('.docx') ? (
                        <div className="aspect-[8.5/11] w-full">
                            <iframe
                                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(getResumeUrl(user) ?? '')}`}
                                className="w-full h-full border-0"
                                title={`${user.name}'s Resume`}
                            />
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <p className="text-base-content/70">
                                Resume preview not available. Click the download button to view the resume.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Contact Button */}
            <div className="flex justify-end">
                <a
                    href={`mailto:${user.email}?subject=Regarding%20Your%20Resume&body=Hello%20${user.name},%0A%0AI%20found%20your%20resume%20in%20the%20IEEE%20UCSD%20database%20and%20would%20like%20to%20discuss%20potential%20opportunities.%0A%0ABest%20regards,`}
                    className="btn btn-secondary"
                >
                    Contact Student
                </a>
            </div>
        </div>
    );
}