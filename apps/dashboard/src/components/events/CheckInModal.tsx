"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Check, Loader2 } from "lucide-react";

interface CheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (code: string, foodPreference?: string) => void;
  eventHasFood: boolean;
  eventName?: string;
  isSubmitting?: boolean;
}

const FOOD_PREFERENCES = [
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "gluten-free", label: "Gluten Free" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Kosher" },
  { value: "no-preference", label: "No Preference" },
];

export function CheckInModal({
  isOpen,
  onClose,
  onSubmit,
  eventHasFood,
  eventName = "this event",
  isSubmitting = false,
}: CheckInModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState("");
  const [foodPreference, setFoodPreference] = useState("");
  const [error, setError] = useState("");

  const handleCodeSubmit = () => {
    if (!code.trim()) {
      setError("Please enter the event code");
      return;
    }
    setError("");
    if (eventHasFood) {
      setStep(2);
    } else {
      onSubmit(code.trim().toUpperCase());
    }
  };

  const handleFoodSubmit = () => {
    onSubmit(code.trim().toUpperCase(), foodPreference || undefined);
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setCode("");
      setFoodPreference("");
      setError("");
    }, 150);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg">
            {step === 1 ? "Enter Event Code" : "Food Preference"}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {step === 1
              ? `Enter the code to check in to ${eventName}`
              : "Select your dietary preference for this event"}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4">
          {step === 1 ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="event-code" className="text-xs font-medium text-muted-foreground">
                  Event Code
                </Label>
                <Input
                  id="event-code"
                  placeholder="e.g. IEEE2024"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCodeSubmit();
                  }}
                  className="text-center text-lg font-mono tracking-wider uppercase h-12"
                  autoFocus
                />
                {error && (
                  <p className="text-xs text-destructive">{error}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-xs font-medium">Code accepted</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="food-preference" className="text-xs font-medium text-muted-foreground">
                  Dietary Preference (Optional)
                </Label>
                <Select
                  value={foodPreference}
                  onValueChange={setFoodPreference}
                >
                  <SelectTrigger id="food-preference">
                    <SelectValue placeholder="Select your preference" />
                  </SelectTrigger>
                  <SelectContent>
                    {FOOD_PREFERENCES.map((pref) => (
                      <SelectItem key={pref.value} value={pref.value}>
                        {pref.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  This helps us prepare the right amount of food.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 flex gap-2">
          {step === 2 && (
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              disabled={isSubmitting}
              size="sm"
            >
              Back
            </Button>
          )}
          <Button
            onClick={step === 1 ? handleCodeSubmit : handleFoodSubmit}
            disabled={isSubmitting || (step === 1 && !code.trim())}
            className="flex-1"
            size="sm"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                Checking in...
              </>
            ) : step === 1 ? (
              <>
                Continue
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </>
            ) : (
              <>
                Complete Check-in
                <Check className="w-3.5 h-3.5 ml-1.5" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
