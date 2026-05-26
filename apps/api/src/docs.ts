// This lightweight OpenAPI-style document keeps the monolith self-documenting without adding
// external dependencies before package installation is available.
export const apiSpec = {
  openapi: "3.1.0",
  info: {
    title: "YardMatch API",
    version: "0.1.0",
    description:
      "Developer-facing API for customer booking flows, landscaping business operations, crew-member onboarding, payments, support, analytics, and operational telemetry."
  },
  servers: [
    {
      url: "http://localhost:4000"
    }
  ],
  tags: [
    { name: "Auth" },
    { name: "Customers" },
    { name: "Quotes" },
    { name: "Providers" },
    { name: "Bookings" },
    { name: "Payments" },
    { name: "Support" },
    { name: "Observability" }
  ],
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a customer, provider business, or crew member",
        description:
          "Providers represent landscaping businesses with equipment and client operations. Crew members represent individual workers who can join those businesses without running their own company.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                fullName: "Jordan Rivera",
                email: "jordan@example.com",
                phone: "555-0200",
                role: "customer",
                propertyLabel: "Primary home",
                address: {
                  line1: "112 Garden Row",
                  city: "Austin",
                  state: "TX",
                  postalCode: "78704",
                  country: "US",
                  point: {
                    latitude: 30.2435,
                    longitude: -97.7638
                  }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Registered user profile" }
        }
      }
    },
    "/api/customers/properties": {
      get: {
        tags: ["Customers"],
        summary: "List saved properties for a customer",
        parameters: [
          {
            name: "customerId",
            in: "query",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Customer property list" }
        }
      },
      post: {
        tags: ["Customers"],
        summary: "Add a saved property",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                customerId: "customer_123",
                label: "Rental property",
                setAsDefault: false,
                address: {
                  line1: "55 Barton Creek Ln",
                  city: "Austin",
                  state: "TX",
                  postalCode: "78735",
                  country: "US",
                  point: {
                    latitude: 30.2914,
                    longitude: -97.8765
                  }
                }
              }
            }
          }
        },
        responses: {
          "201": { description: "Saved property created" }
        }
      }
    },
    "/api/customers/properties/default": {
      post: {
        tags: ["Customers"],
        summary: "Set the default property for a customer",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                customerId: "customer_123",
                propertyId: "property_456"
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated customer profile" }
        }
      }
    },
    "/api/customers/review-opportunities": {
      get: {
        tags: ["Customers"],
        summary: "List booking-specific review opportunities for a customer",
        description:
          "Returns completed bookings and whether each one is waiting on a delayed invite, ready for review, already reviewed, or expired.",
        parameters: [
          {
            name: "customerId",
            in: "query",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Review opportunity list" }
        }
      }
    },
    "/api/quotes/instant": {
      post: {
        tags: ["Quotes"],
        summary: "Generate an instant quote with confidence scoring",
        description:
          "Returns an automated price and duration estimate. If confidence is not high enough, the response includes a minimal follow-up question set.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                customerId: "customer_123",
                propertyId: "property_456",
                category: "lawn-mowing",
                address: {
                  line1: "112 Garden Row",
                  city: "Austin",
                  state: "TX",
                  postalCode: "78704",
                  country: "US",
                  point: {
                    latitude: 30.2435,
                    longitude: -97.7638
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Instant quote response" }
        }
      }
    },
    "/api/providers/search": {
      post: {
        tags: ["Providers"],
        summary: "Search nearby providers",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                address: {
                  line1: "112 Garden Row",
                  city: "Austin",
                  state: "TX",
                  postalCode: "78704",
                  country: "US",
                  point: {
                    latitude: 30.2435,
                    longitude: -97.7638
                  }
                },
                categories: ["lawn-mowing"],
                dateIso: "2026-05-01",
                estimatedDurationMinutes: 52
              }
            }
          }
        },
        responses: {
          "200": { description: "Provider matches and suggested slots" }
        }
      }
    },
    "/api/providers/settings": {
      post: {
        tags: ["Providers"],
        summary: "Update provider business settings",
        description:
          "Lets a landscaping business owner change the service radius used to match against each customer property address.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                providerId: "provider_123",
                serviceRadiusMiles: 20,
                sponsoredListingEnabled: true
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated provider profile" }
        }
      }
    },
    "/api/providers/reviews": {
      get: {
        tags: ["Providers"],
        summary: "List submitted reviews for a provider",
        parameters: [
          {
            name: "providerId",
            in: "query",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Provider review list" }
        }
      },
      post: {
        tags: ["Providers"],
        summary: "Create a provider review from a completed booking with an active invite",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                customerId: "customer_123",
                overallRating: 5,
                timelinessRating: 4,
                attentionToDetailRating: 5,
                reviewText: "Showed up on time, handled edging carefully, and left the walkways clean."
              }
            }
          }
        },
        responses: {
          "201": { description: "Provider review created" }
        }
      }
    },
    "/api/bookings": {
      get: {
        tags: ["Bookings"],
        summary: "List bookings",
        responses: {
          "200": { description: "Booking list" }
        }
      },
      post: {
        tags: ["Bookings"],
        summary: "Create a booking",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                customerId: "customer_123",
                providerId: "provider_123",
                servicePropertyId: "property_456",
                serviceAddress: {
                  line1: "112 Garden Row",
                  city: "Austin",
                  state: "TX",
                  postalCode: "78704",
                  country: "US",
                  point: {
                    latitude: 30.2435,
                    longitude: -97.7638
                  }
                },
                category: "lawn-mowing",
                scheduledStartIso: "2026-05-01T14:00:00.000Z",
                scheduledEndIso: "2026-05-01T14:52:00.000Z",
                notes: "Please use side gate",
                totalCents: 6800
              }
            }
          }
        },
        responses: {
          "201": { description: "Booking created" }
        }
      }
    },
    "/api/bookings/complete": {
      post: {
        tags: ["Bookings"],
        summary: "Mark a booking complete and schedule the delayed review invite",
        description:
          "Completing a booking creates a review invite scheduled to send 48 hours later by default.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123"
              }
            }
          }
        },
        responses: {
          "200": { description: "Completed booking" }
        }
      }
    },
    "/api/bookings/address": {
      post: {
        tags: ["Bookings"],
        summary: "Request an address change for an existing booking",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                customerId: "customer_123",
                newPropertyId: "property_789",
                newAddress: {
                  line1: "55 Barton Creek Ln",
                  city: "Austin",
                  state: "TX",
                  postalCode: "78735",
                  country: "US",
                  point: {
                    latitude: 30.2914,
                    longitude: -97.8765
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Booking update outcome" }
        }
      }
    },
    "/api/payments/intent": {
      post: {
        tags: ["Payments"],
        summary: "Authorize a payment intent for a booking",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                amountCents: 6800
              }
            }
          }
        },
        responses: {
          "201": { description: "Payment authorized" }
        }
      }
    },
    "/api/payments/refund": {
      post: {
        tags: ["Payments"],
        summary: "Request or execute a refund",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                paymentId: "payment_123",
                reason: "Crew no-show"
              }
            }
          }
        },
        responses: {
          "200": { description: "Payment refunded" }
        }
      }
    },
    "/api/support/tickets": {
      post: {
        tags: ["Support"],
        summary: "Open a support ticket",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                requesterId: "customer_123",
                subject: "Service quality issue",
                description: "The back lawn was not completed.",
                issueType: "service-quality"
              }
            }
          }
        },
        responses: {
          "201": { description: "Support ticket created" }
        }
      }
    },
    "/api/analytics/events": {
      post: {
        tags: ["Observability"],
        summary: "Record a custom analytics event",
        responses: {
          "201": { description: "Event recorded" }
        }
      }
    },
    "/api/observability/session-heartbeat": {
      post: {
        tags: ["Observability"],
        summary: "Track an active user session heartbeat",
        responses: {
          "201": { description: "Heartbeat recorded" }
        }
      }
    },
    "/api/observability/overview": {
      get: {
        tags: ["Observability"],
        summary: "Fetch the live operational telemetry summary",
        responses: {
          "200": { description: "Operations overview" }
        }
      }
    },
    "/api/calendar/feed": {
      get: {
        tags: ["Providers"],
        summary: "Get provider availability as an ICS feed",
        parameters: [
          {
            name: "providerId",
            in: "query",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "ICS calendar feed" }
        }
      }
    },
    "/api/review-invites/process": {
      post: {
        tags: ["Observability"],
        summary: "Process scheduled review invites into outbound email dispatches",
        description:
          "This endpoint is intended for a cron or worker to call. It marks due invites as sent and returns the email payloads that should be handed to your ESP.",
        requestBody: {
          required: false,
          content: {
            "application/json": {
              example: {
                nowIso: "2026-05-03T16:00:00.000Z"
              }
            }
          }
        },
        responses: {
          "200": { description: "Queued review invite dispatches" }
        }
      }
    }
  }
} as const;

type ApiOperationSummary = {
  summary: string;
  description?: string;
};

function renderEndpointSummary(): string {
  const paths = apiSpec.paths as Record<string, Record<string, ApiOperationSummary>>;

  return Object.entries(paths)
    .map(([path, methods]) =>
      Object.entries(methods)
        .map(
          ([method, operation]) => `
            <div class="endpoint">
              <div><span class="method">${method.toUpperCase()}</span><code>${path}</code></div>
              <h3>${operation.summary}</h3>
              <p>${operation.description ?? "See example payloads in the JSON spec."}</p>
            </div>
          `
        )
        .join("")
    )
    .join("");
}

export function renderDocsHtml(): string {
  const specJson = JSON.stringify(apiSpec, null, 2);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>YardMatch API Docs</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f5ef;
        --card: rgba(255,255,255,0.88);
        --ink: #14281d;
        --muted: #66756a;
        --primary: #2f7d4c;
        --border: rgba(20, 40, 29, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(135deg, #f8f1dc 0%, #eef8f0 42%, #e4efe8 100%);
        color: var(--ink);
      }
      .container {
        width: min(calc(100% - 2rem), 1180px);
        margin: 0 auto;
        padding: 2rem 0 4rem;
      }
      .hero, .grid, .endpoint-list { display: grid; gap: 1rem; }
      .hero { grid-template-columns: 1.1fr 0.9fr; align-items: start; }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 22px;
        padding: 1.25rem;
        box-shadow: 0 12px 36px rgba(20, 40, 29, 0.08);
      }
      .eyebrow {
        display: inline-block;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        background: rgba(255,255,255,0.7);
        border: 1px solid var(--border);
        color: var(--primary);
        font-weight: 600;
      }
      h1, h2, h3 { margin: 0 0 0.75rem; }
      p { line-height: 1.6; color: var(--muted); }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 1.25rem; }
      .endpoint-list { margin-top: 1rem; }
      .endpoint {
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 1rem;
        background: rgba(255,255,255,0.74);
      }
      .method {
        display: inline-block;
        min-width: 4.5rem;
        text-align: center;
        font-weight: 700;
        color: white;
        border-radius: 999px;
        padding: 0.35rem 0.75rem;
        margin-right: 0.75rem;
        background: var(--primary);
      }
      .endpoint code, pre {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }
      pre {
        overflow: auto;
        padding: 1rem;
        border-radius: 18px;
        background: #16241d;
        color: #eef8f0;
      }
      .actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-top: 1rem;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 2.75rem;
        padding: 0 1rem;
        border-radius: 999px;
        background: var(--primary);
        color: white;
        text-decoration: none;
        font-weight: 600;
      }
      @media (max-width: 900px) {
        .hero, .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="container">
      <section class="hero">
        <article class="card">
          <span class="eyebrow">Developer docs</span>
          <h1>YardMatch API</h1>
          <p>
            Browse routes, example payloads, and integration notes for customer properties,
            instant quotes, bookings, payments, support, and operational telemetry.
          </p>
          <div class="actions">
            <a class="button" href="/api/docs/openapi.json">Open JSON spec</a>
            <a class="button" href="/api/observability/overview">Live ops endpoint</a>
          </div>
        </article>
        <article class="card">
          <h2>Integration notes</h2>
          <p>Use the shared contracts package in-repo for type-safe integrations where possible.</p>
          <p>Instant quotes are designed for low-friction address-first flows and may return follow-up questions when confidence is not yet high.</p>
          <p>Bookings snapshot the service address so later default-property changes do not mutate history.</p>
        </article>
      </section>

      <section class="grid">
        <article class="card">
          <h2>Endpoint summary</h2>
          <div class="endpoint-list">
            ${renderEndpointSummary()}
          </div>
        </article>
        <article class="card">
          <h2>OpenAPI-style JSON</h2>
          <p>The current monolith serves a built-in machine-readable spec you can pull into other tooling.</p>
          <pre>${escapeHtml(specJson)}</pre>
        </article>
      </section>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
