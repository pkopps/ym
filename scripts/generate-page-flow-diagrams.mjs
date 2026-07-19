import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outDir = "docs/page-flow-diagrams";
const shotDir = "docs/page-flow-screenshots/thumbs";

await fs.mkdir(outDir, { recursive: true });

const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function wrapText(text, maxChars = 24) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function labelBubble(text, x, y, cls = "edgeLabel", anchor = "middle") {
  if (!text) return "";

  const lines = wrapText(text, 20);
  const width = Math.max(110, Math.max(...lines.map((line) => line.length)) * 9 + 24);
  const height = 24 + (lines.length - 1) * 17;
  const rectX = anchor === "middle" ? x - width / 2 : x;

  return `<rect x="${rectX}" y="${y - 18}" width="${width}" height="${height}" rx="12" fill="#fbfaf4" stroke="#d9dfd2"/>${lines
    .map(
      (line, index) =>
        `<text class="${cls}" x="${x}" y="${y + index * 17}" text-anchor="${anchor}">${esc(line)}</text>`,
    )
    .join("")}`;
}

function inferSide(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "down" : "up";
}

function arrow(edge, nodes, card) {
  const from = nodes[edge.from];
  const to = nodes[edge.to];
  if (!from || !to) throw new Error(`Missing edge node ${edge.from} -> ${edge.to}`);

  const fw = from.w || card.w;
  const fh = from.h || card.h;
  const tw = to.w || card.w;
  const th = to.h || card.h;
  const side = edge.side || inferSide(from, to);
  let x1;
  let y1;
  let x2;
  let y2;

  if (side === "right") {
    x1 = from.x + fw;
    y1 = from.y + fh / 2;
    x2 = to.x;
    y2 = to.y + th / 2;
  } else if (side === "left") {
    x1 = from.x;
    y1 = from.y + fh / 2;
    x2 = to.x + tw;
    y2 = to.y + th / 2;
  } else if (side === "down") {
    x1 = from.x + fw / 2;
    y1 = from.y + fh;
    x2 = to.x + tw / 2;
    y2 = to.y;
  } else {
    x1 = from.x + fw / 2;
    y1 = from.y;
    x2 = to.x + tw / 2;
    y2 = to.y + th;
  }

  const dx = Math.max(60, Math.abs(x2 - x1) * 0.45);
  const dy = Math.max(60, Math.abs(y2 - y1) * 0.45);
  let d;

  if (side === "right" || side === "left") {
    const curve = side === "right" ? dx : -dx;
    d = `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
  } else {
    const curve = side === "down" ? dy : -dy;
    d = `M ${x1} ${y1} C ${x1} ${y1 + curve}, ${x2} ${y2 - curve}, ${x2} ${y2}`;
  }

  const midX = edge.labelX ?? (x1 + x2) / 2;
  const midY = edge.labelY ?? (y1 + y2) / 2 - 10;
  return `<path d="${d}" fill="none" stroke="#547665" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow)"/>${labelBubble(edge.label, midX, midY)}`;
}

function nodeFill(node, card) {
  const w = node.w || card.w;
  const h = node.h || card.h;
  return `<rect class="cardFill" x="${node.x}" y="${node.y}" width="${w}" height="${h}" rx="20"/>`;
}

function nodeFrame(node, card) {
  const w = node.w || card.w;
  const h = node.h || card.h;
  const labelY = node.img ? node.y + card.imageTop + card.imageH + 36 : node.y + h / 2 - (node.sub ? 6 : -8);
  const subY = labelY + 25;
  const noteLines = node.lines || [];

  return `<rect class="cardBorder" x="${node.x}" y="${node.y}" width="${w}" height="${h}" rx="20"/>` +
    `<text class="routeLabel" x="${node.x + w / 2}" y="${labelY}" text-anchor="middle">${esc(node.label)}</text>` +
    noteLines
      .map(
        (line, index) =>
          `<text class="subLabel" x="${node.x + w / 2}" y="${labelY + 34 + index * 22}" text-anchor="middle">${esc(line)}</text>`,
      )
      .join("") +
    (node.sub
      ? `<text class="subLabel" x="${node.x + w / 2}" y="${subY}" text-anchor="middle">${esc(node.sub)}</text>`
      : "");
}

function section(text, x, y) {
  return `<text class="section" x="${x}" y="${y}">${esc(text)}</text>`;
}

function svgShell(width, height, title, subtitle, body, { includeBackground = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <marker id="arrow" markerWidth="12" markerHeight="12" refX="9" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#547665"/></marker>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#102b1f" flood-opacity="0.10"/></filter>
      <style>
        .bg { fill: #f7f4e8; }
        .title { font: 800 42px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #102b1f; }
        .subtitle { font: 500 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #486255; }
        .section { font: 800 24px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #255d3b; }
        .cardFill { fill: #fffefa; stroke: #d7dfd2; stroke-width: 1.5; filter: url(#shadow); }
        .cardBorder { fill: none; stroke: #d7dfd2; stroke-width: 2; }
        .routeLabel { font: 800 21px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #102b1f; }
        .subLabel { font: 500 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #5d6d64; }
        .edgeLabel { font: 700 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #2d5b42; }
      </style>
    </defs>
    ${includeBackground ? `<rect class="bg" width="100%" height="100%"/>` : ""}
    ${title ? `<text class="title" x="60" y="68">${esc(title)}</text>` : ""}
    ${subtitle ? `<text class="subtitle" x="60" y="105">${esc(subtitle)}</text>` : ""}
    ${body}
  </svg>`;
}

async function createDiagram({ file, width, height, title, subtitle, card, nodes, edges, sections = [] }) {
  const nodeValues = Object.values(nodes);
  const arrows = edges.map((edge) => arrow(edge, nodes, card)).join("\n");
  const fills = nodeValues.map((node) => nodeFill(node, card)).join("\n");
  const sectionText = sections.map((item) => section(item.text, item.x, item.y)).join("\n");
  const baseSvg = svgShell(width, height, title, subtitle, `${sectionText}\n${arrows}\n${fills}`);
  const overlays = [{ input: Buffer.from(baseSvg), top: 0, left: 0 }];

  for (const node of nodeValues) {
    if (!node.img) continue;

    const w = node.w || card.w;
    const img = await sharp(path.join(shotDir, node.img))
      .resize(card.imageW, card.imageH, { fit: "cover", position: "top" })
      .png()
      .toBuffer();

    overlays.push({
      input: img,
      left: Math.round(node.x + (w - card.imageW) / 2),
      top: Math.round(node.y + card.imageTop),
    });
  }

  const foregroundSvg = svgShell(width, height, "", "", nodeValues.map((node) => nodeFrame(node, card)).join("\n"), {
    includeBackground: false,
  });
  overlays.push({ input: Buffer.from(foregroundSvg), top: 0, left: 0 });

  await sharp({ create: { width, height, channels: 4, background: "#f7f4e8" } })
    .composite(overlays)
    .png()
    .toFile(path.join(outDir, file));
}

const mainCard = { w: 300, h: 292, imageW: 260, imageH: 217, imageTop: 18 };
await createDiagram({
  file: "main-web-flow.png",
  width: 1900,
  height: 1500,
  title: "Main Web Flow",
  subtitle: "Public entry points, booking search, account creation, and role workspaces.",
  card: mainCard,
  sections: [
    { text: "Customer booking path", x: 440, y: 150 },
    { text: "Provider path", x: 440, y: 690 },
    { text: "Crew path", x: 440, y: 1130 },
  ],
  nodes: {
    home: { x: 80, y: 560, img: "home.png", label: "/", sub: "Home" },
    customer: { x: 440, y: 180, img: "customer-search.png", label: "/customer", sub: "Search services" },
    listings: { x: 800, y: 180, img: "customer-listings.png", label: "/customer/listings", sub: "Provider results" },
    auth: { x: 1160, y: 70, img: "auth.png", label: "/auth", sub: "Signup role picker" },
    loginCustomer: { x: 1160, y: 400, img: "login-customer.png", label: "/login/customer", sub: "Customer login" },
    customerDashboard: { x: 1520, y: 240, img: "customer-dashboard.png", label: "/customer/dashboard", sub: "Customer workspace" },
    help: { x: 1520, y: 590, img: "help.png", label: "/help", sub: "Support path" },
    provider: { x: 440, y: 730, img: "provider.png", label: "/provider", sub: "Business overview" },
    createProvider: { x: 800, y: 730, img: "auth-provider-create.png", label: "/auth/provider/create", sub: "Business signup" },
    providerManagement: { x: 1160, y: 730, img: "provider-management.png", label: "/provider/management", sub: "Management portal" },
    authCrew: { x: 440, y: 1160, img: "auth-crew.png", label: "/auth/crew", sub: "Crew signup" },
    crew: { x: 800, y: 1160, img: "crew.png", label: "/crew", sub: "Crew dashboard" },
  },
  edges: [
    { from: "home", to: "customer", label: "Book a service", labelX: 310, labelY: 375 },
    { from: "customer", to: "listings", label: "Search", labelX: 620, labelY: 300 },
    { from: "listings", to: "auth", label: "Create account", labelX: 1030, labelY: 150 },
    { from: "listings", to: "loginCustomer", label: "Customer login", labelX: 1040, labelY: 445 },
    { from: "auth", to: "customerDashboard", label: "Signup success", labelX: 1390, labelY: 190 },
    { from: "loginCustomer", to: "customerDashboard", label: "Login success", labelX: 1390, labelY: 425 },
    { from: "listings", to: "help", label: "No coverage / issue", labelX: 1260, labelY: 600 },
    { from: "home", to: "provider", label: "For providers", labelX: 300, labelY: 735 },
    { from: "provider", to: "createProvider", label: "Get started", labelX: 620, labelY: 850 },
    { from: "createProvider", to: "providerManagement", label: "Create account", labelX: 980, labelY: 850 },
    { from: "home", to: "authCrew", label: "For crews", labelX: 300, labelY: 1050 },
    { from: "authCrew", to: "crew", label: "Submit profile", labelX: 620, labelY: 1280 },
  ],
});

const authCard = { w: 270, h: 262, imageW: 232, imageH: 193, imageTop: 16 };
await createDiagram({
  file: "signup-login-flow.png",
  width: 1780,
  height: 1680,
  title: "Signup And Login Flow",
  subtitle: "Role selection branches into signup, social completion, login, and workspace destinations.",
  card: authCard,
  sections: [
    { text: "Signup", x: 80, y: 150 },
    { text: "Login", x: 80, y: 1030 },
  ],
  nodes: {
    auth: { x: 80, y: 330, img: "auth.png", label: "/auth", sub: "Role picker" },
    authCustomer: { x: 420, y: 120, img: "auth-customer.png", label: "/auth/customer", sub: "Customer signup" },
    authProviderCreate: { x: 420, y: 410, img: "auth-provider-create.png", label: "/auth/provider/create", sub: "Provider signup" },
    authCrew: { x: 420, y: 700, img: "auth-crew.png", label: "/auth/crew", sub: "Crew signup" },
    authComplete: { x: 760, y: 410, img: "auth-complete.png", label: "/auth/complete", sub: "Social callback" },
    customerDashboard: { x: 1100, y: 120, img: "customer-dashboard.png", label: "/customer/dashboard", sub: "Customer workspace" },
    providerManagement: { x: 1100, y: 410, img: "provider-management.png", label: "/provider/management", sub: "Provider portal" },
    crew: { x: 1100, y: 700, img: "crew.png", label: "/crew", sub: "Crew dashboard" },
    ops: { x: 1440, y: 410, img: "ops.png", label: "/ops", sub: "Ops dashboard" },
    login: { x: 80, y: 1180, img: "login.png", label: "/login", sub: "Role picker" },
    loginCustomer: { x: 420, y: 1080, img: "login-customer.png", label: "/login/customer", sub: "Customer login" },
    loginProvider: { x: 760, y: 1080, img: "login-provider.png", label: "/login/provider", sub: "Provider login" },
    loginCrew: { x: 1100, y: 1080, img: "login-crew.png", label: "/login/crew", sub: "Crew login" },
    loginOps: { x: 1440, y: 1080, img: "login-ops.png", label: "/login/ops", sub: "Ops login" },
    loginCustomerDest: { x: 420, y: 1360, img: "customer-dashboard.png", label: "/customer/dashboard", sub: "After login" },
    loginProviderDest: { x: 760, y: 1360, img: "provider-management.png", label: "/provider/management", sub: "After login" },
    loginCrewDest: { x: 1100, y: 1360, img: "crew.png", label: "/crew", sub: "After login" },
    loginOpsDest: { x: 1440, y: 1360, img: "ops.png", label: "/ops", sub: "After login" },
  },
  edges: [
    { from: "auth", to: "authCustomer", label: "Customer", labelX: 350, labelY: 270 },
    { from: "auth", to: "authProviderCreate", label: "Provider", labelX: 350, labelY: 465 },
    { from: "auth", to: "authCrew", label: "Crew", labelX: 350, labelY: 660 },
    { from: "authCustomer", to: "customerDashboard", label: "Create account", labelX: 910, labelY: 240 },
    { from: "authProviderCreate", to: "providerManagement", label: "Create account", labelX: 930, labelY: 530 },
    { from: "authCrew", to: "crew", label: "Submit profile", labelX: 930, labelY: 820 },
    { from: "authCustomer", to: "authComplete", label: "Social auth", labelX: 680, labelY: 265 },
    { from: "authProviderCreate", to: "authComplete", label: "Social auth", labelX: 710, labelY: 530 },
    { from: "authCrew", to: "authComplete", label: "Social auth", labelX: 700, labelY: 735 },
    { from: "authComplete", to: "customerDashboard", label: "Customer role", labelX: 1040, labelY: 350 },
    { from: "authComplete", to: "providerManagement", label: "Provider role", labelX: 1040, labelY: 530 },
    { from: "authComplete", to: "crew", label: "Crew role", labelX: 1040, labelY: 700 },
    { from: "authComplete", to: "ops", label: "Ops role", labelX: 1280, labelY: 530 },
    { from: "login", to: "loginCustomer", label: "Customer", labelX: 360, labelY: 1210 },
    { from: "login", to: "loginProvider", label: "Provider", labelX: 540, labelY: 1280 },
    { from: "login", to: "loginCrew", label: "Crew", labelX: 710, labelY: 1340 },
    { from: "login", to: "loginOps", label: "Ops", labelX: 900, labelY: 1400 },
    { from: "loginCustomer", to: "loginCustomerDest", side: "down", label: "Success", labelX: 555, labelY: 1340 },
    { from: "loginProvider", to: "loginProviderDest", side: "down", label: "Success", labelX: 895, labelY: 1340 },
    { from: "loginCrew", to: "loginCrewDest", side: "down", label: "Success", labelX: 1235, labelY: 1340 },
    { from: "loginOps", to: "loginOpsDest", side: "down", label: "Success", labelX: 1575, labelY: 1340 },
  ],
});

const workspaceCard = { w: 285, h: 274, imageW: 245, imageH: 204, imageTop: 16 };
await createDiagram({
  file: "workspace-flow.png",
  width: 1700,
  height: 1450,
  title: "Workspace Flow",
  subtitle: "Authenticated customer, provider, crew, and ops work areas with their main internal paths.",
  card: workspaceCard,
  sections: [
    { text: "Customer workspace", x: 80, y: 155 },
    { text: "Provider workspace", x: 80, y: 515 },
    { text: "Crew and ops workspace", x: 80, y: 950 },
  ],
  nodes: {
    customer: { x: 80, y: 185, img: "customer-search.png", label: "/customer", sub: "Search services" },
    listings: { x: 445, y: 185, img: "customer-listings.png", label: "/customer/listings", sub: "Results" },
    dashboard: { x: 810, y: 185, img: "customer-dashboard.png", label: "/customer/dashboard", sub: "Account" },
    customerHistory: { x: 1175, y: 185, img: "customer-history.png", label: "/customer/history", sub: "Redirect/history tab" },
    provider: { x: 80, y: 545, img: "provider.png", label: "/provider", sub: "Overview" },
    management: { x: 445, y: 545, img: "provider-management.png", label: "/provider/management", sub: "Operations board" },
    payments: { x: 810, y: 500, img: "provider-payments.png", label: "/provider/payments", sub: "Payments" },
    partnerships: { x: 1175, y: 600, img: "provider-partnerships.png", label: "/provider/partnerships", sub: "Partnerships" },
    crew: { x: 80, y: 980, img: "crew.png", label: "/crew", sub: "Dashboard" },
    crewSchedule: { x: 445, y: 980, img: "crew-schedule.png", label: "/crew/schedule", sub: "Schedule" },
    crewHistory: { x: 810, y: 980, img: "crew-schedule-history.png", label: "/crew/schedule/history", sub: "Past work" },
    ops: { x: 1175, y: 1040, img: "ops.png", label: "/ops", sub: "Operations" },
  },
  edges: [
    { from: "customer", to: "listings", label: "Search", labelX: 400, labelY: 315 },
    { from: "listings", to: "dashboard", label: "Book / account", labelX: 760, labelY: 315 },
    { from: "dashboard", to: "customerHistory", label: "Past visits", labelX: 1130, labelY: 315 },
    { from: "provider", to: "management", label: "Manage", labelX: 400, labelY: 675 },
    { from: "management", to: "payments", label: "Payments", labelX: 755, labelY: 570 },
    { from: "management", to: "partnerships", label: "Partnerships", labelX: 940, labelY: 720 },
    { from: "crew", to: "crewSchedule", label: "Schedule", labelX: 400, labelY: 1110 },
    { from: "crewSchedule", to: "crewHistory", label: "History", labelX: 760, labelY: 1110 },
    { from: "management", to: "ops", label: "Ops oversight", labelX: 1035, labelY: 900 },
    { from: "crewHistory", to: "ops", label: "Field status", labelX: 1110, labelY: 1120 },
  ],
});

const focusedCard = { w: 300, h: 292, imageW: 260, imageH: 217, imageTop: 18 };
await createDiagram({
  file: "customer-workspace-flow.png",
  width: 1680,
  height: 1120,
  title: "Customer Workspace Flow",
  subtitle: "Search, provider recommendations, account entry, request flow, history, and support paths.",
  card: focusedCard,
  sections: [
    { text: "Booking entry", x: 80, y: 155 },
    { text: "Account and support", x: 80, y: 625 },
  ],
  nodes: {
    customer: { x: 80, y: 190, img: "customer-search.png", label: "/customer", sub: "Search services" },
    listings: { x: 440, y: 190, img: "customer-listings.png", label: "/customer/listings", sub: "Recommendations" },
    auth: { x: 800, y: 80, img: "auth.png", label: "/auth", sub: "Create account" },
    loginCustomer: { x: 800, y: 410, img: "login-customer.png", label: "/login/customer", sub: "Customer login" },
    dashboard: { x: 1160, y: 245, img: "customer-dashboard.png", label: "/customer/dashboard", sub: "Live bookings" },
    requestFlow: { x: 1160, y: 655, img: "customer-dashboard.png", label: "/customer/dashboard", sub: "?flow=request" },
    historyView: { x: 800, y: 760, img: "customer-history.png", label: "/customer/dashboard", sub: "?view=history" },
    historyRedirect: { x: 440, y: 760, img: "customer-history.png", label: "/customer/history", sub: "Redirect page" },
    help: { x: 80, y: 760, img: "help.png", label: "/help", sub: "Support" },
  },
  edges: [
    { from: "customer", to: "listings", label: "Search", labelX: 400, labelY: 320 },
    { from: "listings", to: "auth", label: "Create account", labelX: 730, labelY: 170 },
    { from: "listings", to: "loginCustomer", label: "Log in", labelX: 730, labelY: 445 },
    { from: "auth", to: "dashboard", label: "Signup success", labelX: 1110, labelY: 225 },
    { from: "loginCustomer", to: "dashboard", label: "Login success", labelX: 1120, labelY: 480 },
    { from: "customer", to: "dashboard", label: "Profile menu", labelX: 680, labelY: 255 },
    { from: "dashboard", to: "requestFlow", side: "down", label: "New request", labelX: 1310, labelY: 625 },
    { from: "dashboard", to: "historyView", label: "Past visits", labelX: 1080, labelY: 715 },
    { from: "historyRedirect", to: "historyView", label: "Server redirect", labelX: 705, labelY: 890 },
    { from: "dashboard", to: "help", label: "Booking issue", labelX: 715, labelY: 680 },
    { from: "dashboard", to: "loginCustomer", label: "No session", labelX: 1080, labelY: 410 },
  ],
});

await createDiagram({
  file: "provider-workspace-flow.png",
  width: 2100,
  height: 1650,
  title: "Provider Workspace Flow",
  subtitle: "Provider overview, account creation/login, management, payments, partnerships, marketplace, and support paths.",
  card: focusedCard,
  sections: [
    { text: "Provider account path", x: 80, y: 155 },
    { text: "Management destinations", x: 800, y: 155 },
    { text: "Header, marketplace, and trust links", x: 80, y: 965 },
  ],
  nodes: {
    provider: { x: 80, y: 310, img: "provider.png", label: "/provider", sub: "Overview" },
    createProvider: { x: 460, y: 170, img: "auth-provider-create.png", label: "/auth/provider/create", sub: "Create account" },
    loginProvider: { x: 460, y: 520, img: "login-provider.png", label: "/login/provider", sub: "Provider login" },
    management: { x: 840, y: 350, img: "provider-management.png", label: "/provider/management", sub: "Management portal" },
    payments: { x: 1220, y: 160, img: "provider-payments.png", label: "/provider/payments", sub: "Payments" },
    partnerships: { x: 1220, y: 510, img: "provider-partnerships.png", label: "/provider/partnerships", sub: "Partnerships" },
    crew: { x: 1600, y: 160, img: "crew.png", label: "/crew", sub: "Find crew members" },
    help: { x: 1600, y: 510, img: "help.png", label: "/help", sub: "Support" },
    customer: { x: 460, y: 1060, img: "customer-search.png", label: "/customer", sub: "Property owners" },
    listings: { x: 840, y: 1060, img: "customer-listings.png", label: "/customer/listings", sub: "Marketplace results" },
    verification: { x: 1220, y: 960, img: "provider-verification.png", label: "/provider-verification", sub: "Trust page" },
    standards: { x: 1220, y: 1280, img: "provider-standards.png", label: "/provider-standards", sub: "Standards" },
    header: {
      x: 80,
      y: 1110,
      w: 300,
      h: 210,
      label: "Provider header",
      sub: "Menus and utility links",
      lines: ["create, manage, payments", "crew, customer, help, docs"],
    },
    apiDocs: { x: 1600, y: 1110, w: 300, h: 210, label: "API docs", sub: "/api/docs", lines: ["Configured API server"] },
  },
  edges: [
    { from: "provider", to: "createProvider", label: "Get started", labelX: 405, labelY: 300 },
    { from: "provider", to: "loginProvider", label: "Business login", labelX: 410, labelY: 600 },
    { from: "createProvider", to: "management", label: "Create account", labelX: 780, labelY: 330 },
    { from: "loginProvider", to: "management", label: "Login success", labelX: 780, labelY: 580 },
    { from: "management", to: "payments", label: "Payments", labelX: 1180, labelY: 300 },
    { from: "management", to: "partnerships", label: "Partnerships", labelX: 1180, labelY: 600 },
    { from: "management", to: "crew", label: "Find crew", labelX: 1430, labelY: 250 },
    { from: "management", to: "help", label: "Job support", labelX: 1430, labelY: 610 },
    { from: "partnerships", to: "createProvider", label: "Join", labelX: 920, labelY: 500 },
    { from: "provider", to: "verification", label: "Verification", labelX: 730, labelY: 850 },
    { from: "provider", to: "standards", label: "Standards", labelX: 730, labelY: 1100 },
    { from: "header", to: "customer", label: "Owners", labelX: 420, labelY: 1210 },
    { from: "customer", to: "listings", label: "Search", labelX: 800, labelY: 1190 },
    { from: "listings", to: "verification", label: "Trust links", labelX: 1180, labelY: 1130 },
    { from: "verification", to: "standards", side: "down", label: "Related", labelX: 1370, labelY: 1265 },
    { from: "header", to: "apiDocs", label: "Docs", labelX: 1020, labelY: 1280 },
  ],
});

await createDiagram({
  file: "crew-workspace-flow.png",
  width: 1500,
  height: 1040,
  title: "Crew Workspace Flow",
  subtitle: "Crew discovery, signup/login, schedule, past jobs, and assignment support.",
  card: focusedCard,
  sections: [
    { text: "Crew entry", x: 80, y: 155 },
    { text: "Signed-in schedule", x: 760, y: 155 },
  ],
  nodes: {
    crew: { x: 80, y: 330, img: "crew.png", label: "/crew", sub: "Open crew work" },
    authCrew: { x: 440, y: 170, img: "auth-crew.png", label: "/auth/crew", sub: "Crew signup" },
    loginCrew: { x: 440, y: 500, img: "login-crew.png", label: "/login/crew", sub: "Crew login" },
    schedule: { x: 800, y: 330, img: "crew-schedule.png", label: "/crew/schedule", sub: "Upcoming schedule" },
    history: { x: 1160, y: 330, img: "crew-schedule-history.png", label: "/crew/schedule/history", sub: "Past jobs" },
    help: { x: 800, y: 670, img: "help.png", label: "/help", sub: "Assignment support" },
  },
  edges: [
    { from: "crew", to: "authCrew", label: "Sign up", labelX: 380, labelY: 300 },
    { from: "crew", to: "loginCrew", label: "Crew login", labelX: 380, labelY: 600 },
    { from: "authCrew", to: "crew", label: "Submit profile", labelX: 310, labelY: 210 },
    { from: "loginCrew", to: "crew", label: "Login success", labelX: 310, labelY: 740 },
    { from: "crew", to: "schedule", label: "Profile menu", labelX: 640, labelY: 430 },
    { from: "schedule", to: "history", label: "History", labelX: 1120, labelY: 430 },
    { from: "history", to: "schedule", label: "Schedule", labelX: 1120, labelY: 615 },
    { from: "crew", to: "help", label: "Support", labelX: 610, labelY: 760 },
    { from: "schedule", to: "loginCrew", label: "No session", labelX: 710, labelY: 590 },
    { from: "history", to: "loginCrew", label: "No session", labelX: 875, labelY: 720 },
  ],
});

const contentCard = { w: 278, h: 268, imageW: 238, imageH: 198, imageTop: 16 };
await createDiagram({
  file: "content-local-policy-flow.png",
  width: 2040,
  height: 1850,
  title: "Content, Local, And Policy Flow",
  subtitle: "Footer/content navigation, Barnegat launch pages, service pages, booking entry, and trust-policy pages.",
  card: contentCard,
  sections: [
    { text: "Content and launch pages", x: 80, y: 155 },
    { text: "Service and local SEO pages", x: 80, y: 650 },
    { text: "Trust and policy pages", x: 80, y: 1265 },
  ],
  nodes: {
    footer: { x: 80, y: 270, w: 278, h: 190, label: "Global footer", sub: "Content links", lines: ["about, help, launch", "services, provider, crew"] },
    about: { x: 440, y: 170, img: "about.png", label: "/about", sub: "About" },
    help: { x: 800, y: 170, img: "help.png", label: "/help", sub: "Help center" },
    launch: { x: 1160, y: 170, img: "barnegat.png", label: "/barnegat-nj", sub: "Launch area" },
    customer: { x: 1660, y: 360, img: "customer-search.png", label: "/customer", sub: "Find provider" },
    localMowing: { x: 440, y: 670, img: "barnegat-lawn-mowing.png", label: "/barnegat-nj/lawn-mowing", sub: "Local mowing" },
    localCleanup: { x: 800, y: 670, img: "barnegat-yard-cleanup.png", label: "/barnegat-nj/yard-cleanup", sub: "Local cleanup" },
    serviceMowing: { x: 1160, y: 670, img: "service-lawn-mowing.png", label: "/services/lawn-mowing", sub: "Service landing" },
    serviceCleanup: { x: 1660, y: 760, img: "service-yard-cleanup.png", label: "/services/yard-cleanup", sub: "Service landing" },
    provider: { x: 440, y: 1320, img: "provider.png", label: "/provider", sub: "Provider overview" },
    crew: { x: 800, y: 1320, img: "crew.png", label: "/crew", sub: "Crew hiring" },
    support: { x: 1160, y: 1180, img: "support.png", label: "/support", sub: "Support tickets" },
    booking: { x: 1520, y: 1180, img: "booking-expectations.png", label: "/booking-expectations", sub: "Booking policy" },
    providerVerification: { x: 1160, y: 1510, img: "provider-verification.png", label: "/provider-verification", sub: "Provider trust" },
    privacy: { x: 1520, y: 1510, img: "privacy-policy.png", label: "/privacy-policy", sub: "Privacy and terms" },
    policyHub: {
      x: 80,
      y: 1390,
      w: 278,
      h: 230,
      label: "Policy hub",
      sub: "Footer trust links",
      lines: ["cancellation, refund", "standards, terms"],
    },
  },
  edges: [
    { from: "footer", to: "about", label: "About", labelX: 390, labelY: 265 },
    { from: "footer", to: "help", label: "Help", labelX: 560, labelY: 310 },
    { from: "footer", to: "launch", label: "Launch area", labelX: 740, labelY: 350 },
    { from: "launch", to: "customer", label: "Find my provider", labelX: 1490, labelY: 330 },
    { from: "launch", to: "about", label: "Why it works", labelX: 870, labelY: 145 },
    { from: "launch", to: "localMowing", label: "Local service", labelX: 940, labelY: 610 },
    { from: "launch", to: "localCleanup", label: "Local service", labelX: 1080, labelY: 610 },
    { from: "localMowing", to: "customer", label: "Book", labelX: 1040, labelY: 780 },
    { from: "localCleanup", to: "customer", label: "Book", labelX: 1190, labelY: 790 },
    { from: "serviceMowing", to: "customer", label: "Book", labelX: 1490, labelY: 740 },
    { from: "serviceCleanup", to: "customer", label: "Book", labelX: 1710, labelY: 625 },
    { from: "localMowing", to: "localCleanup", label: "Related", labelX: 760, labelY: 800 },
    { from: "serviceMowing", to: "serviceCleanup", label: "Related", labelX: 1480, labelY: 800 },
    { from: "footer", to: "provider", label: "Providers", labelX: 330, labelY: 1180 },
    { from: "footer", to: "crew", label: "Crews", labelX: 520, labelY: 1180 },
    { from: "footer", to: "policyHub", label: "Trust links", labelX: 230, labelY: 1240 },
    { from: "policyHub", to: "support", label: "Support", labelX: 700, labelY: 1320 },
    { from: "policyHub", to: "booking", label: "Booking rules", labelX: 960, labelY: 1370 },
    { from: "policyHub", to: "providerVerification", label: "Verification", labelX: 810, labelY: 1580 },
    { from: "policyHub", to: "privacy", label: "Privacy / terms", labelX: 960, labelY: 1700 },
    { from: "help", to: "policyHub", label: "Policy links", labelX: 610, labelY: 1110 },
  ],
});

const files = (await fs.readdir(outDir)).filter((file) => file.endsWith(".png")).sort();
console.log(`Generated ${files.length} page-flow diagrams: ${files.join(", ")}`);
