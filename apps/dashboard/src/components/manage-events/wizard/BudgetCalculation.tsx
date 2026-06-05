import { Calculator, AlertTriangle } from "lucide-react";

const COST_PER_PERSON = 10;
const MAX_BUDGET = 5000;

interface BudgetCalculationProps {
  estimatedAttendance: number;
  compact?: boolean;
}

export function BudgetCalculation({ estimatedAttendance, compact = false }: BudgetCalculationProps) {
  if (!estimatedAttendance || estimatedAttendance <= 0) return null;

  const calculatedBudget = estimatedAttendance * COST_PER_PERSON;
  const recommendedBudget = Math.min(calculatedBudget, MAX_BUDGET);
  const maxReached = calculatedBudget > MAX_BUDGET;

  if (compact) {
    return (
      <div className="text-sm space-y-1 mt-2">
        <div className="flex justify-between text-gray-600">
          <span>Expected Attendance:</span>
          <span className="font-medium">{estimatedAttendance.toLocaleString()} people</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Cost per person:</span>
          <span className="font-medium">${COST_PER_PERSON}</span>
        </div>
        <div className="flex justify-between text-gray-600">
          <span>Calculated Budget:</span>
          <span className="font-medium">${calculatedBudget.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-semibold text-gray-900 pt-1 border-t">
          <span>Recommended Budget:</span>
          <span>
            ${recommendedBudget.toLocaleString()}
            {maxReached && (
              <span className="text-amber-600 text-xs font-normal ml-1">
                (Maximum budget reached)
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="h-4 w-4 text-blue-600" />
        <h4 className="text-sm font-semibold text-blue-800">Budget Calculation</h4>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-blue-700">
          <span>Expected Attendance:</span>
          <span className="font-medium">{estimatedAttendance.toLocaleString()} people</span>
        </div>
        <div className="flex justify-between text-blue-700">
          <span>Cost per person:</span>
          <span className="font-medium">${COST_PER_PERSON}</span>
        </div>
        <div className="flex justify-between text-blue-700">
          <span>Calculated Budget:</span>
          <span className="font-medium">${calculatedBudget.toLocaleString()}</span>
        </div>
        <div className="flex justify-between font-bold text-blue-900 pt-2 border-t border-blue-200">
          <span>Recommended Budget:</span>
          <span>
            ${recommendedBudget.toLocaleString()}
            {maxReached && (
              <span className="text-amber-600 text-xs font-normal ml-1">
                (Maximum budget reached)
              </span>
            )}
          </span>
        </div>
      </div>
      {maxReached && (
        <div className="flex items-start gap-2 mt-3 pt-2 border-t border-blue-200">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            The maximum AS funding budget is ${MAX_BUDGET.toLocaleString()} per event.
          </p>
        </div>
      )}
    </div>
  );
}
