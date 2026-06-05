import { useState } from "react";
import { AlertTriangle, Brain, FileText, Shield, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

interface AIWarningStepProps {
  onContinue: () => void;
  isLoading?: boolean;
}

export default function AIWarningStep({
  onContinue,
  isLoading = false,
}: AIWarningStepProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center pb-2">
        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6 mx-auto relative">
          <Brain className="w-10 h-10 text-amber-600" />
          <div className="absolute -bottom-1 -right-1 bg-yellow-100 p-1.5 rounded-full border-2 border-white">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-gray-900">
          AI-Powered Receipt Processing
        </CardTitle>
        <CardDescription className="text-gray-600 text-lg mt-2 leading-relaxed">
          When uploading a receipt, it will be automatically parsed by our AI system.
          While accurate,{" "}
          <span className="font-semibold text-gray-900">
            it is your responsibility to verify the data
          </span>{" "}
          and fix any discrepancies.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Warning Alert */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-yellow-800 mb-1">
                Important Note
              </h4>
              <p className="text-yellow-700 text-sm">
                Please double-check all extracted amounts, dates, and vendor names.{" "}
                <strong>Once submitted, the request cannot be changed.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Data Processing Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="font-medium text-gray-900 text-sm">
                Receipt Data
              </h5>
              <p className="text-gray-600 text-xs mt-1">
                Amounts, dates, and vendor information are extracted automatically
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
            <Shield className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="font-medium text-gray-900 text-sm">
                Data Security
              </h5>
              <p className="text-gray-600 text-xs mt-1">
                Your receipt data is processed securely and stored encrypted
              </p>
            </div>
          </div>
        </div>

        {/* Acknowledgment Checkbox */}
        <div className="flex items-start space-x-3 p-4 border border-gray-200 rounded-lg">
          <Checkbox
            id="ai-acknowledgment"
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            className="mt-0.5"
          />
          <label
            htmlFor="ai-acknowledgment"
            className="text-sm text-gray-700 cursor-pointer select-none"
          >
            I understand that AI-generated data may contain errors and it is my
            responsibility to verify all information before submission.
          </label>
        </div>
      </CardContent>

      <CardFooter className="flex justify-center pt-2">
        <Button
          onClick={onContinue}
          disabled={!acknowledged || isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-600/20 px-8 py-6 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <span className="mr-2">Processing...</span>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </>
          ) : (
            <>
              I Understand, Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
