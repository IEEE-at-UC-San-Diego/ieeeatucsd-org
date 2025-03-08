import { useState, useEffect, useRef } from 'react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { FileManager } from '../../../scripts/pocketbase/FileManager';
import { Update } from '../../../scripts/pocketbase/Update';
import { Get } from '../../../scripts/pocketbase/Get';
import { Collections, type User } from '../../../schemas/pocketbase/schema';
import { toast } from 'react-hot-toast';
import FilePreview from '../universal/FilePreview';

export default function ResumeSettings() {
    const auth = Authentication.getInstance();
    const fileManager = FileManager.getInstance();
    const update = Update.getInstance();
    const get = Get.getInstance();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [resumeUrl, setResumeUrl] = useState<string | null>(null);
    const [resumeFilename, setResumeFilename] = useState<string | null>(null);
    const [resumeFile, setResumeFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch user data on component mount
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                setLoading(true);
                const currentUser = auth.getCurrentUser();
                if (!currentUser) {
                    throw new Error('User not authenticated');
                }

                const userData = await get.getOne<User>('users', currentUser.id);
                setUser(userData);

                // Check if user has a resume
                if (userData.resume) {
                    const resumeFile = userData.resume;
                    const fileUrl = fileManager.getFileUrl('users', userData.id, resumeFile);
                    setResumeUrl(fileUrl);
                    setResumeFilename(resumeFile);
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                toast.error('Failed to load user data');
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];

            // Validate file type (PDF or DOCX)
            const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            const fileExtension = file.name.split('.').pop()?.toLowerCase();

            // Check both MIME type and file extension
            if (!allowedTypes.includes(file.type) &&
                !(fileExtension === 'pdf' || fileExtension === 'docx')) {
                toast.error('Please upload a PDF or DOCX file');
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                return;
            }

            // Validate file size (max 50MB)
            const maxSize = 50 * 1024 * 1024; // 50MB in bytes
            if (file.size > maxSize) {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                toast.error(`File too large (${sizeMB}MB). Maximum size is 50MB.`);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                return;
            }

            setResumeFile(file);
            setResumeFilename(file.name);
            toast.success(`File "${file.name}" selected. Click Upload to confirm.`);
        }
    };

    const handleUpload = async () => {
        if (!resumeFile || !user) {
            toast.error('No file selected or user not authenticated');
            return;
        }

        try {
            setUploading(true);

            // Create a FormData object for the file upload
            const formData = new FormData();
            formData.append('resume', resumeFile);

            // Show progress toast
            const loadingToast = toast.loading('Uploading resume...');

            // Log the file being uploaded for debugging
            console.log('Uploading file:', {
                name: resumeFile.name,
                size: resumeFile.size,
                type: resumeFile.type
            });

            let updatedUserData: User;

            try {
                // Use the FileManager to upload the file directly
                console.log('Using FileManager to upload resume file');

                // Upload the file using the FileManager's uploadFile method
                const result = await fileManager.uploadFile<User>(
                    Collections.USERS,
                    user.id,
                    'resume',
                    resumeFile,
                    false // Don't append, replace existing file
                );

                // Verify the file was uploaded by checking the response
                if (!result || !result.resume) {
                    throw new Error('Resume was not properly saved to the user record');
                }

                console.log('Resume upload successful:', result.resume);

                // Store the updated user data
                updatedUserData = result;

                // Fetch the updated user record to ensure we have the latest data
                const refreshedUser = await get.getOne<User>(Collections.USERS, user.id);
                console.log('Refreshed user data:', refreshedUser);

                // Double check that the resume field is populated
                if (!refreshedUser.resume) {
                    console.warn('Resume field is missing in the refreshed user data');
                }
            } catch (uploadError) {
                console.error('Error in file upload process:', uploadError);
                toast.dismiss(loadingToast);
                toast.error('Failed to upload resume: ' + (uploadError instanceof Error ? uploadError.message : 'Unknown error'));
                setUploading(false);
                return;
            }

            // Get the URL of the uploaded file
            if (!updatedUserData.resume) {
                throw new Error('Resume filename is missing in the updated user data');
            }

            const fileUrl = fileManager.getFileUrl('users', user.id, updatedUserData.resume);

            // Update state with the new resume information
            setResumeUrl(fileUrl);
            setResumeFilename(updatedUserData.resume);
            setResumeFile(null);

            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            // Dismiss loading toast and show success message
            toast.dismiss(loadingToast);
            toast.success('Resume uploaded successfully');

            // Log the successful upload
            console.log('Resume uploaded successfully:', updatedUserData.resume);

            // Dispatch a custom event to notify the dashboard about the resume upload
            const event = new CustomEvent('resumeUploaded', {
                detail: { hasResume: true }
            });
            window.dispatchEvent(event);

        } catch (error) {
            console.error('Error uploading resume:', error);

            // Provide more specific error messages based on the error type
            if (error instanceof Error) {
                if (error.message.includes('size')) {
                    toast.error('File size exceeds the maximum allowed limit (50MB)');
                } else if (error.message.includes('type')) {
                    toast.error('Invalid file type. Please upload a PDF or DOCX file');
                } else if (error.message.includes('network')) {
                    toast.error('Network error. Please check your connection and try again');
                } else if (error.message.includes('permission')) {
                    toast.error('Permission denied. You may not have the right permissions');
                } else {
                    toast.error(`Upload failed: ${error.message}`);
                }
            } else {
                toast.error('Failed to upload resume. Please try again later');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!user) {
            toast.error('User not authenticated');
            return;
        }

        // Ask for confirmation before deleting
        if (!confirm('Are you sure you want to delete your resume? This action cannot be undone.')) {
            return;
        }

        try {
            setUploading(true);

            // Show progress toast
            const loadingToast = toast.loading('Deleting resume...');

            // Log the deletion attempt
            console.log('Attempting to delete resume for user:', user.id);

            // Create a FormData with empty resume field to remove the file
            const formData = new FormData();
            formData.append('resume', '');

            try {
                console.log('Using FileManager to delete resume file');

                // Use the FileManager's deleteFile method to remove the file
                const result = await fileManager.deleteFile<User>(
                    Collections.USERS,
                    user.id,
                    'resume'
                );

                // Verify the file was deleted
                if (result.resume) {
                    console.warn('Resume field still exists after deletion attempt:', result.resume);
                    toast.dismiss(loadingToast);
                    toast.error('Failed to completely remove the resume. Please try again.');
                    setUploading(false);
                    return;
                }

                console.log('Resume deletion successful for user:', user.id);

                // Fetch the updated user record to ensure we have the latest data
                const refreshedUser = await get.getOne<User>(Collections.USERS, user.id);
                console.log('Refreshed user data after deletion:', refreshedUser);

                // Double check that the resume field is empty
                if (refreshedUser.resume) {
                    console.warn('Resume field is still present in the refreshed user data:', refreshedUser.resume);
                }
            } catch (deleteError) {
                console.error('Error in file deletion process:', deleteError);
                toast.dismiss(loadingToast);
                toast.error('Failed to delete resume: ' + (deleteError instanceof Error ? deleteError.message : 'Unknown error'));
                setUploading(false);
                return;
            }

            // Update state to reflect the deletion
            setResumeUrl(null);
            setResumeFilename(null);

            // Dismiss loading toast and show success message
            toast.dismiss(loadingToast);
            toast.success('Resume deleted successfully');

            // Log the successful deletion
            console.log('Resume deleted successfully for user:', user.id);

            // Dispatch a custom event to notify the dashboard about the resume deletion
            const event = new CustomEvent('resumeUploaded', {
                detail: { hasResume: false }
            });
            window.dispatchEvent(event);

        } catch (error) {
            console.error('Error deleting resume:', error);

            // Provide more specific error messages based on the error type
            if (error instanceof Error) {
                if (error.message.includes('permission')) {
                    toast.error('Permission denied. You may not have the right permissions');
                } else if (error.message.includes('network')) {
                    toast.error('Network error. Please check your connection and try again');
                } else {
                    toast.error(`Deletion failed: ${error.message}`);
                }
            } else {
                toast.error('Failed to delete resume. Please try again later');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleReplace = async () => {
        if (!user) {
            toast.error('User not authenticated');
            return;
        }

        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.pdf,.docx';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        // Trigger click to open file dialog
        fileInput.click();

        // Handle file selection
        fileInput.onchange = async (e) => {
            const input = e.target as HTMLInputElement;
            if (!input.files || input.files.length === 0) {
                document.body.removeChild(fileInput);
                return;
            }

            const file = input.files[0];

            // Validate file type (PDF or DOCX)
            const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            const fileExtension = file.name.split('.').pop()?.toLowerCase();

            if (!allowedTypes.includes(file.type) &&
                !(fileExtension === 'pdf' || fileExtension === 'docx')) {
                toast.error('Please upload a PDF or DOCX file');
                document.body.removeChild(fileInput);
                return;
            }

            // Validate file size (max 50MB)
            const maxSize = 50 * 1024 * 1024; // 50MB in bytes
            if (file.size > maxSize) {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                toast.error(`File too large (${sizeMB}MB). Maximum size is 50MB.`);
                document.body.removeChild(fileInput);
                return;
            }

            try {
                setUploading(true);

                // Show progress toast
                const loadingToast = toast.loading('Replacing resume...');

                // Log the file being uploaded for debugging
                console.log('Replacing resume with file:', {
                    name: file.name,
                    size: file.size,
                    type: file.type
                });

                // Create a FormData object for the file upload
                const formData = new FormData();
                formData.append('resume', file);

                // Use the update service to directly update the user record
                const result = await update.updateFields<User>(
                    Collections.USERS,
                    user.id,
                    formData
                );

                // Verify the file was uploaded
                if (!result || !result.resume) {
                    throw new Error('Resume was not properly saved to the user record');
                }

                // Get the URL of the uploaded file
                const fileUrl = fileManager.getFileUrl('users', user.id, result.resume);

                // Update state with the new resume information
                setResumeUrl(fileUrl);
                setResumeFilename(result.resume);
                setResumeFile(null);

                // Dismiss loading toast and show success message
                toast.dismiss(loadingToast);
                toast.success('Resume replaced successfully');

                // Dispatch a custom event to notify the dashboard about the resume upload
                const event = new CustomEvent('resumeUploaded', {
                    detail: { hasResume: true }
                });
                window.dispatchEvent(event);

            } catch (error) {
                console.error('Error replacing resume:', error);
                toast.error('Failed to replace resume: ' + (error instanceof Error ? error.message : 'Unknown error'));
            } finally {
                setUploading(false);
                document.body.removeChild(fileInput);
            }
        };
    };

    return (
        <div className="space-y-6">
            {loading ? (
                <div className="flex justify-center items-center py-8">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            ) : (
                <>
                    {/* Resume Upload Section */}
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-medium">Resume</h3>
                                <p className="text-sm opacity-70">
                                    Upload your resume for recruiters and career opportunities
                                </p>
                            </div>

                            {!resumeUrl && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept=".pdf,.docx"
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="btn btn-primary btn-sm gap-2"
                                        disabled={uploading}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                        </svg>
                                        Select Resume
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* File selected but not uploaded yet */}
                        {resumeFile && !uploading && (
                            <div className="bg-base-200 p-4 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary/10 p-2 rounded-lg">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="font-medium truncate max-w-xs">{resumeFile.name}</p>
                                            <p className="text-xs opacity-70">{(resumeFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleUpload}
                                            className="btn btn-primary btn-sm"
                                            disabled={uploading}
                                        >
                                            Upload
                                        </button>
                                        <button
                                            onClick={() => {
                                                setResumeFile(null);
                                                if (fileInputRef.current) {
                                                    fileInputRef.current.value = '';
                                                }
                                            }}
                                            className="btn btn-ghost btn-sm"
                                            disabled={uploading}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Uploading state */}
                        {uploading && (
                            <div className="bg-base-200 p-4 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <span className="loading loading-spinner loading-sm"></span>
                                    <span>Processing your resume...</span>
                                </div>
                                <progress className="progress progress-primary w-full mt-2"></progress>
                            </div>
                        )}

                        {/* Resume preview */}
                        {resumeUrl && resumeFilename && !resumeFile && !uploading && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-medium">Current Resume</h4>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleReplace}
                                            className="btn btn-sm btn-outline gap-1"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                                            </svg>
                                            Replace
                                        </button>
                                        <button
                                            onClick={handleDelete}
                                            className="btn btn-sm btn-error btn-outline gap-1"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                <div className="border border-base-300 rounded-lg overflow-hidden">
                                    <FilePreview
                                        url={resumeUrl}
                                        filename={resumeFilename}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Resume upload guidelines */}
                        <div className="bg-base-200/50 p-4 rounded-lg mt-4">
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-info" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                Resume Guidelines
                            </h4>
                            <ul className="list-disc list-inside text-sm opacity-70 space-y-1">
                                <li>Accepted formats: PDF, DOCX</li>
                                <li>Maximum file size: 50MB</li>
                                <li>Keep your resume up-to-date for better opportunities</li>
                                <li>Highlight your skills, experience, and education</li>
                            </ul>
                        </div>

                        {/* Resume Benefits */}
                        <div className="bg-primary/10 p-4 rounded-lg mt-4">
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                Why Upload Your Resume?
                            </h4>
                            <ul className="list-disc list-inside text-sm space-y-1">
                                <li className="text-primary-focus">Increase visibility to recruiters and industry partners</li>
                                <li className="text-primary-focus">Get matched with relevant job opportunities</li>
                                <li className="text-primary-focus">Simplify application process for IEEE UCSD events</li>
                                <li className="text-primary-focus">Access personalized career resources and recommendations</li>
                            </ul>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
