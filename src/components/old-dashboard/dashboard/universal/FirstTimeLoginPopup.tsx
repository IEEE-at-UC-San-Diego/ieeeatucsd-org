import { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { Update } from "../../../scripts/pocketbase/Update";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import type { User } from "../../../schemas/pocketbase/schema";
import CustomAlert from "./CustomAlert";
import { motion, AnimatePresence } from "framer-motion";

interface FirstTimeLoginPopupProps {
    logtoApiEndpoint?: string;
    onComplete?: () => void;
}

const ucsdMajors = [
    "Aerospace Engineering",
    "Aerospace Engineering – Aerothermodynamics",
    "Aerospace Engineering – Astrodynamics and Space Applications",
    "Aerospace Engineering – Flight Dynamics and Controls",
    "Anthropology",
    "Art History/Criticism",
    "Astronomy & Astrophysics",
    "Biochemistry",
    "Biochemistry and Cell Biology",
    "Biology with Specialization in Bioinformatics",
    "Bioengineering",
    "Business Economics",
    "Business Psychology",
    "Chemical Engineering",
    "Chemistry",
    "Chinese Studies",
    "Cinematic Arts",
    "Classical Studies",
    "Cognitive Science",
    "Cognitive Science – Clinical Aspects of Cognition",
    "Cognitive Science – Design and Interaction",
    "Cognitive Science – Language and Culture",
    "Cognitive Science – Machine Learning and Neural Computation",
    "Cognitive Science – Neuroscience",
    "Cognitive and Behavioral Neuroscience",
    "Communication",
    "Computer Engineering",
    "Computer Science",
    "Computer Science – Bioinformatics",
    "Critical Gender Studies",
    "Dance",
    "Data Science",
    "Ecology, Behavior and Evolution",
    "Economics",
    "Economics and Mathematics – Joint Major",
    "Economics-Public Policy",
    "Education Sciences",
    "Electrical Engineering",
    "Electrical Engineering and Society",
    "Engineering Physics",
    "Environmental Chemistry",
    "Environmental Systems (Earth Sciences)",
    "Environmental Systems (Ecology, Behavior & Evolution)",
    "Environmental Systems (Environmental Chemistry)",
    "Environmental Systems (Environmental Policy)",
    "Ethnic Studies",
    "General Biology",
    "General Physics",
    "General Physics/Secondary Education",
    "Geosciences",
    "German Studies",
    "Global Health",
    "Global South Studies",
    "History",
    "Human Biology",
    "Human Developmental Sciences",
    "Human Developmental Sciences – Equity and Diversity",
    "Human Developmental Sciences – Healthy Aging",
    "Interdisciplinary Computing and the Arts",
    "International Studies – Anthropology",
    "International Studies – Economics",
    "International Studies – Economics (Joint BA/MIA)",
    "International Studies – History",
    "International Studies – International Business",
    "International Studies – International Business (Joint BA/MIA)",
    "International Studies – Linguistics",
    "International Studies – Literature",
    "International Studies – Philosophy",
    "International Studies – Political Science",
    "International Studies – Political Science (Joint BA/MIA)",
    "International Studies – Sociology",
    "Italian Studies",
    "Japanese Studies",
    "Jewish Studies",
    "Latin American Studies",
    "Latin American Studies – Mexico",
    "Latin American Studies – Migration and Border Studies",
    "Linguistics",
    "Linguistics – Cognition and Language",
    "Linguistics – Language and Society",
    "Linguistics – Speech and Language Sciences",
    "Linguistics: Language Studies",
    "Literary Arts",
    "Literatures in English",
    "Marine Biology",
    "Mathematical Biology",
    "Mathematics",
    "Mathematics – Applied Science",
    "Mathematics – Computer Science",
    "Mathematics – Secondary Education",
    "Mathematics (Applied)",
    "Mechanical Engineering",
    "Mechanical Engineering – Controls and Robotics",
    "Mechanical Engineering – Fluid Mechanics and Thermal Systems",
    "Mechanical Engineering – Materials Science and Engineering",
    "Mechanical Engineering – Mechanics of Materials",
    "Mechanical Engineering – Renewable Energy and Environmental Flows",
    "Media",
    "Media Industries and Communication",
    "Microbiology",
    "Molecular Synthesis",
    "Molecular and Cell Biology",
    "Music",
    "Music Humanities",
    "NanoEngineering",
    "Neurobiology / Physiology and Neuroscience",
    "Oceanic and Atmospheric Sciences",
    "Pharmacological Chemistry",
    "Philosophy",
    "Physics",
    "Physics – Astrophysics",
    "Physics – Biophysics",
    "Physics – Computational Physics",
    "Physics – Earth Sciences",
    "Physics – Materials Physics",
    "Political Science",
    "Political Science – American Politics",
    "Political Science – Comparative Politics",
    "Political Science – Data Analytics",
    "Political Science – International Affairs",
    "Political Science – International Relations",
    "Political Science – Political Theory",
    "Political Science – Public Law",
    "Political Science – Public Policy",
    "Political Science – Race, Ethnicity, and Politics",
    "Probability and Statistics",
    "Psychology",
    "Psychology – Clinical Psychology",
    "Psychology – Cognitive Psychology",
    "Psychology – Developmental Psychology",
    "Psychology – Human Health",
    "Psychology – Sensation and Perception",
    "Psychology – Social Psychology",
    "Public Health",
    "Public Health – Biostatistics",
    "Public Health – Climate and Environmental Sciences",
    "Public Health – Community Health Sciences",
    "Public Health – Epidemiology",
    "Public Health – Health Policy and Management Sciences",
    "Public Health – Medicine Sciences",
    "Real Estate and Development",
    "Russian, East European & Eurasian Studies",
    "Sociology",
    "Sociology – American Studies",
    "Sociology – Culture and Communication",
    "Sociology – Economy and Society",
    "Sociology – International Studies",
    "Sociology – Law and Society",
    "Sociology – Science and Medicine",
    "Sociology – Social Inequality",
    "Spanish Literature",
    "Speculative Design",
    "Structural Engineering",
    "Structural Engineering – Aerospace Structures",
    "Structural Engineering – Civil Structures",
    "Structural Engineering – Geotechnical Engineering",
    "Structural Engineering – Structural Health Monitoring/Non-Destructive Evaluation",
    "Studio",
    "Study of Religion",
    "Theatre",
    "Undeclared – Humanities/Arts",
    "Undeclared – Physical Sciences",
    "Undeclared – Social Sciences",
    "Urban Studies and Planning",
    "World Literature and Culture",
    "Other"
].sort(); // Ensure alphabetical order

// Animation variants
const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } }
};

const popupVariants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
            type: "spring",
            damping: 25,
            stiffness: 300,
            duration: 0.4
        }
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        y: -10,
        transition: {
            duration: 0.2
        }
    }
};

const formItemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.1,
            duration: 0.3
        }
    })
};

const FirstTimeLoginPopup = ({ logtoApiEndpoint, onComplete }: FirstTimeLoginPopupProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        username: "",
        pid: "",
        member_id: "", // Optional
        graduation_year: new Date().getFullYear() + 4, // Default to 4 years from now
        major: ""
    });

    // Validation state
    const [isValid, setIsValid] = useState({
        name: false,
        username: false,
        pid: false,
        graduation_year: true,
        major: false
    });

    // Get current user data
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const auth = Authentication.getInstance();
                const userData = auth.getCurrentUser() as User | null;

                if (userData) {
                    setFormData(prev => ({
                        ...prev,
                        name: userData.name || "",
                        username: userData.username || "",
                        pid: userData.pid || "",
                        member_id: userData.member_id || "",
                        graduation_year: userData.graduation_year || new Date().getFullYear() + 4,
                        major: userData.major || ""
                    }));

                    // Update validation state based on existing data
                    setIsValid({
                        name: !!userData.name,
                        username: !!userData.username,
                        pid: !!userData.pid,
                        graduation_year: true,
                        major: !!userData.major
                    });
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                setErrorMessage("Failed to load your profile information. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, []);

    // Validate form
    useEffect(() => {
        setIsValid({
            name: formData.name.trim().length > 0,
            username: /^[a-z0-9_]{3,20}$/.test(formData.username),
            pid: /^[A-Za-z]\d{8}$/.test(formData.pid),
            graduation_year:
                !isNaN(parseInt(formData.graduation_year.toString())) &&
                parseInt(formData.graduation_year.toString()) >= new Date().getFullYear(),
            major: formData.major !== "" // Check if a major is selected
        });
    }, [formData]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === "graduation_year" ? parseInt(value) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");
        setSuccessMessage("");

        const allRequiredValid = isValid.name && isValid.username && isValid.pid && isValid.graduation_year && isValid.major;

        if (!allRequiredValid) {
            setErrorMessage("Please fill in all required fields with valid information.");
            return;
        }

        setIsSaving(true);

        try {
            // Update PocketBase user
            const auth = Authentication.getInstance();
            const userId = auth.getUserId();

            if (!userId) {
                throw new Error("No user ID found. Please log in again.");
            }

            const updateInstance = Update.getInstance();
            await updateInstance.updateFields("users", userId, {
                name: formData.name,
                username: formData.username,
                pid: formData.pid,
                member_id: formData.member_id || undefined,
                graduation_year: formData.graduation_year,
                major: formData.major,
                signed_up: true // Set signed_up to true after completing onboarding
            });

            console.log("Saving first-time user data with signed_up=true");

            // Update Logto user if endpoint is provided
            if (logtoApiEndpoint) {
                const accessToken = localStorage.getItem("access_token");
                if (accessToken) {
                    const response = await fetch("/api/update-logto-user", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            name: formData.name,
                            custom_data: {
                                username: formData.username,
                                pid: formData.pid,
                                member_id: formData.member_id || "",
                                graduation_year: formData.graduation_year,
                                major: formData.major,
                                signed_up: true
                            }
                        }),
                    });

                    if (!response.ok) {
                        throw new Error("Failed to update Logto user data");
                    }
                }
            }

            console.log("Successfully updated PocketBase user with signed_up=true");

            if (logtoApiEndpoint) {
                console.log("Successfully updated Logto user profile with signed_up=true");
            }

            setSuccessMessage("Profile information saved successfully!");

            // Call onComplete callback if provided
            if (onComplete) {
                setTimeout(() => {
                    onComplete();
                }, 1500); // Show success message briefly before completing
            }
        } catch (error) {
            console.error("Error saving user data:", error);
            // Check if the error might be related to username uniqueness
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            if (errorMsg.toLowerCase().includes("username") || errorMsg.toLowerCase().includes("unique")) {
                setErrorMessage("Failed to save your profile information. The username you chose might already be taken. Please try a different username.");
            } else {
                setErrorMessage("Failed to save your profile information. Please try again.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Check if form can be submitted (all required fields valid)
    const canSubmit = isValid.name && isValid.username && isValid.pid && isValid.graduation_year && isValid.major;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4"
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={overlayVariants}
            >
                <motion.div
                    className="bg-base-100 shadow-xl rounded-xl max-w-2xl w-full"
                    variants={popupVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    <div className="p-6">
                        <div className="mb-6">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold">Complete Your Profile</h2>
                                <div className="badge badge-primary p-3">
                                    <Icon icon="heroicons:user" className="h-5 w-5" />
                                </div>
                            </div>
                            <p className="opacity-70 mt-2">
                                Welcome to IEEE UCSD! Please complete your profile to continue.
                            </p>
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                            >
                                <CustomAlert
                                    type="info"
                                    title="Profile Setup Required"
                                    message="You need to complete this information before you can access the dashboard. All fields marked with * are required."
                                    className="mt-4"
                                />
                            </motion.div>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <motion.span
                                    className="loading loading-spinner loading-lg text-primary"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit}>
                                <div className="space-y-6">
                                    {/* Name Field */}
                                    <motion.div
                                        className="form-control"
                                        custom={0}
                                        variants={formItemVariants}
                                        initial="hidden"
                                        animate="visible"
                                    >
                                        <label className="label">
                                            <span className="label-text font-medium">Full Name <span className="text-error">*</span></span>
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="Enter your full name"
                                            className={`input input-bordered w-full ${!isValid.name && formData.name ? 'input-error' : ''}`}
                                            required
                                        />
                                        {!isValid.name && formData.name && (
                                            <label className="label">
                                                <span className="label-text-alt text-error">Please enter your full name</span>
                                            </label>
                                        )}
                                    </motion.div>

                                    {/* Username Field */}
                                    <motion.div
                                        className="form-control"
                                        custom={1}
                                        variants={formItemVariants}
                                        initial="hidden"
                                        animate="visible"
                                    >
                                        <label className="label">
                                            <span className="label-text font-medium">Username <span className="text-error">*</span></span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                name="username"
                                                value={formData.username}
                                                onChange={handleInputChange}
                                                placeholder="your_username"
                                                className={`input input-bordered w-full ${!isValid.username && formData.username ? 'input-error' : ''}`}
                                                required
                                            />
                                        </div>
                                        {!isValid.username && formData.username && (
                                            <label className="label">
                                                <span className="label-text-alt text-error">Username must be 3-20 characters, lowercase letters, numbers, and underscores only</span>
                                            </label>
                                        )}
                                        <label className="label">
                                            <span className="label-text-alt opacity-70">Choose a unique username for your IEEEUCSD SSO account. This only impacts your SSO login</span>
                                        </label>
                                    </motion.div>

                                    {/* PID Field */}
                                    <motion.div
                                        className="form-control"
                                        custom={2}
                                        variants={formItemVariants}
                                        initial="hidden"
                                        animate="visible"
                                    >
                                        <label className="label">
                                            <span className="label-text font-medium">PID <span className="text-error">*</span></span>
                                        </label>
                                        <input
                                            type="text"
                                            name="pid"
                                            value={formData.pid}
                                            onChange={handleInputChange}
                                            placeholder="A12345678"
                                            className={`input input-bordered w-full ${!isValid.pid && formData.pid ? 'input-error' : ''}`}
                                            required
                                        />
                                        {!isValid.pid && formData.pid && (
                                            <label className="label">
                                                <span className="label-text-alt text-error">PID must be in format A12345678</span>
                                            </label>
                                        )}
                                    </motion.div>

                                    {/* Member ID Field (Optional) */}
                                    <motion.div
                                        className="form-control"
                                        custom={3}
                                        variants={formItemVariants}
                                        initial="hidden"
                                        animate="visible"
                                    >
                                        <label className="label">
                                            <span className="label-text font-medium">IEEE Member ID <span className="text-opacity-50">(optional)</span></span>
                                        </label>
                                        <input
                                            type="text"
                                            name="member_id"
                                            value={formData.member_id}
                                            onChange={handleInputChange}
                                            placeholder="Your IEEE member ID (if you have one)"
                                            className="input input-bordered w-full"
                                        />
                                    </motion.div>

                                    {/* Graduation Year Field */}
                                    <motion.div
                                        className="form-control"
                                        custom={4}
                                        variants={formItemVariants}
                                        initial="hidden"
                                        animate="visible"
                                    >
                                        <label className="label">
                                            <span className="label-text font-medium">Expected Graduation Year <span className="text-error">*</span></span>
                                        </label>
                                        <select
                                            name="graduation_year"
                                            value={formData.graduation_year}
                                            onChange={handleInputChange}
                                            className={`select select-bordered w-full ${!isValid.graduation_year ? 'select-error' : ''}`}
                                            required
                                        >
                                            {Array.from({ length: 10 }, (_, i) => {
                                                const year = new Date().getFullYear() + i;
                                                return (
                                                    <option key={year} value={year}>
                                                        {year}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        {!isValid.graduation_year && (
                                            <label className="label">
                                                <span className="label-text-alt text-error">Please select a valid graduation year</span>
                                            </label>
                                        )}
                                    </motion.div>

                                    {/* Major Field */}
                                    <motion.div
                                        className="form-control"
                                        custom={5}
                                        variants={formItemVariants}
                                        initial="hidden"
                                        animate="visible"
                                    >
                                        <label className="label">
                                            <span className="label-text font-medium">Major <span className="text-error">*</span></span>
                                        </label>
                                        <select
                                            name="major"
                                            value={formData.major}
                                            onChange={handleInputChange}
                                            className={`select select-bordered w-full ${!isValid.major && formData.major ? 'select-error' : ''}`}
                                            required
                                        >
                                            <option value="" disabled>Select your major</option>
                                            {ucsdMajors.map(major => (
                                                <option key={major} value={major}>
                                                    {major}
                                                </option>
                                            ))}
                                        </select>
                                        {!isValid.major && formData.major && (
                                            <label className="label">
                                                <span className="label-text-alt text-error">Please select your major</span>
                                            </label>
                                        )}
                                    </motion.div>

                                    {/* Error/Success Messages */}
                                    <AnimatePresence>
                                        {errorMessage && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                <CustomAlert
                                                    type="error"
                                                    title="Error Saving Profile"
                                                    message={errorMessage}
                                                    icon="heroicons:exclamation-circle"
                                                    className="mt-4"
                                                />
                                            </motion.div>
                                        )}

                                        {successMessage && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                <CustomAlert
                                                    type="success"
                                                    title="Profile Saved"
                                                    message={successMessage}
                                                    icon="heroicons:check-circle"
                                                    className="mt-4"
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* Submit Button */}
                                    <motion.div
                                        className="form-control mt-8"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.6, duration: 0.3 }}
                                    >
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            disabled={!canSubmit || isSaving}
                                        >
                                            {isSaving ? (
                                                <>
                                                    <span className="loading loading-spinner loading-sm"></span>
                                                    Saving...
                                                </>
                                            ) : (
                                                "Complete Profile"
                                            )}
                                        </button>
                                        <p className="text-xs text-center mt-3 opacity-70">
                                            <span className="text-error">*</span> Required fields
                                        </p>
                                    </motion.div>
                                </div>
                            </form>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default FirstTimeLoginPopup; 