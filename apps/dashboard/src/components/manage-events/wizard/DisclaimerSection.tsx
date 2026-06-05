import { AlertTriangle, Brain, Clock, FileText, DollarSign, CheckCircle, Info, MessageSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface DisclaimerSectionProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function DisclaimerSection({
  checked,
  onCheckedChange,
}: DisclaimerSectionProps) {
  return (
    <div className="space-y-5">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-yellow-800">
              Important Event Request Requirements
            </h3>
            <p className="text-sm text-yellow-700 mt-1">
              Please read these requirements carefully before submitting your event request.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 text-sm">
        {/* AI Receipt Parsing */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Brain className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-blue-800 text-xs uppercase tracking-wide">
                AI-Powered Receipt Parsing
              </h4>
              <p className="text-blue-700 mt-1 text-xs">
                When uploading receipts for your events, they will be automatically parsed by our AI system.
                It is <strong>your responsibility to verify the extracted data</strong> and fix any discrepancies.
                Once submitted, the request cannot be changed.
              </p>
            </div>
          </div>
        </div>

        {/* Submission Deadlines */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-gray-900 text-xs uppercase tracking-wide">
                Submission Deadlines
              </h4>
              <ul className="list-disc list-inside space-y-1 mt-1.5 text-gray-600 text-xs">
                <li>AS Funding requires submission <strong>5 weeks</strong> before the event date</li>
                <li>VC Operations requires submission <strong>7 business weeks</strong> before the event date if you want AS Funding (for Food or Flyers)</li>
                <li>VC Operations requires submission <strong>4 weeks</strong> before the event date without AS Funding (for Food or Flyers)</li>
                <li>Check Slack for updated dates for submission</li>
                <li>Room bookings should be secured before submitting</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Required Documentation */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-gray-900 text-xs uppercase tracking-wide">
                Required Documentation
              </h4>
              <ul className="list-disc list-inside space-y-1 mt-1.5 text-gray-600 text-xs">
                <li>Room booking confirmation (if applicable)</li>
                <li>Detailed invoices for AS funding requests</li>
                <li>Logo files for custom graphics</li>
                <li>Event description and objectives</li>
              </ul>
            </div>
          </div>
        </div>

        {/* AS Funding Guidelines */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <DollarSign className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-amber-800 text-xs uppercase tracking-wide">
                AS Funding Guidelines
              </h4>
              <ul className="list-disc list-inside space-y-1 mt-1.5 text-amber-700 text-xs">
                <li>Maximum <strong>$5,000</strong> per event</li>
                <li>Itemized receipts required</li>
                <li>Food/drinks must follow university guidelines</li>
                <li>AS logo required on all funded materials</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Approval Process */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-gray-900 text-xs uppercase tracking-wide">
                Approval Process
              </h4>
              <ul className="list-disc list-inside space-y-1 mt-1.5 text-gray-600 text-xs">
                <li>All requests require VC Operations / Executive approval</li>
                <li>Large events may need executive board approval</li>
                <li>Changes after approval require re-submission</li>
                <li>You'll receive email updates on status</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-red-800 text-xs uppercase tracking-wide">
                Important Notes
              </h4>
              <div className="space-y-1.5 mt-1.5 text-red-700 text-xs">
                <p><strong>Food Safety:</strong> All food must be from approved AS vendors and follow university food safety guidelines. Home-cooked food is not permitted unless approved by VC Operations.</p>
                <p><strong>Liability:</strong> Event organizers are responsible for ensuring all activities comply with university policies and safety requirements.</p>
                <p><strong>Cancellation:</strong> If you need to cancel or significantly modify your event, notify us immediately to avoid unnecessary expenses / hassles.</p>
                <p><strong>Post-Event:</strong> Submit photos within 48 hours of your event within the Google Drive for record-keeping.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Need Help */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <MessageSquare className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-green-800 text-xs uppercase tracking-wide">
                Need Help?
              </h4>
              <p className="text-green-700 mt-1 text-xs">
                If you have questions about any of these requirements or need assistance with your event planning, please contact <strong>VC Operations on Slack</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 pt-4 border-t">
        <Checkbox
          id="disclaimer"
          checked={checked}
          onCheckedChange={(checked) => onCheckedChange(checked as boolean)}
        />
        <label
          htmlFor="disclaimer"
          className="text-sm text-gray-700 cursor-pointer"
        >
          I have read and understood the above requirements. I agree to comply with all
          policies and requirements for hosting this event.
        </label>
      </div>
    </div>
  );
}
