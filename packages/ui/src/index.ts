import { ServiceCategory } from "@yardmatch/contracts";

export interface BookedCalendarSlotShowcase {
  startLabel: string;
  endLabel: string;
  status: "booked";
}

export interface BookedBusinessShowcase {
  name: string;
  city: string;
  state: string;
  rating: string;
  sponsored: boolean;
  ownerName: string;
  avatarUrl: string;
  addressLine: string;
  distanceMiles: number;
  mapX: number;
  mapY: number;
  specialties: string[];
  crewSizeLabel: string;
  fullyBookedLabel: string;
  slots: BookedCalendarSlotShowcase[];
}

export interface PropertyMaintenanceChecklistItem {
  serviceTitle: string;
  status: "due" | "done";
  taskTitle: string;
  guidance: string;
  completedLabel?: string;
}

export interface CrewHiringWindow {
  dayLabel: string;
  timeLabel: string;
}

export interface CrewHiringOpportunity {
  id: string;
  businessName: string;
  ownerName: string;
  avatarUrl: string;
  city: string;
  state: string;
  distanceMiles: number;
  urgencyLabel: string;
  rating: string;
  crewGapLabel: string;
  needsLabel: string;
  trainingProvided: boolean;
  guidanceStyle: string;
  equipmentProvided: string;
  payRange: string;
  requestOutcome: "success" | "filled";
  hiringWindows: CrewHiringWindow[];
  serviceNeeds: string[];
}

export interface CrewAssignment {
  id: string;
  businessName: string;
  serviceLabel: string;
  isoDate: string;
  dateLabel: string;
  dayLabel: string;
  monthLabel: string;
  timeLabel: string;
  addressLine: string;
  crewLead: string;
  notes: string;
  equipmentLabel: string;
  plannedHours: number;
  expectedEarnings: string;
}

function buildAvatarDataUrl(initials: string, background: string, accent: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${background}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="38" fill="url(#bg)" />
      <circle cx="80" cy="58" r="26" fill="rgba(255,255,255,0.92)" />
      <path d="M40 134c5-24 22-38 40-38s35 14 40 38" fill="rgba(255,255,255,0.92)" />
      <rect x="38" y="109" width="84" height="34" rx="17" fill="rgba(20,40,29,0.16)" />
      <text x="80" y="134" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#14281d">
        ${initials}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const serviceCategoryLabels: Record<ServiceCategory, string> = {
  "lawn-mowing": "Lawn mowing",
  "hedge-trimming": "Hedge trimming",
  "mulch-installation": "Mulch installation",
  "seasonal-cleanup": "Seasonal cleanup",
  "weed-control": "Weed control",
  "irrigation-check": "Irrigation check",
  "leaf-blowing": "Leaf blowing",
  "aeration": "Aeration",
  "fertilization": "Fertilization",
  "gutter-cleaning": "Gutter cleaning",
  "snow-shoveling": "Snow shoveling",
  "ice-melt-salting": "Ice melt and salting",
  "snow-blowing": "Snow blowing"
};

export const landingMetrics = [
  {
    label: "Average first booking time",
    value: "under 6 minutes"
  },
  {
    label: "Refund window",
    value: "48 hours after service"
  },
  {
    label: "Dedicated mobile apps",
    value: "3 role-specific apps"
  }
];

export const faqItems = [
  {
    question: "How do customers pick a landscaper?",
    answer:
      "YardMatch ranks providers by distance, availability, reviews, and the services they actually offer."
  },
  {
    question: "How are schedule conflicts handled?",
    answer:
      "Providers connect their Apple, Google, or Outlook calendars and YardMatch publishes a shared availability feed."
  },
  {
    question: "Can landscaping businesses hire crew members through YardMatch?",
    answer:
      "Yes. Business owners can run the customer-facing operation while individual crew members use a separate app to manage assignments, availability, and day-of-job work."
  },
  {
    question: "What happens if the job quality is poor?",
    answer:
      "Customers can open a support ticket from the booking record and request a refund review tied to the payment."
  }
];

export const homeownerSteps = [
  "Enter your address and property details.",
  "Compare landscapers by rating, distance, and next slot.",
  "Book, pay, and track the service in one place."
];

export const providerSteps = [
  "Create a business profile with service radius, specialties, and staffing needs.",
  "Sync your calendar and set weekly availability for quoted jobs.",
  "Manage clients, crews, payouts, and support escalations."
];

export const crewSteps = [
  "Create a crew profile with skills, travel radius, and work preferences.",
  "Review assignments, meeting points, and day-of-job notes in one app.",
  "Track completed work and get role-specific support without owner-side clutter."
];

export const crewHiringOpportunities: CrewHiringOpportunity[] = [
  {
    id: "greenside-route-support",
    businessName: "GreenStride Lawn Co.",
    ownerName: "Ariana Fields",
    avatarUrl: buildAvatarDataUrl("AF", "#8fd694", "#f6d365"),
    city: "Nashville",
    state: "TN",
    distanceMiles: 4.2,
    urgencyLabel: "Hiring this week",
    rating: "4.9",
    crewGapLabel: "Needs 2 more crew members",
    needsLabel: "Weekly mowing route support",
    trainingProvided: true,
    guidanceStyle: "Crew lead rides with new hires for the first 3 shifts.",
    equipmentProvided: "Truck, trailer, mower, trimmers, and blower provided.",
    payRange: "$19-$23/hr",
    requestOutcome: "success",
    hiringWindows: [
      { dayLabel: "Mon", timeLabel: "7:00 AM - 3:00 PM" },
      { dayLabel: "Wed", timeLabel: "7:00 AM - 3:00 PM" },
      { dayLabel: "Fri", timeLabel: "7:00 AM - 1:00 PM" }
    ],
    serviceNeeds: ["Lawn mowing", "Edging", "Leaf blowing"]
  },
  {
    id: "terracut-bed-work",
    businessName: "TerraCut Studio",
    ownerName: "Luis Ortega",
    avatarUrl: buildAvatarDataUrl("LO", "#7cc6fe", "#f4978e"),
    city: "Nashville",
    state: "TN",
    distanceMiles: 6.8,
    urgencyLabel: "Open next 2 weeks",
    rating: "4.8",
    crewGapLabel: "Needs 1 planting and mulch helper",
    needsLabel: "Bed work and cleanup support",
    trainingProvided: true,
    guidanceStyle: "On-the-job walkthrough at each property before work starts.",
    equipmentProvided: "Hand tools, wheelbarrows, and dump trailer provided.",
    payRange: "$20-$24/hr",
    requestOutcome: "success",
    hiringWindows: [
      { dayLabel: "Tue", timeLabel: "8:00 AM - 4:00 PM" },
      { dayLabel: "Thu", timeLabel: "8:00 AM - 4:00 PM" }
    ],
    serviceNeeds: ["Mulch installation", "Hedge trimming", "Seasonal cleanup"]
  },
  {
    id: "cedarstone-route-helpers",
    businessName: "Cedarstone Landscaping",
    ownerName: "Nina Brooks",
    avatarUrl: buildAvatarDataUrl("NB", "#c3aed6", "#ffd6a5"),
    city: "Nashville",
    state: "TN",
    distanceMiles: 8.1,
    urgencyLabel: "Starting tomorrow",
    rating: "4.7",
    crewGapLabel: "Needs 2 route helpers",
    needsLabel: "Mixed maintenance and irrigation support",
    trainingProvided: false,
    guidanceStyle: "Best fit for crew members comfortable jumping into established routes.",
    equipmentProvided: "Company van and larger equipment provided. Hand tools preferred.",
    payRange: "$21-$25/hr",
    requestOutcome: "filled",
    hiringWindows: [
      { dayLabel: "Mon", timeLabel: "6:30 AM - 2:30 PM" },
      { dayLabel: "Tue", timeLabel: "6:30 AM - 2:30 PM" },
      { dayLabel: "Thu", timeLabel: "6:30 AM - 2:30 PM" }
    ],
    serviceNeeds: ["Irrigation check", "Gutter cleaning", "Lawn mowing"]
  },
  {
    id: "blueharbor-weekend-coverage",
    businessName: "Blue Harbor Outdoor",
    ownerName: "Camila Reyes",
    avatarUrl: buildAvatarDataUrl("CR", "#84dcc6", "#ffa69e"),
    city: "Nashville",
    state: "TN",
    distanceMiles: 9.7,
    urgencyLabel: "Weekend coverage needed",
    rating: "4.8",
    crewGapLabel: "Needs 3 weekend crew members",
    needsLabel: "Backlog relief for booked-out properties",
    trainingProvided: true,
    guidanceStyle: "Shadow shift available on the first Saturday.",
    equipmentProvided: "All mowing and cleanup equipment provided.",
    payRange: "$18-$22/hr",
    requestOutcome: "success",
    hiringWindows: [
      { dayLabel: "Sat", timeLabel: "7:30 AM - 3:30 PM" },
      { dayLabel: "Sun", timeLabel: "8:00 AM - 2:00 PM" }
    ],
    serviceNeeds: ["Lawn mowing", "Hedge trimming", "Mulch installation"]
  }
];

export const crewAssignments: CrewAssignment[] = [
  {
    id: "crew-assignment-1",
    businessName: "GreenStride Lawn Co.",
    serviceLabel: "Weekly mow and edge route",
    isoDate: "2026-05-27",
    dateLabel: "May 27, 2026",
    dayLabel: "Tue",
    monthLabel: "May 27",
    timeLabel: "7:00 AM - 3:00 PM",
    addressLine: "1482 Ashland City Hwy, Nashville, TN 37218",
    crewLead: "Ariana Fields",
    notes: "Meet at the yard by 6:40 AM for route loadout.",
    equipmentLabel: "All equipment provided",
    plannedHours: 8,
    expectedEarnings: "$176"
  },
  {
    id: "crew-assignment-2",
    businessName: "TerraCut Studio",
    serviceLabel: "Mulch and cleanup crew",
    isoDate: "2026-05-29",
    dateLabel: "May 29, 2026",
    dayLabel: "Thu",
    monthLabel: "May 29",
    timeLabel: "8:00 AM - 4:00 PM",
    addressLine: "504 W 35th Ave, Nashville, TN 37209",
    crewLead: "Luis Ortega",
    notes: "First stop is a two-property bed refresh job.",
    equipmentLabel: "Hand tools and trailer provided",
    plannedHours: 8,
    expectedEarnings: "$184"
  },
  {
    id: "crew-assignment-3",
    businessName: "Blue Harbor Outdoor",
    serviceLabel: "Weekend backlog coverage",
    isoDate: "2026-05-31",
    dateLabel: "May 31, 2026",
    dayLabel: "Sat",
    monthLabel: "May 31",
    timeLabel: "7:30 AM - 3:30 PM",
    addressLine: "1028 Harbor View Dr, Nashville, TN 37214",
    crewLead: "Camila Reyes",
    notes: "Shadow shift starts with front-yard trimming and mowing.",
    equipmentLabel: "Mowers, trimmers, and blower provided",
    plannedHours: 8,
    expectedEarnings: "$168"
  }
];

export const crewAssignmentHistory: CrewAssignment[] = [
  {
    id: "crew-history-1",
    businessName: "GreenStride Lawn Co.",
    serviceLabel: "Weekly mow and edge route",
    isoDate: "2026-05-20",
    dateLabel: "May 20, 2026",
    dayLabel: "Tue",
    monthLabel: "May 20",
    timeLabel: "7:00 AM - 3:00 PM",
    addressLine: "1482 Ashland City Hwy, Nashville, TN 37218",
    crewLead: "Ariana Fields",
    notes: "Completed six-property route with front-yard edging focus.",
    equipmentLabel: "All equipment provided",
    plannedHours: 8,
    expectedEarnings: "$176"
  },
  {
    id: "crew-history-2",
    businessName: "TerraCut Studio",
    serviceLabel: "Mulch and cleanup crew",
    isoDate: "2026-05-15",
    dateLabel: "May 15, 2026",
    dayLabel: "Thu",
    monthLabel: "May 15",
    timeLabel: "8:00 AM - 4:00 PM",
    addressLine: "504 W 35th Ave, Nashville, TN 37209",
    crewLead: "Luis Ortega",
    notes: "Completed bed cleanup and fresh mulch install at two properties.",
    equipmentLabel: "Hand tools and trailer provided",
    plannedHours: 8,
    expectedEarnings: "$184"
  },
  {
    id: "crew-history-3",
    businessName: "Blue Harbor Outdoor",
    serviceLabel: "Weekend backlog coverage",
    isoDate: "2026-05-10",
    dateLabel: "May 10, 2026",
    dayLabel: "Sat",
    monthLabel: "May 10",
    timeLabel: "7:30 AM - 3:30 PM",
    addressLine: "1028 Harbor View Dr, Nashville, TN 37214",
    crewLead: "Camila Reyes",
    notes: "Covered mowing and hedge trimming backlog on three properties.",
    equipmentLabel: "Mowers, trimmers, and blower provided",
    plannedHours: 8,
    expectedEarnings: "$168"
  }
];

export const bookedBusinessShowcase: BookedBusinessShowcase[] = [
  {
    name: "GreenStride Lawn Co.",
    city: "Nashville",
    state: "TN",
    rating: "4.9",
    sponsored: true,
    ownerName: "Ariana Fields",
    avatarUrl: buildAvatarDataUrl("AF", "#8fd694", "#f6d365"),
    addressLine: "1482 Ashland City Hwy, Nashville, TN 37218",
    distanceMiles: 2.4,
    mapX: 24,
    mapY: 30,
    specialties: ["Lawn mowing", "Leaf blowing", "Seasonal cleanup"],
    crewSizeLabel: "3-person crew",
    fullyBookedLabel: "Fully booked today",
    slots: [
      { startLabel: "8:00 AM", endLabel: "10:00 AM", status: "booked" },
      { startLabel: "10:00 AM", endLabel: "12:00 PM", status: "booked" },
      { startLabel: "12:00 PM", endLabel: "2:00 PM", status: "booked" },
      { startLabel: "2:00 PM", endLabel: "4:00 PM", status: "booked" }
    ]
  },
  {
    name: "TerraCut Studio",
    city: "Nashville",
    state: "TN",
    rating: "4.8",
    sponsored: false,
    ownerName: "Luis Ortega",
    avatarUrl: buildAvatarDataUrl("LO", "#7cc6fe", "#f4978e"),
    addressLine: "504 W 35th Ave, Nashville, TN 37209",
    distanceMiles: 4.1,
    mapX: 58,
    mapY: 50,
    specialties: ["Hedge trimming", "Mulch installation", "Aeration"],
    crewSizeLabel: "2-person crew",
    fullyBookedLabel: "Booked solid on route",
    slots: [
      { startLabel: "7:00 AM", endLabel: "9:00 AM", status: "booked" },
      { startLabel: "9:00 AM", endLabel: "11:00 AM", status: "booked" },
      { startLabel: "11:00 AM", endLabel: "1:00 PM", status: "booked" },
      { startLabel: "1:00 PM", endLabel: "3:00 PM", status: "booked" }
    ]
  },
  {
    name: "Cedarstone Landscaping",
    city: "Nashville",
    state: "TN",
    rating: "4.7",
    sponsored: true,
    ownerName: "Nina Brooks",
    avatarUrl: buildAvatarDataUrl("NB", "#c3aed6", "#ffd6a5"),
    addressLine: "2234 Cedar Ln, Nashville, TN 37212",
    distanceMiles: 5.6,
    mapX: 49,
    mapY: 36,
    specialties: ["Irrigation check", "Gutter cleaning", "Leaf blowing"],
    crewSizeLabel: "4-person crew",
    fullyBookedLabel: "No same-day openings",
    slots: [
      { startLabel: "8:00 AM", endLabel: "10:00 AM", status: "booked" },
      { startLabel: "10:00 AM", endLabel: "12:00 PM", status: "booked" },
      { startLabel: "12:00 PM", endLabel: "2:00 PM", status: "booked" },
      { startLabel: "2:00 PM", endLabel: "4:00 PM", status: "booked" }
    ]
  },
  {
    name: "Northgate Yard Works",
    city: "Nashville",
    state: "TN",
    rating: "4.9",
    sponsored: false,
    ownerName: "Marcus Hale",
    avatarUrl: buildAvatarDataUrl("MH", "#90be6d", "#577590"),
    addressLine: "881 Northgate Blvd, Nashville, TN 37207",
    distanceMiles: 7.8,
    mapX: 73,
    mapY: 20,
    specialties: ["Fertilization", "Weed control", "Lawn mowing"],
    crewSizeLabel: "2-person crew",
    fullyBookedLabel: "Booked through the afternoon",
    slots: [
      { startLabel: "6:00 AM", endLabel: "8:00 AM", status: "booked" },
      { startLabel: "8:00 AM", endLabel: "10:00 AM", status: "booked" },
      { startLabel: "10:00 AM", endLabel: "12:00 PM", status: "booked" },
      { startLabel: "12:00 PM", endLabel: "2:00 PM", status: "booked" }
    ]
  },
  {
    name: "Blue Harbor Outdoor",
    city: "Nashville",
    state: "TN",
    rating: "4.8",
    sponsored: false,
    ownerName: "Camila Reyes",
    avatarUrl: buildAvatarDataUrl("CR", "#84dcc6", "#ffa69e"),
    addressLine: "1028 Harbor View Dr, Nashville, TN 37214",
    distanceMiles: 8.9,
    mapX: 78,
    mapY: 70,
    specialties: ["Lawn mowing", "Hedge trimming", "Mulch installation"],
    crewSizeLabel: "5-person crew",
    fullyBookedLabel: "Every 2-hour block reserved",
    slots: [
      { startLabel: "7:00 AM", endLabel: "9:00 AM", status: "booked" },
      { startLabel: "9:00 AM", endLabel: "11:00 AM", status: "booked" },
      { startLabel: "11:00 AM", endLabel: "1:00 PM", status: "booked" },
      { startLabel: "1:00 PM", endLabel: "3:00 PM", status: "booked" }
    ]
  },
  {
    name: "Summit Snow & Lawn",
    city: "Nashville",
    state: "TN",
    rating: "4.9",
    sponsored: true,
    ownerName: "Derek Vaughn",
    avatarUrl: buildAvatarDataUrl("DV", "#a9def9", "#e4c1f9"),
    addressLine: "3175 Charlotte Pike, Nashville, TN 37209",
    distanceMiles: 11.2,
    mapX: 34,
    mapY: 76,
    specialties: ["Snow shoveling", "Ice melt and salting", "Seasonal cleanup"],
    crewSizeLabel: "3-person winter crew",
    fullyBookedLabel: "Route fully committed",
    slots: [
      { startLabel: "6:00 AM", endLabel: "8:00 AM", status: "booked" },
      { startLabel: "8:00 AM", endLabel: "10:00 AM", status: "booked" },
      { startLabel: "10:00 AM", endLabel: "12:00 PM", status: "booked" },
      { startLabel: "12:00 PM", endLabel: "2:00 PM", status: "booked" }
    ]
  }
];

export const bookedBusinessSearchContext = {
  resultCountLabel: "6 fully booked landscaping businesses",
  dateRangeLabel: "Today, May 10 - Sat, May 23",
  userAddressLabel: "220 Willow St, Nashville, TN 37206",
  mapEmbedUrl:
    "https://www.openstreetmap.org/export/embed.html?bbox=-86.91%2C36.10%2C-86.63%2C36.29&layer=mapnik&marker=36.1749%2C-86.7271"
};

export const quoteEnginePrinciples = [
  "Start with the address, not a long property questionnaire.",
  "Estimate turf, shrubs, driveway, and sidewalk work automatically.",
  "Only ask follow-up questions when quote confidence is too low."
];

export const propertyMaintenanceChecklist: PropertyMaintenanceChecklistItem[] = [
  {
    serviceTitle: "Lawn care",
    status: "due",
    taskTitle: "Weekly mow and edge",
    guidance:
      "During the growing season, keeping turf trimmed consistently helps prevent stress, weed spread, and patchy overgrowth before it becomes a bigger cleanup job."
  },
  {
    serviceTitle: "Shrub and bed care",
    status: "due",
    taskTitle: "Trim shrubs and refresh bed edges",
    guidance:
      "Routine shrub shaping and crisp bed edges keep growth under control, improve curb appeal, and make future maintenance faster for each visit."
  },
  {
    serviceTitle: "Seasonal cleanup",
    status: "due",
    taskTitle: "Clear leaves and storm debris",
    guidance:
      "Leaf buildup and debris can trap moisture, smother turf, and make walkways messy, so seasonal cleanups are best handled before the pileup turns into restoration work."
  },
  {
    serviceTitle: "Irrigation check",
    status: "done",
    taskTitle: "Spring sprinkler inspection",
    guidance:
      "Checking sprinkler coverage and leaks early helps avoid dry spots, overwatering, and wasted water costs throughout the season.",
    completedLabel: "Completed Apr 2026 • Up-to-date until early summer"
  }
];
