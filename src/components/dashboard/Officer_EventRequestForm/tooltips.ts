export const tooltips = {
  attendance: {
    title: "Expected Attendance",
    description:
      "Enter the total number of expected attendees. This helps us plan resources and funding appropriately.",
    maxLimit: "Maximum funding is $10 per student, up to $5,000 per event.",
    eligibility:
      "Only UCSD students, staff, and faculty are eligible to attend.",
  },
  room: {
    title: "Room Booking",
    description:
      "Enter the room number and building where your event will be held. Make sure the room capacity matches your expected attendance.",
    format: "Format: Building Room# (e.g. EBU1 2315)",
    requirements: "Room must be booked through the appropriate UCSD channels.",
  },
  asFunding: {
    title: "AS Funding",
    description:
      "Associated Students can provide funding for your event. Select this option if you need financial support.",
    maxAmount: "Maximum funding varies based on event type and attendance.",
    requirements: "Must submit request at least 6 weeks before event.",
  },
  food: {
    title: "Food & Drinks",
    description:
      "Indicate if you plan to serve food or drinks at your event. This requires additional approvals and documentation.",
    requirements:
      "Must use approved vendors and follow food safety guidelines.",
    timing: "Food orders must be finalized 2 weeks before event.",
  },
  vendor: {
    title: "Vendor Information",
    description:
      "Enter the name and location of the vendor you plan to use for food/drinks.",
    requirements: "Must be an approved AS Funding vendor.",
    format: "Format: Vendor Name - Location",
  },
  invoice: {
    title: "Invoice Details",
    description: "Provide itemized details of your planned purchases.",
    requirements:
      "All items must be clearly listed with quantities and unit costs.",
    format: "Official invoices required 2 weeks before event.",
  },
  tax: {
    title: "Sales Tax",
    description: "Enter the total sales tax amount from your invoice.",
    note: "California sales tax is typically 7.75%",
  },
  tip: {
    title: "Gratuity",
    description: "Enter the tip amount if applicable.",
    note: "Maximum 15% for delivery orders.",
  },
  total: {
    title: "Total Amount",
    description: "The total cost including items, tax, and tip.",
    note: "Cannot exceed your approved funding amount.",
  },
} as const;

export const infoNotes = {
  funding: {
    title: "Funding Guidelines",
    items: [
      "Events funded by programming funds may only admit UC San Diego students, staff or faculty as guests.",
      "Only UC San Diego undergraduate students may receive items funded by the Associated Students.",
      "Event funding is granted up to $10 per student, with a maximum of $5,000 per event.",
      "Submit all documentation at least 6 weeks before the event.",
    ],
  },
  room: {
    title: "Room Booking Format",
    items: [
      "Use the format: Building Room# (e.g. EBU1 2315)",
      "Make sure the room capacity matches your expected attendance",
      "Book through the appropriate UCSD channels",
      "Include any special equipment needs in your request",
    ],
  },
  asFunding: {
    title: "AS Funding Requirements",
    items: [
      "Please make sure the restaurant is a valid AS Funding food vendor!",
      "Make sure to include all items, prices, and additional costs.",
      "We don't recommend paying out of pocket as reimbursements can be complex.",
      "Submit all documentation at least 6 weeks before the event.",
    ],
  },
  invoice: {
    title: "Invoice Requirements",
    items: [
      "Official food invoices will be required 2 weeks before the start of your event.",
      "Format: EventName_OrderLocation_DateOfEvent",
      "Example: QPWorkathon#1_PapaJohns_01/06/2025",
    ],
  },
} as const;
