import React from 'react';
import { AlertTriangle, Clock, FileText, DollarSign } from 'lucide-react';

export default function DisclaimerSection() {
    return (
        <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-6 h-6 text-yellow-600 mt-1" />
                    <div>
                        <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                            Important Event Request Requirements
                        </h3>
                        <p className="text-yellow-700 mb-4">
                            Please read these requirements carefully before submitting your event request.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Timing Requirements */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                        <Clock className="w-5 h-5 text-blue-600 mt-1" />
                        <div>
                            <h4 className="font-semibold text-blue-800 mb-2">Timing Requirements</h4>
                            <ul className="text-sm text-blue-700 space-y-1">
                                <li>• Submit requests at least 2 weeks before your event</li>
                                <li>• Graphics requests need 1 week minimum lead time</li>
                                <li>• AS funding requests require 3 weeks minimum</li>
                                <li>• Room bookings should be secured before submitting</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Documentation Requirements */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                        <FileText className="w-5 h-5 text-green-600 mt-1" />
                        <div>
                            <h4 className="font-semibold text-green-800 mb-2">Required Documentation</h4>
                            <ul className="text-sm text-green-700 space-y-1">
                                <li>• Room booking confirmation (if applicable)</li>
                                <li>• Detailed invoices for AS funding requests</li>
                                <li>• Logo files for custom graphics</li>
                                <li>• Event description and objectives</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Funding Guidelines */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                        <DollarSign className="w-5 h-5 text-purple-600 mt-1" />
                        <div>
                            <h4 className="font-semibold text-purple-800 mb-2">AS Funding Guidelines</h4>
                            <ul className="text-sm text-purple-700 space-y-1">
                                <li>• Maximum $5,000 per event</li>
                                <li>• Itemized receipts required</li>
                                <li>• Food/drinks must follow university guidelines</li>
                                <li>• AS logo required on all funded materials</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Approval Process */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-orange-600 mt-1" />
                        <div>
                            <h4 className="font-semibold text-orange-800 mb-2">Approval Process</h4>
                            <ul className="text-sm text-orange-700 space-y-1">
                                <li>• All requests require VC Operations / Executive approval</li>
                                <li>• Large events may need executive board approval</li>
                                <li>• Changes after approval require re-submission</li>
                                <li>• You'll receive email updates on status</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-1" />
                    <div>
                        <h4 className="font-semibold text-red-800 mb-2">Important Notes</h4>
                        <ul className="text-sm text-red-700 space-y-2">
                            <li>
                                <strong>Food Safety:</strong> All food must be from approved AS vendors and follow
                                university food safety guidelines. Home-cooked food is not permitted unless
                                approved by VC Operations.
                            </li>
                            <li>
                                <strong>Liability:</strong> Event organizers are responsible for ensuring all
                                activities comply with university policies and safety requirements.
                            </li>
                            <li>
                                <strong>Cancellation:</strong> If you need to cancel or significantly modify
                                your event, notify us immediately to avoid unnecessary expenses / hassles.
                            </li>
                            <li>
                                <strong>Post-Event:</strong> Submit photos within
                                48 hours of your event within the Google Drive for record-keeping.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Need Help?</h4>
                <p className="text-sm text-gray-700">
                    If you have questions about any of these requirements or need assistance with your
                    event planning, please contact VC Operations on Slack
                </p>
            </div>
        </div>
    );
}
