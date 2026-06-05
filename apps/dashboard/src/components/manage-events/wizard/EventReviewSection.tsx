import { format } from "date-fns";
import { MapPin, Calendar, Users, Utensils, Printer, Image, Camera, DoorOpen, ArrowRight } from "lucide-react";
import type { EventFormData, EventRequest } from "../types";
import { BudgetCalculation } from "./BudgetCalculation";
import { formatDepartmentLabel, formatEventTypeLabel } from "../constants";

interface EventReviewSectionProps {
  data: EventFormData;
  originalData?: Partial<EventRequest>;
}

export function EventReviewSection({ data, originalData }: EventReviewSectionProps) {
  const isEditing = !!originalData;

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), "MMMM d, yyyy 'at' h:mm a");
  };

  const getRequirements = () => {
    const reqs = [];
    if (data.foodDrinksBeingServed) reqs.push({ icon: Utensils, label: "Food/Drinks" });
    if (data.willOrHaveRoomBooking) reqs.push({ icon: DoorOpen, label: "Room Booking" });
    if (data.needsFlyers) reqs.push({ icon: Printer, label: "Flyers" });
    if (data.needsGraphics) reqs.push({ icon: Image, label: "Graphics" });
    if (data.photographyNeeded) reqs.push({ icon: Camera, label: "Photography" });
    return reqs;
  };

  const totalInvoiceAmount = data.invoices.reduce(
    (sum, inv) => sum + (inv.total || inv.amount || 0),
    0
  );

  // Build list of changes when editing
  const changes: { label: string; before: string; after: string }[] = [];
  if (isEditing && originalData) {
    const o = originalData;
    if (o.eventName && o.eventName !== data.eventName)
      changes.push({ label: "Event Name", before: o.eventName, after: data.eventName });
    if (o.eventDescription !== undefined && o.eventDescription !== data.eventDescription)
      changes.push({ label: "Description", before: o.eventDescription || "(empty)", after: data.eventDescription || "(empty)" });
    if (o.eventType && o.eventType !== data.eventType)
      changes.push({
        label: "Event Type",
        before: formatEventTypeLabel(o.eventType),
        after: formatEventTypeLabel(data.eventType),
      });
    if (o.department !== data.department)
      changes.push({
        label: "Department",
        before: o.department ? formatDepartmentLabel(o.department) : "(none)",
        after: data.department ? formatDepartmentLabel(data.department) : "(none)",
      });
    if (o.location && o.location !== data.location)
      changes.push({ label: "Location", before: o.location, after: data.location });
    if (o.startDate && o.startDate !== data.startDate)
      changes.push({ label: "Start Date", before: formatDate(o.startDate), after: formatDate(data.startDate) });
    if (o.endDate && o.endDate !== data.endDate)
      changes.push({ label: "End Date", before: formatDate(o.endDate), after: formatDate(data.endDate) });
    if (o.eventCode && o.eventCode !== data.eventCode)
      changes.push({ label: "Event Code", before: o.eventCode, after: data.eventCode });
    if ((o.foodDrinksBeingServed ?? o.hasFood) !== data.foodDrinksBeingServed)
      changes.push({ label: "Food/Drinks", before: (o.foodDrinksBeingServed ?? o.hasFood) ? "Yes" : "No", after: data.foodDrinksBeingServed ? "Yes" : "No" });
    if (o.willOrHaveRoomBooking !== data.willOrHaveRoomBooking)
      changes.push({ label: "Room Booking", before: o.willOrHaveRoomBooking ? "Yes" : "No", after: data.willOrHaveRoomBooking ? "Yes" : "No" });
    if ((o.needsASFunding ?? o.asFundingRequired) !== data.needsASFunding)
      changes.push({ label: "AS Funding", before: (o.needsASFunding ?? o.asFundingRequired) ? "Yes" : "No", after: data.needsASFunding ? "Yes" : "No" });
    if (o.needsFlyers !== data.needsFlyers)
      changes.push({ label: "Needs Flyers", before: o.needsFlyers ? "Yes" : "No", after: data.needsFlyers ? "Yes" : "No" });
    if (o.needsGraphics !== data.needsGraphics)
      changes.push({ label: "Needs Graphics", before: o.needsGraphics ? "Yes" : "No", after: data.needsGraphics ? "Yes" : "No" });
    if (o.photographyNeeded !== data.photographyNeeded)
      changes.push({ label: "Photography", before: o.photographyNeeded ? "Yes" : "No", after: data.photographyNeeded ? "Yes" : "No" });
    if (o.estimatedAttendance !== data.estimatedAttendance)
      changes.push({ label: "Est. Attendance", before: String(o.estimatedAttendance ?? 0), after: String(data.estimatedAttendance) });

    const origInvoiceTotal = (o.invoices || []).reduce((s: number, inv) => s + (inv.total || inv.amount || 0), 0);
    if (Math.abs(origInvoiceTotal - totalInvoiceAmount) > 0.01)
      changes.push({ label: "Invoice Total", before: `$${origInvoiceTotal.toFixed(2)}`, after: `$${totalInvoiceAmount.toFixed(2)}` });
  }

  return (
    <div className="space-y-6">
      {isEditing && changes.length > 0 ? (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-amber-800 mb-3">
            Changes Summary ({changes.length} field{changes.length !== 1 ? "s" : ""} modified)
          </h4>
          <div className="space-y-2">
            {changes.map((change) => (
              <div key={change.label} className="flex items-start gap-2 text-sm">
                <span className="text-amber-700 font-medium min-w-30 shrink-0">
                  {change.label}:
                </span>
                <span className="text-red-600 line-through wrap-break-word">
                  {change.before}
                </span>
                <ArrowRight className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-green-600 font-medium wrap-break-word">
                  {change.after}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : isEditing ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">
            No changes detected. The event request is unchanged.
          </p>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            Please review all information before submitting. Once submitted, your
            event request will be reviewed by officers.
          </p>
        </div>
      )}

      <div className="space-y-6">
        <ReviewSection title="Basic Information">
          <ReviewItem label="Event Name" value={data.eventName} />
          <ReviewItem
            label="Description"
            value={data.eventDescription}
            multiline
          />
          <ReviewItem label="Event Type" value={formatEventTypeLabel(data.eventType)} />
          {data.department && (
            <ReviewItem label="Department" value={formatDepartmentLabel(data.department)} />
          )}
        </ReviewSection>

        <ReviewSection title="Logistics">
          <ReviewItem
            label="Location"
            value={data.location}
            icon={<MapPin className="h-4 w-4" />}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReviewItem
              label="Start Date"
              value={formatDate(data.startDate)}
              icon={<Calendar className="h-4 w-4" />}
            />
            <ReviewItem
              label="End Date"
              value={formatDate(data.endDate)}
              icon={<Calendar className="h-4 w-4" />}
            />
          </div>
          <ReviewItem label="Event Code" value={data.eventCode} />
        </ReviewSection>

        <ReviewSection title="Requirements & Marketing">
          <div className="flex flex-wrap gap-2">
            {getRequirements().length === 0 ? (
              <span className="text-sm text-gray-500">No special requirements</span>
            ) : (
              getRequirements().map((req) => (
                <span
                  key={req.label}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700"
                >
                  <req.icon className="h-3.5 w-3.5" />
                  {req.label}
                </span>
              ))
            )}
          </div>
          <ReviewItem
            label="Estimated Attendance"
            value={data.estimatedAttendance.toString()}
            icon={<Users className="h-4 w-4" />}
          />
          <BudgetCalculation estimatedAttendance={data.estimatedAttendance} compact />
          {data.needsFlyers && data.flyerType.length > 0 && (
            <ReviewItem label="Flyer Type" value={data.flyerType.join(", ")} />
          )}
          {data.needsFlyers && data.otherFlyerType && (
            <ReviewItem label="Other Flyer Type" value={data.otherFlyerType} />
          )}
          {data.needsFlyers && data.flyerAdvertisingStartDate > 0 && (
            <ReviewItem label="Advertising Start" value={formatDate(data.flyerAdvertisingStartDate)} />
          )}
          {data.needsFlyers && data.flyerAdditionalRequests && (
            <ReviewItem label="Flyer Notes" value={data.flyerAdditionalRequests} multiline />
          )}
          {(data.needsFlyers || data.needsGraphics) && data.advertisingFormat && (
            <ReviewItem label="Preferred Format" value={data.advertisingFormat} />
          )}
          {(data.needsFlyers || data.needsGraphics) && data.additionalSpecifications && (
            <ReviewItem label="Additional Specifications" value={data.additionalSpecifications} multiline />
          )}
          {data.needsGraphics && data.graphicsUploadNote && (
            <ReviewItem label="Graphics Delivery Note" value={data.graphicsUploadNote} />
          )}
          {data.requiredLogos.length > 0 && (
            <ReviewItem label="Required Logos" value={data.requiredLogos.join(", ")} />
          )}
        </ReviewSection>

        <ReviewSection title="Funding">
          <ReviewItem
            label="AS Funding Requested"
            value={data.needsASFunding ? "Yes" : "No"}
          />
          {data.invoices.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Invoices ({data.invoices.length})
              </p>
              <div className="space-y-3">
                {data.invoices.map((invoice, idx) => (
                  <div
                    key={invoice._id}
                    className="p-3 bg-gray-50 rounded-lg text-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">
                        #{idx + 1}: {invoice.vendor}
                      </span>
                      <span className="font-bold">
                        ${(invoice.total || invoice.amount || 0).toFixed(2)}
                      </span>
                    </div>
                    {invoice.items.length > 0 && (
                      <div className="space-y-1 pl-2 border-l-2 border-gray-200">
                        {invoice.items.map((item, itemIdx) => (
                          <div key={itemIdx} className="flex justify-between text-xs text-gray-500">
                            <span>{item.description} (x{item.quantity})</span>
                            <span>${item.total.toFixed(2)}</span>
                          </div>
                        ))}
                        {(invoice.tax > 0 || invoice.tip > 0) && (
                          <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-200">
                            {invoice.tax > 0 && <span>Tax: ${invoice.tax.toFixed(2)}</span>}
                            {invoice.tip > 0 && <span>Tip: ${invoice.tip.toFixed(2)}</span>}
                          </div>
                        )}
                      </div>
                    )}
                    {invoice.invoiceFile && (
                      <span className="text-xs text-green-600">File attached</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-between items-center pt-2 mt-2 border-t">
                <span className="text-sm font-medium">Total:</span>
                <span className="font-bold text-lg">
                  ${totalInvoiceAmount.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </ReviewSection>
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 mb-3 pb-2 border-b">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ReviewItem({
  label,
  value,
  icon,
  multiline = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div>
      <span className="text-sm text-gray-500">{label}</span>
      <div
        className={`flex items-center gap-2 text-sm font-medium text-gray-900 ${
          multiline ? "mt-1" : ""
        }`}
      >
        {icon}
        {multiline ? (
          <p className="whitespace-pre-wrap">{value}</p>
        ) : (
          <span>{value || "-"}</span>
        )}
      </div>
    </div>
  );
}
