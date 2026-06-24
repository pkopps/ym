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
    { name: "Crew" },
    { name: "Bookings" },
    { name: "Chat" },
    { name: "Payments" },
    { name: "Support" },
    { name: "Observability" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  },
  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a customer, provider business, or crew member",
        description:
          "Providers represent landscaping businesses with equipment and client operations. Crew members represent individual workers who can join those businesses without running their own company. The response returns both the created user profile and a bearer token.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                fullName: "Jordan Rivera",
                email: "jordan@example.com",
                password: "Password123!",
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
          "201": { description: "Registered user profile and bearer token" }
        }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                email: "jordan@example.com",
                password: "Password123!"
              }
            }
          }
        },
        responses: {
          "200": { description: "Authenticated user profile and bearer token" },
          "401": { description: "Invalid credentials" }
        }
      }
    },
    "/api/auth/password-reset/request": {
      post: {
        tags: ["Auth"],
        summary: "Request a password reset code",
        description:
          "Starts the YardMatch password recovery flow. In local development, the response includes a reset code preview so web and mobile flows can be tested before a real email/SMS provider is wired.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                email: "jordan@example.com"
              }
            }
          }
        },
        responses: {
          "200": { description: "Generic success response with local reset-code preview when available" }
        }
      }
    },
    "/api/auth/password-reset/confirm": {
      post: {
        tags: ["Auth"],
        summary: "Confirm a password reset with the latest reset code",
        description:
          "Resets the password, clears the one-time reset code, increments the session version, and returns a fresh authenticated session.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                email: "jordan@example.com",
                resetCode: "482913",
                newPassword: "BetterPass123!"
              }
            }
          }
        },
        responses: {
          "200": { description: "Password updated and a fresh bearer session returned" },
          "400": { description: "Invalid or expired reset code" }
        }
      }
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Fetch the current authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Authenticated user profile" },
          "401": { description: "Missing or invalid bearer token" }
        }
      }
    },
    "/api/auth/google/start": {
      get: {
        tags: ["Auth"],
        summary: "Start Google auth for signup or login",
        description:
          "Starts the Google OAuth redirect for customer, provider, and crew-member flows. Pass a custom redirectUri when handing the finished session back to a mobile app.",
        parameters: [
          {
            name: "role",
            in: "query",
            required: true,
            schema: { type: "string", enum: ["customer", "provider", "crew-member"] }
          },
          {
            name: "mode",
            in: "query",
            required: true,
            schema: { type: "string", enum: ["signup", "login"] }
          },
          {
            name: "redirectUri",
            in: "query",
            required: false,
            schema: { type: "string" }
          }
        ],
        responses: {
          "302": { description: "Redirects into Google sign-in and then back into YardMatch" }
        }
      }
    },
    "/api/auth/apple/start": {
      get: {
        tags: ["Auth"],
        summary: "Start Apple auth for signup or login",
        description:
          "Starts the Apple OAuth redirect for customer, provider, and crew-member flows. Pass a custom redirectUri when handing the finished session back to a mobile app.",
        parameters: [
          {
            name: "role",
            in: "query",
            required: true,
            schema: { type: "string", enum: ["customer", "provider", "crew-member"] }
          },
          {
            name: "mode",
            in: "query",
            required: true,
            schema: { type: "string", enum: ["signup", "login"] }
          },
          {
            name: "redirectUri",
            in: "query",
            required: false,
            schema: { type: "string" }
          }
        ],
        responses: {
          "302": { description: "Redirects into Apple sign-in and then back into YardMatch" }
        }
      }
    },
    "/api/auth/social/complete": {
      post: {
        tags: ["Auth"],
        summary: "Finish a first-time social signup",
        description:
          "Completes signup after Google or Apple has verified the email but YardMatch still needs the user’s phone and service address.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                pendingToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                role: "customer",
                fullName: "Jordan Rivera",
                phone: "555-0100",
                address: {
                  line1: "145 Prospect Ave",
                  city: "Brooklyn",
                  state: "NY",
                  postalCode: "11215",
                  country: "US",
                  point: {
                    latitude: 40.6681,
                    longitude: -73.9836
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Linked an existing YardMatch account and returned a fresh session" },
          "201": { description: "Created a new YardMatch account and returned a fresh session" },
          "401": { description: "Pending social signup token is invalid or expired" }
        }
      }
    },
    "/api/providers/profile": {
      get: {
        tags: ["Providers"],
        summary: "Fetch a provider profile by id",
        description:
          "Returns the provider business profile plus backend-authored verification summary guidance, including the current checklist and any next steps the provider can handle before or during launch review.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "providerId",
            in: "query",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Provider profile" },
          "400": { description: "Missing providerId" },
          "401": { description: "Missing or invalid bearer token" }
        }
      },
      post: {
        tags: ["Providers"],
        summary: "Update the authenticated provider's business profile",
        description:
          "Lets a provider update verification-relevant business details such as company name, bio, years of experience, and service categories. If a previously rejected provider makes a meaningful change, the business automatically moves back into pending review.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                companyName: "Barnegat Lawn Co.",
                bio: "Weekly mowing, seasonal cleanup, and careful customer communication for busy homeowners.",
                yearsExperience: 4,
                categories: ["lawn-mowing", "seasonal-cleanup"]
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated provider profile" },
          "401": { description: "Missing or invalid bearer token" }
        }
      }
    },
    "/api/providers/public-overview": {
      get: {
        tags: ["Providers"],
        summary: "Fetch live public marketplace overview data",
        description:
          "Returns live aggregate provider counts, featured providers, verified-review snippets, and current coverage-area signals for the public GreenRain surfaces so customer-facing marketing pages do not rely on hardcoded showcase records.",
        responses: {
          "200": { description: "Public marketplace overview" }
        }
      }
    },
    "/api/providers/verification/queue": {
      get: {
        tags: ["Providers"],
        summary: "List providers waiting on verification review",
        description:
          "Returns provider businesses that are still pending review or were sent back for updates before they can appear in public search, along with backend-authored launch-fit guidance and checklist items covering profile completeness, service scope, launch-area fit, service-quality expectations, and intervention readiness so ops can approve or return them consistently. When guidance does not recommend approval, the payload also includes the override-note requirements needed to make an auditable exception.",
        responses: {
          "200": { description: "Provider verification queue" }
        }
      }
    },
    "/api/providers/verification/review": {
      post: {
        tags: ["Providers"],
        summary: "Approve or reject a provider business for public visibility",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                providerId: "provider_123",
                action: "approve",
                notes:
                  "Ops confirmed the provider tightened the launch radius, can meet exception-response expectations, and is safe to release with first-week oversight."
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated provider verification status" }
        }
      }
    },
    "/api/customers/properties": {
      get: {
        tags: ["Customers"],
        summary: "List saved properties for a customer",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Customer property list" }
        }
      },
      post: {
        tags: ["Customers"],
        summary: "Add a saved property",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
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
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
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
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Review opportunity list" }
        }
      }
    },
    "/api/customers/retention-opportunities": {
      get: {
        tags: ["Customers"],
        summary: "List completed-job rebooking and recurring-service nudges for a customer",
        description:
          "Returns backend-authored retention opportunities based on completed jobs, active recurring plans, and whether the same property already has future work queued. The current timing rules cover recent-completion mowing follow-up, 30-day seasonal cleanup nudges, 60-day hedge-trimming reminders, spring mulch-refresh and fertilization windows, fall leaf-return and aeration windows, and a broader 90-day rebook fallback. Mowing prompts now also distinguish between weekly and every-2-weeks cadence from recent booking history and carry repeat-customer/provider-loyal context, and loyalty-backed rebooks can softly prefer a proven prior provider when the same property has strong history, all without abandoning the recommendation-first marketplace flow.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Retention opportunity list" }
        }
      }
    },
    "/api/bookings/cancel": {
      post: {
        tags: ["Bookings"],
        summary: "Cancel a customer booking",
        security: [{ bearerAuth: [] }],
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
          "200": { description: "Updated booking in cancelled status" }
        }
      }
    },
    "/api/bookings/reschedule": {
      post: {
        tags: ["Bookings"],
        summary: "Reschedule a customer booking",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                scheduledStartIso: "2026-06-03T13:00:00.000Z",
                scheduledEndIso: "2026-06-03T15:00:00.000Z"
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated booking with new scheduled times" }
        }
      }
    },
    "/api/bookings/on-route": {
      post: {
        tags: ["Bookings"],
        summary: "Mark a booking as on route",
        description:
          "Used by the business owner by default, with accepted crew fallback for future delegation scenarios. This unlocks customer-to-provider chat and arrival tracking for the booking.",
        security: [{ bearerAuth: [] }],
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
          "200": { description: "Updated booking with on-route confirmation" },
          "403": { description: "Only the provider on the booking, or an accepted crew member fallback, can confirm on-route status" }
        }
      }
    },
    "/api/bookings/route-stop": {
      post: {
        tags: ["Bookings"],
        summary: "Set a provider-only interim route stop",
        description:
          "Lets the booking provider add an interim stop such as equipment pickup or staging before the crew reaches the service property. Provider tracking keeps the extra stop visible internally while customers continue to see only the provider-facing route status.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                kind: "equipment-pickup"
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated booking with the active interim route stop" },
          "403": { description: "Only the booking provider can set route stops" }
        }
      }
    },
    "/api/bookings/route-stop/clear": {
      post: {
        tags: ["Bookings"],
        summary: "Clear a provider-only interim route stop",
        description:
          "Removes the active provider-only interim stop so arrival tracking heads straight to the service property again.",
        security: [{ bearerAuth: [] }],
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
          "200": { description: "Updated booking without an active interim route stop" },
          "403": { description: "Only the booking provider can clear route stops" }
        }
      }
    },
    "/api/bookings/late": {
      post: {
        tags: ["Bookings"],
        summary: "Send a running-late update for a booking",
        description:
          "Lets the provider send a low-friction delay update to the customer before arrival. Customer-facing timing stays window-based even though internal scheduling remains exact.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                lateEtaIso: "2026-06-05T18:15:00.000Z",
                reason: "Finishing the prior property."
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated booking with a fresh delay notice" },
          "403": { description: "Only the booking provider can send delay updates" }
        }
      }
    },
    "/api/bookings/exception": {
      post: {
        tags: ["Bookings"],
        summary: "Report a booking issue",
        description:
          "Lets the provider flag an active booking with a customer-facing issue such as a customer no-show, the customer not being ready, being unable to access the property, or being unable to complete the service.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                exceptionType: "unable-to-access-property",
                notes: "Gate was locked and no one answered."
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated booking with an active service issue" },
          "403": { description: "Only the booking provider can report service issues" }
        }
      }
    },
    "/api/bookings/dispute": {
      post: {
        tags: ["Bookings"],
        summary: "Open a booking dispute",
        description:
          "Lets the authenticated customer or provider move a booking into disputed status and automatically attach support context for YardMatch operations.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                reason: "The completed service missed multiple agreed areas and needs review."
              }
            }
          }
        },
        responses: {
          "200": { description: "Booking marked disputed and support context created" },
          "403": { description: "Only the customer or provider tied to the booking can dispute it" }
        }
      }
    },
    "/api/bookings/route-location": {
      post: {
        tags: ["Bookings"],
        summary: "Share a live route location update",
        description:
          "Accepts provider- or accepted-crew-device location pings for a booking that is already on route. Customer and provider tracking views will prefer these live points over the fallback computed route.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                point: {
                  latitude: 30.2471,
                  longitude: -97.7612
                },
                speedMph: 19,
                accuracyMeters: 18,
                capturedAtIso: "2026-06-07T16:12:00.000Z"
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated live arrival tracking returned" },
          "400": { description: "Route has not started or payload is invalid" },
          "403": { description: "Only the provider or accepted crew member can share route location" }
        }
      }
    },
    "/api/bookings/tracking": {
      get: {
        tags: ["Bookings"],
        summary: "Fetch live arrival tracking for a booking",
        description:
          "Returns device-backed arrival tracking when recent provider or accepted-crew location updates exist, falling back to the computed route model otherwise. In v1 the provider is the route leader by default.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "bookingId",
            in: "query",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Computed arrival tracking returned" },
          "403": { description: "User is not tied to this booking" }
        }
      }
    },
    "/api/bookings/start": {
      post: {
        tags: ["Bookings"],
        summary: "Start work on a confirmed booking",
        description:
          "Used by the business owner by default after the route has started. Accepted crew can be supported later for delegated route-leader scenarios. This moves the booking into in-progress status and requires at least one before-work photo.",
        security: [{ bearerAuth: [] }],
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
          "200": { description: "Updated booking in in-progress status" },
          "403": { description: "Only the provider on the booking, or an accepted crew member fallback, can start work" }
        }
      }
    },
    "/api/bookings/evidence": {
      post: {
        tags: ["Bookings"],
        summary: "Attach booking evidence to a job",
        description:
          "Stores booking-linked service evidence with phase, timestamp, and actor attribution. Providers and accepted crew members can attach before-work or after-work photos, onsite notes, and structured checklists while the booking is active.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                phase: "before",
                imageDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...",
                note: "Front yard before trimming"
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated booking with attached service evidence" },
          "403": { description: "Only the provider or accepted crew member can attach evidence" }
        }
      }
    },
    "/api/quotes/instant": {
      post: {
        tags: ["Quotes"],
        summary: "Generate an instant quote with confidence scoring",
        description:
          "Returns an automated price and duration estimate, plus normalized-address metadata, measurement source details, and confidence reasons that explain whether the estimate is grounded in saved property data, customer answers, or heuristics. Lower-confidence jobs also surface complexity-aware follow-up questions so larger or more intricate properties can be clarified before checkout.",
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
    "/api/places/search": {
      get: {
        tags: ["Search"],
        summary: "Search for cities, towns, and service areas",
        description:
          "Returns customer-facing place suggestions for booking/search flows. The fallback dataset now supports stronger city/state normalization, ZIP matching, and practical service-area aliases when live geocoding is unavailable.",
        parameters: [
          {
            name: "query",
            in: "query",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": {
            description: "Matching place suggestions returned"
          }
        }
      }
    },
    "/api/places/reverse-geocode": {
      post: {
        tags: ["Search"],
        summary: "Resolve browser coordinates to a booking area",
        description:
          "Uses Google Maps reverse geocoding when GOOGLE_MAPS_API_KEY is configured, with a conservative local service-area fallback when live geocoding is unavailable.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                latitude: 35.9251,
                longitude: -86.8689
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Location-derived place suggestion returned"
          }
        }
      }
    },
    "/api/providers/search": {
      post: {
        tags: ["Providers"],
        summary: "Search nearby providers",
        description:
          "Returns public marketplace results for providers that are verified, serve the requested address, and match the requested services. Results are ranked using service fit, specialization, distance, reliability history, availability, and sponsored placement, with an explanation payload for each ranked provider. The response also includes a recommendation session id so customer flows can track recommendation acceptance, alternative reveals, and swaps cleanly, plus customer-facing transparency fields like nearby completed-job context and availability confidence.",
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
                estimatedDurationMinutes: 52,
                requestSource: "customer-web-dashboard"
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
          "Lets a landscaping business owner change the service radius used to match against each customer property address, choose whether matched crew members are auto-accepted or reviewed first, tune staffing/departure reminder timing, control whether accepted crew can act as route leaders, and manage outside-calendar blocking that protects YardMatch availability from direct clients or personal time. Changes to payout timing or instant-payout controls require a freshly authenticated session.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                serviceRadiusMiles: 20,
                staffingMode: "review-first",
                crewReviewLeadHours: 6,
                departureReminderLeadMinutes: 45,
                routeLeaderMode: "provider-only",
                sponsoredListingEnabled: true,
                externalEventsBlockingEnabled: true,
                externalCalendarBlocks: [
                  {
                    title: "Direct client visit",
                    blockType: "off-platform-client",
                    startIso: "2026-06-12T13:00:00.000Z",
                    endIso: "2026-06-12T15:00:00.000Z",
                    notes: "Outside YardMatch client"
                  }
                ]
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated provider profile" },
          "401": { description: "Fresh re-authentication required for payout-setting changes" }
        }
      }
    },
    "/api/providers/assistant": {
      post: {
        tags: ["Providers"],
        summary: "Run a provider scheduling assistant command",
        description:
          "Parses a natural-language provider scheduling command, previews the matched booking and outcome, and can execute provider-side actions like reviewing named crew matches, accepting the best recommended crew, setting a provider-only interim route stop, rescheduling a job, messaging crew on a booking thread, or sending a late arrival update to the customer when confirmed. Dispatch-summary commands can also surface the specific appointments creating pressure on a day or service window. Commands can chain multiple same-booking actions together when each step is understood.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                command: "What needs attention tomorrow?",
                execute: false
              }
            }
          }
        },
        responses: {
          "200": { description: "Parsed provider assistant result, or executed booking update when requested" }
        }
      }
    },
    "/api/providers/staffing": {
      get: {
        tags: ["Providers"],
        summary: "Get provider staffing overview",
        description:
          "Returns upcoming jobs, crew gaps, matched crew candidates, accepted assignments, and delegated route-leader state for the authenticated provider business.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Provider staffing overview" }
        }
      }
    },
    "/api/providers/staffing/review": {
      post: {
        tags: ["Providers"],
        summary: "Accept or deny a matched crew candidate",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                crewMatchId: "crew_match_123",
                action: "accept"
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated crew match candidate" }
        }
      }
    },
    "/api/providers/staffing/route-leader": {
      post: {
        tags: ["Providers"],
        summary: "Assign or clear a delegated route leader for a booking",
        description:
          "Lets a provider choose which accepted crew member can start and share the route for a specific booking when accepted-crew fallback is enabled.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                crewMemberId: "crew_456"
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated booking with delegated route-leader assignment" }
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
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
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
    "/api/providers/reviews/response": {
      post: {
        tags: ["Providers"],
        summary: "Record public review-response handling for ops",
        description:
          "Stores whether a submitted review still needs a public reply, was replied to publicly, or was intentionally skipped, along with the reply body or ops note used to justify that state.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                reviewId: "review_123",
                responseStatus: "posted",
                responseHandledBy: "Casey Ops",
                responseNotes: "Posted after checking the related support case.",
                publicReplyBody:
                  "Thank you for the feedback. We are sorry this visit missed the mark and are reviewing the details internally so the follow-up stays specific."
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated provider review response state" }
        }
      }
    },
    "/api/notifications": {
      get: {
        tags: ["Observability"],
        summary: "List in-app notifications for the authenticated user",
        description:
          "Returns the newest in-app updates generated from booking, staffing, review, and account events, along with the unread count.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Notification list with unread count" }
        }
      }
    },
    "/api/notifications/read": {
      post: {
        tags: ["Observability"],
        summary: "Mark notifications as read",
        description:
          "Marks specific notifications as read, or all unread notifications when no ids are provided, then returns the updated list and unread count.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              example: {
                notificationIds: ["notification_123", "notification_456"]
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated notification list with unread count" }
        }
      }
    },
    "/api/notifications/preferences": {
      get: {
        tags: ["Observability"],
        summary: "Get notification delivery preferences",
        description:
          "Returns the authenticated user's persisted delivery preferences for push, email, SMS, and review reminders.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Notification preferences" }
        }
      },
      post: {
        tags: ["Observability"],
        summary: "Update notification delivery preferences",
        description:
          "Updates the authenticated user's delivery preferences. In-app notifications remain available even if external channels are turned off.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                pushEnabled: true,
                emailEnabled: true,
                smsEnabled: false,
                reviewRemindersEnabled: true
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated notification preferences" }
        }
      }
    },
    "/api/notifications/deliveries": {
      get: {
        tags: ["Observability"],
        summary: "List recent external notification deliveries",
        description:
          "Returns recent push, email, and SMS delivery records for the authenticated user, including retry metadata for real Expo, Resend, and Twilio sends that can be attempted again.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Recent delivery activity" }
        }
      }
    },
    "/api/notifications/devices": {
      post: {
        tags: ["Observability"],
        summary: "Register a push-capable mobile device",
        description:
          "Registers an Expo push token for the authenticated user so booking, route, issue, and review events can fan out to the device.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                platform: "ios",
                provider: "expo",
                token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
              }
            }
          }
        },
        responses: {
          "200": { description: "Registered push device" }
        }
      }
    },
    "/api/notifications/devices/remove": {
      post: {
        tags: ["Observability"],
        summary: "Deactivate a previously registered push device",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
              }
            }
          }
        },
        responses: {
          "200": { description: "Push device removed" }
        }
      }
    },
    "/api/notifications/ops/health": {
      get: {
        tags: ["Observability"],
        summary: "Get notification delivery health for ops",
        description:
          "Returns aggregate delivery counts, overdue retries, exhausted failures, recent failed notifications, and channel/provider breakdowns so the internal ops dashboard can spot delivery issues quickly.",
        responses: {
          "200": { description: "Notification delivery health overview" }
        }
      }
    },
    "/api/notifications/ops/retry-due": {
      post: {
        tags: ["Observability"],
        summary: "Trigger an ops retry sweep for overdue notification deliveries",
        description:
          "Retries all notification deliveries whose scheduled retry time has already passed, then returns the sweep outcome so ops can confirm whether failures recovered or still need attention.",
        responses: {
          "200": { description: "Retry sweep result" }
        }
      }
    },
    "/api/notifications/ops/escalate": {
      post: {
        tags: ["Observability"],
        summary: "Escalate delivery-health problems to external ops contacts",
        description:
          "Builds an external alert digest from current warning and critical notification-health issues, then sends it to configured ops email and SMS contacts through the existing delivery providers.",
        responses: {
          "200": { description: "External notification ops escalation result" }
        }
      }
    },
    "/api/support/ops/bookings/intervene": {
      post: {
        tags: ["Support"],
        summary: "Perform a direct ops intervention on a booking",
        description:
          "Lets customer service add an internal intervention note, reschedule a booking, or directly restore, cancel, or complete the booking while appending an audit trail to the booking record. Outcome-changing interventions on disputed or evidence-backed cases must link the related support ticket, follow the same reviewed-evidence direction guard used by support-ticket resolution, and use a specific intervention rationale when the reviewed evidence is mixed or inconclusive.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                ticketId: "support_ticket_123",
                action: "reschedule-booking",
                note: "Customer approved moving the job to tomorrow afternoon after a storm delay.",
                scheduledStartIso: "2026-06-15T18:00:00.000Z",
                scheduledEndIso: "2026-06-15T20:00:00.000Z"
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated booking with intervention audit trail" }
        }
      }
    },
    "/api/support/ops/bookings/evidence/review": {
      post: {
        tags: ["Support"],
        summary: "Review and annotate booking evidence",
        description:
          "Lets operations mark booking evidence as supporting the provider, supporting the customer, or inconclusive, with notes saved directly on the booking evidence record for disputes and refund reviews.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                ticketId: "support_ticket_123",
                evidenceId: "evidence_123",
                reviewStatus: "supports-provider",
                reviewNotes: "Before-work photo clearly shows the original state of the lawn."
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated booking with reviewed evidence metadata" }
        }
      }
    },
    "/api/bookings": {
      get: {
        tags: ["Bookings"],
        summary: "List bookings",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Booking list" }
        }
      },
      post: {
        tags: ["Bookings"],
        summary: "Create a booking",
        description:
          "Creates a customer booking request. Customer-facing recommendation-first flows can include recommendation session metadata here so ops telemetry can distinguish accepted first-choice recommendations from swapped bookings.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
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
                totalCents: 6800,
                recommendationSessionId: "recommendation_session_123",
                recommendedProviderId: "provider_123",
                selectedProviderRank: 1,
                viewedAlternativeProviders: false,
                recommendationSource: "customer-web-dashboard"
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
          "Completing a booking creates a review invite scheduled to send 48 hours later by default and requires at least one after-work photo.",
        security: [{ bearerAuth: [] }],
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
    "/api/bookings/confirm": {
      post: {
        tags: ["Bookings"],
        summary: "Confirm a requested booking",
        description:
          "Used by the provider business owner to confirm a newly requested booking before the crew heads out.",
        security: [{ bearerAuth: [] }],
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
          "200": { description: "Confirmed booking" },
          "403": { description: "Only the booking provider can confirm the booking" }
        }
      }
    },
    "/api/bookings/decline": {
      post: {
        tags: ["Bookings"],
        summary: "Decline a requested booking",
        description:
          "Used by the provider business owner to decline a newly requested booking they cannot take, notify the customer, and preserve a separate provider-decline telemetry event from customer-side cancellations.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                reason: "Route already full for that day."
              }
            }
          }
        },
        responses: {
          "200": { description: "Declined booking" },
          "403": { description: "Only the booking provider can decline the booking" }
        }
      }
    },
    "/api/bookings/address": {
      post: {
        tags: ["Bookings"],
        summary: "Request an address change for an existing booking",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
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
    "/api/crew/preferences": {
      post: {
        tags: ["Crew"],
        summary: "Update crew availability, travel radius, and skills",
        description:
          "Keeps the crew-member profile current so the matching engine can automatically surface the worker when provider demand exceeds staffed supply.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                categories: ["lawn-mowing", "weed-control", "hedge-trimming"],
                availableWeekdays: ["Mon", "Tue", "Wed", "Thu", "Fri"],
                willingToTravelMiles: 20,
                preferredSchedule: "flex",
                hasOwnEquipment: false,
                winterWorkEnabled: true
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated crew member profile" }
        }
      }
    },
    "/api/crew/matches": {
      get: {
        tags: ["Crew"],
        summary: "List auto-matched and accepted crew opportunities",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Crew match list for the authenticated crew member" }
        }
      }
    },
    "/api/crew/matches/cancel": {
      post: {
        tags: ["Crew"],
        summary: "Cancel an accepted crew assignment",
        description:
          "Lets a crew member back out of an accepted assignment before the route or work has started. The cancellation is recorded against the crew profile so repeated call-offs can reduce future staffing priority.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["crewMatchId"],
                properties: {
                  crewMatchId: { type: "string" },
                  reason: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated crew match summary in cancelled-by-crew status" }
        }
      }
    },
    "/api/chat/provider-crew/threads": {
      get: {
        tags: ["Chat"],
        summary: "List provider-to-crew conversations for the authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Conversation summaries" }
        }
      }
    },
    "/api/chat/provider-crew/messages": {
      get: {
        tags: ["Chat"],
        summary: "Fetch a provider-to-crew conversation thread",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "threadId",
            in: "query",
            required: false,
            schema: { type: "string" }
          },
          {
            name: "crewMatchId",
            in: "query",
            required: false,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Conversation thread and messages" }
        }
      },
      post: {
        tags: ["Chat"],
        summary: "Send a provider-to-crew message",
        description:
          "Creates or appends to a one-to-one conversation linked to an accepted or pending crew match. Only the provider or crew member on that match can send messages.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                crewMatchId: "crew_match_123",
                body: "Can you meet at the property 15 minutes early?"
              }
            }
          }
        },
        responses: {
          "201": { description: "Updated conversation thread" }
        }
      }
    },
    "/api/chat/customer-provider/threads": {
      get: {
        tags: ["Chat"],
        summary: "List customer-provider conversations",
        description:
          "Only the customer or provider tied to a booking can see these threads. They appear only after an accepted crew member confirms they are on route.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Customer-provider conversation summaries" }
        }
      }
    },
    "/api/chat/customer-provider/messages": {
      get: {
        tags: ["Chat"],
        summary: "Fetch a customer-provider conversation thread",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "threadId",
            in: "query",
            required: false,
            schema: { type: "string" }
          },
          {
            name: "bookingId",
            in: "query",
            required: false,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Customer-provider conversation thread and messages" }
        }
      },
      post: {
        tags: ["Chat"],
        summary: "Send a customer-provider message",
        description:
          "Customer-to-provider chat is intentionally limited and only unlocks once an accepted crew member has confirmed they are on the way to the property.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                body: "The side gate will be unlocked."
              }
            }
          }
        },
        responses: {
          "201": { description: "Updated customer-provider conversation thread" },
          "403": { description: "Chat is not unlocked or the user is not tied to the booking" }
        }
      }
    },
    "/api/payments": {
      get: {
        tags: ["Payments"],
        summary: "List payments for the authenticated user",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Payments returned" }
        }
      }
    },
    "/api/payouts/provider": {
      get: {
        tags: ["Payments"],
        summary: "Get the provider payout ledger",
        description:
          "Returns a provider-facing ledger built from completed bookings, captured customer payments, accepted crew matches, and refund state so business owners can see gross earnings, crew share, and current payout readiness.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Provider payout ledger returned" }
        }
      }
    },
    "/api/payouts/crew": {
      get: {
        tags: ["Payments"],
        summary: "Get the crew payout ledger",
        description:
          "Returns a crew-facing ledger built from accepted matches on completed jobs, including whether the payout is still waiting on customer payment, scheduled, ready, paid, or reversed by a refund.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Crew payout ledger returned" }
        }
      }
    },
    "/api/payouts/ops/preview": {
      get: {
        tags: ["Payments"],
        summary: "Preview upcoming provider and crew payout runs",
        description:
          "Returns an internal operations view of payout-ready provider balances, crew-share balances, upcoming grouped provider payout runs, and payout entries that are still on hold or waiting on customer payment.",
        responses: {
          "200": { description: "Ops payout preview returned" }
        }
      }
    },
    "/api/payments/webhook": {
      post: {
        tags: ["Payments"],
        summary: "Receive Stripe webhook events",
        description:
          "Server-to-server Stripe webhook endpoint. Requires Stripe signature verification and is intended for production payment settlement updates.",
        parameters: [
          {
            name: "Stripe-Signature",
            in: "header",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          "200": { description: "Webhook event accepted" },
          "400": { description: "Missing or invalid Stripe signature" },
          "503": { description: "Stripe webhook secret is not configured yet" }
        }
      }
    },
    "/api/payments/checkout-session": {
      post: {
        tags: ["Payments"],
        summary: "Create a Stripe Checkout session for a booking",
        description:
          "Creates a hosted Stripe Checkout session for a customer-owned booking and returns the checkout URL. Disputed bookings must be resolved by support before payment can continue.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
                successPath: "/customer/dashboard?payment=stripe-success",
                cancelPath: "/customer/dashboard?payment=stripe-cancelled"
              }
            }
          }
        },
        responses: {
          "201": { description: "Stripe checkout session created" },
          "409": { description: "Booking is already paid or blocked from payment while under dispute" }
        }
      }
    },
    "/api/payments/checkout-session/finalize": {
      post: {
        tags: ["Payments"],
        summary: "Finalize a Stripe Checkout session after redirect",
        description:
          "Verifies the Stripe Checkout session and marks the local YardMatch payment record as captured when Stripe reports a successful payment.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                checkoutSessionId: "cs_test_123"
              }
            }
          }
        },
        responses: {
          "200": { description: "Payment captured successfully" },
          "409": { description: "Checkout exists but has not completed successfully yet" }
        }
      }
    },
    "/api/payments/intent": {
      post: {
        tags: ["Payments"],
        summary: "Create an internal payment record",
        description:
          "Legacy/internal payment record creation path. Stripe Checkout should be used for real customer card payments. Disputed bookings must be resolved by support before payment can continue.",
        security: [{ bearerAuth: [] }],
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
          "201": { description: "Payment authorized" },
          "409": { description: "Booking is blocked from payment while under dispute" }
        }
      }
    },
    "/api/payments/refund": {
      post: {
        tags: ["Payments"],
        summary: "Request a refund review",
        description:
          "Creates a billing review for a captured customer payment, opens a support ticket, and puts provider/crew payouts on hold until ops approves or denies the refund. If ops later approves a Stripe-backed refund and Stripe is configured, YardMatch also syncs the live Stripe refund before marking the booking refunded locally.",
        security: [{ bearerAuth: [] }],
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
          "200": { description: "Refund review requested on the payment record" }
        }
      }
    },
    "/api/support/tickets": {
      get: {
        tags: ["Support"],
        summary: "List the authenticated user's support tickets",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Support tickets returned" }
        }
      },
      post: {
        tags: ["Support"],
        summary: "Open a support ticket",
        description:
          "Creates a support ticket for an authenticated user. Booking-linked tickets stay in the normal support flow, while no-booking customer tickets for general or account help also auto-create a linked launch follow-up lead so customer-service questions still land in the owned launch queue without manual re-entry by ops.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                bookingId: "booking_123",
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
    "/api/launch/leads": {
      post: {
        tags: ["Launch"],
        summary: "Capture a public launch follow-up request",
        description:
          "Stores a website follow-up request with privacy-safe attribution metadata, a first-response SLA timestamp, and the details operations need to assign an owner and close the inquiry cleanly instead of letting demand disappear into a generic inbox. The returned lead id can later be linked to self-serve bookings and reviews so ops can see actual conversion activity, and matching email or phone identity can also auto-link manually entered leads later on.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                requestSource: "launch-town-page-lead-form",
                contactName: "Jamie Homeowner",
                email: "jamie@example.com",
                preferredContactMethod: "text",
                areaLabel: "Barnegat, NJ",
                serviceCategory: "lawn-mowing",
                message: "Need help confirming weekly mowing coverage next week."
              }
            }
          }
        },
        responses: {
          "201": { description: "Launch lead captured" }
        }
      }
    },
    "/api/launch/inbound": {
      post: {
        tags: ["Launch"],
        summary: "Capture a non-website inbound launch lead",
        description:
          "Server-to-server intake for automated sources like direct email forwarding, Google Business Profile message relays, or referral processors. Requires the shared `x-yardmatch-inbound-secret` header and a source reference id so retries can return the same lead instead of creating duplicates. Channel-mediated sources can also use `preferredContactMethod: platform-message` when the follow-up should happen in the original thread instead of through direct email or phone. When area, service, or callback details are missing, the intake path now tries to infer likely launch-safe values from the relayed message and preserves confirmation notes for ops.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                sourceChannel: "email",
                requestSource: "direct-email-forward",
                sourceReferenceId: "msg_123",
                email: "jamie@example.com",
                subject: "Coverage question",
                message: "Do you serve Barnegat yet?"
              }
            }
          }
        },
        responses: {
          "201": { description: "Inbound launch lead captured or deduplicated" },
          "401": { description: "Missing or invalid inbound lead secret" },
          "503": { description: "Inbound lead webhook secret is not configured yet" }
        }
      }
    },
    "/api/launch/inbound/email": {
      post: {
        tags: ["Launch"],
        summary: "Capture a direct email inbound launch lead",
        description:
          "Specialized server-to-server intake for direct email forwarders. Accepts sender and message fields instead of the full lead schema, then maps them into the launch lead queue using the shared `x-yardmatch-inbound-secret` header and `sourceReferenceId` retry deduplication. The current intake path can also infer likely service, launch area, callback number, and text-vs-call preference from the relayed message while preserving those inference notes for ops confirmation.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                sourceReferenceId: "email_msg_456",
                senderEmail: "sam.homeowner@example.com",
                senderName: "Sam Homeowner",
                subject: "Need mowing help in Barnegat",
                textBody: "Can GreenRain handle weekly mowing starting next Tuesday?",
                areaLabel: "Barnegat, NJ"
              }
            }
          }
        },
        responses: {
          "201": { description: "Inbound email launch lead captured or deduplicated" },
          "401": { description: "Missing or invalid inbound lead secret" },
          "503": { description: "Inbound lead webhook secret is not configured yet" }
        }
      }
    },
    "/api/launch/inbound/google-business-profile": {
      post: {
        tags: ["Launch"],
        summary: "Capture a Google Business Profile inbound launch lead",
        description:
          "Specialized server-to-server intake for Google Business Profile message relays. Accepts the GBP thread metadata plus customer message text, maps the lead into the launch queue, and defaults follow-up to `platform-message` so ops can work the original GBP thread even when no direct email or phone number is available yet.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                sourceReferenceId: "gbp_thread_789",
                customerName: "Pat Homeowner",
                messageText: "Do you service Barnegat for weekly mowing?",
                threadUrl: "https://business.google.com/messages/thread/gbp_thread_789",
                profileLocationName: "GreenRain Barnegat",
                areaLabel: "Barnegat, NJ",
                serviceCategory: "lawn-mowing"
              }
            }
          }
        },
        responses: {
          "201": { description: "Inbound Google Business Profile lead captured or deduplicated" },
          "401": { description: "Missing or invalid inbound lead secret" },
          "503": { description: "Inbound lead webhook secret is not configured yet" }
        }
      }
    },
    "/api/launch/inbound/referral": {
      post: {
        tags: ["Launch"],
        summary: "Capture a referral inbound launch lead",
        description:
          "Specialized server-to-server intake for referral processors, referral forms, or other handoff tools. It can follow up through the referred customer when direct contact details are provided, or fall back to the referrer when they are not, while keeping the lead source explicit and retry-safe through `sourceReferenceId` deduplication.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                sourceReferenceId: "ref_123",
                referrerName: "Alex Neighbor",
                referrerEmail: "alex@example.com",
                referredCustomerName: "Jamie Homeowner",
                areaLabel: "Barnegat, NJ",
                serviceCategory: "lawn-mowing",
                messageText: "Neighbor wants help getting weekly mowing started."
              }
            }
          }
        },
        responses: {
          "201": { description: "Inbound referral lead captured or deduplicated" },
          "401": { description: "Missing or invalid inbound lead secret" },
          "503": { description: "Inbound lead webhook secret is not configured yet" }
        }
      }
    },
    "/api/launch/ops/leads": {
      get: {
        tags: ["Launch"],
        summary: "List the internal launch lead queue",
        description:
          "Returns follow-up requests with owner assignment, response deadlines, follow-up deadlines, attribution context, linked booking or review activity, structured channel metadata for sources like GBP threads or referral fallback contacts, suggested booking matches, and backend-authored response guidance with copy-ready follow-up drafts so ops can work inbound demand by channel instead of relying on manual inbox triage. Conversions can come from explicit website lead ids, later customer identity matching on email or phone, or an ops-side manual attachment when the booking predates the lead.",
        responses: {
          "200": { description: "Launch lead queue" }
        }
      }
    },
    "/api/launch/ops/leads/update": {
      post: {
        tags: ["Launch"],
        summary: "Update a launch lead's owner, follow-up state, or final outcome",
        description:
          "Lets ops assign an owner, record the first response, schedule the next follow-up, close the loop with a documented converted or closed-lost outcome, and manually attach a booking when the lead was captured after the customer already booked. Website-linked bookings and reviews can also advance that lead automatically when the customer self-serves.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                leadId: "lead_123",
                status: "contacted",
                assignedOwner: "Casey Ops",
                linkBookingId: "booking_123",
                nextFollowUpDueAt: "2026-06-18T14:00:00.000Z",
                outcomeSummary: "Coverage confirmed and waiting on the homeowner's preferred start date."
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated launch lead" }
        }
      }
    },
    "/api/support/ops/tickets": {
      get: {
        tags: ["Support"],
        summary: "List the internal support operations queue",
        description:
          "Returns support tickets with linked booking, payment, participant context, evidence summaries, timeline history, backend-authored resolution policy data, and copy-ready customer update drafts so operations can triage disputes, refund reviews, no-shows, and service issues without re-deriving the sensitive guardrails or rewriting the next customer message in the client.",
        responses: {
          "200": { description: "Support operations queue" }
        }
      }
    },
    "/api/support/ops/summary": {
      get: {
        tags: ["Support"],
        summary: "Get refund and field-exception summary data for operations",
        description:
          "Returns aggregate metrics and detailed rows for open refund reviews, payout holds, disputed jobs, and active booking exceptions so operations can spot where service and billing risk is concentrating.",
        responses: {
          "200": { description: "Support operations financial and exception summary" }
        }
      }
    },
    "/api/support/ops/refund-override": {
      post: {
        tags: ["Support"],
        summary: "Open a refund review from customer service",
        description:
          "Lets internal ops open a refund review on a captured payment from an existing billing ticket, even if the customer or provider did not start the refund-review flow themselves.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                ticketId: "ticket_123",
                paymentId: "payment_123",
                reason: "Customer service opened a refund review after checking a billing complaint."
              }
            }
          }
        },
        responses: {
          "200": { description: "Payment moved into refund review by customer service" }
        }
      }
    },
    "/api/support/ops/tickets/update": {
      post: {
        tags: ["Support"],
        summary: "Triages or resolves a support ticket",
        description:
          "Lets internal ops move a ticket into triaged or resolved state and optionally restore, cancel, or complete the linked booking, or approve and deny a refund review tied to the linked payment. Refund approvals now sync the live Stripe refund first when the captured payment came from Stripe and Stripe is configured. When submitted booking evidence exists for disputed, service-quality, or refund-review cases, ops must review at least one evidence item before resolving the ticket, the chosen resolution direction must match the reviewed evidence signal, and mixed evidence requires a specific written rationale before the case can close.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                ticketId: "ticket_123",
                status: "resolved",
                resolutionAction: "approve-refund",
                resolutionNotes: "Support approved the refund review after checking the booking."
              }
            }
          }
        },
        responses: {
          "200": { description: "Updated support ticket" }
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
        description:
          "Returns the API-owned operations overview used by the internal dashboard, including booking funnel activity, payment milestones, launch-lead backlog metrics, review-invite requested-versus-received counts, a backend-authored public review-response queue with persisted response state, and recent telemetry events.",
        responses: {
          "200": { description: "Operations overview" }
        }
      }
    },
    "/api/calendar/feed": {
      get: {
        tags: ["Providers"],
        summary: "Get provider schedule as an ICS feed",
        parameters: [
          {
            in: "query",
            name: "token",
            required: false,
            schema: { type: "string" },
            description:
              "Optional public feed token for external iCal subscriptions. When present, no bearer token is required."
          }
        ],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "ICS calendar feed" }
        }
      }
    },
    "/api/calendar/subscription": {
      get: {
        tags: ["Providers"],
        summary: "Get provider calendar subscription details",
        description:
          "Returns a subscribable ICS feed plus platform-specific Apple Calendar, Google Calendar, and generic iCal actions so providers can add YardMatch jobs and manual outside-calendar blocks with less setup friction.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Provider calendar subscription details" }
        }
      }
    },
    "/api/calendar/overview": {
      get: {
        tags: ["Providers"],
        summary: "Get a merged provider calendar timeline",
        description:
          "Returns a combined schedule view for the authenticated provider, merging YardMatch jobs with blocking outside-calendar entries so mixed books of business can be managed in one timeline. The response also includes dispatch-planning summaries for day load, crew gaps, route miles, morning/afternoon/evening pressure, and a sync-health summary that flags stale or broken outside calendar feeds.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "from",
            in: "query",
            required: false,
            schema: { type: "string", format: "date-time" }
          },
          {
            name: "to",
            in: "query",
            required: false,
            schema: { type: "string", format: "date-time" }
          }
        ],
        responses: {
          "200": { description: "Merged provider calendar overview" },
          "400": { description: "Invalid date range" }
        }
      }
    },
    "/api/calendar/imports": {
      get: {
        tags: ["Providers"],
        summary: "List imported outside calendars",
        description:
          "Returns the provider's external iCal subscriptions, imported-block counts, and mixed-schedule sync health so stale or errored feeds are visible before they create double-booking risk.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "External calendar imports" }
        }
      },
      post: {
        tags: ["Providers"],
        summary: "Add an outside calendar import",
        description:
          "Lets a provider paste a Google, Apple, or generic iCal feed URL so outside events can be pulled into YardMatch and block availability automatically. If the first sync fails, the feed is still saved and marked with a sync error so the provider can retry instead of losing the setup.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                title: "Google Calendar - Direct clients",
                provider: "google",
                feedUrl: "https://calendar.google.com/calendar/ical/example/public/basic.ics"
              }
            }
          }
        },
        responses: {
          "201": { description: "External calendar import created and synced" }
        }
      }
    },
    "/api/calendar/imports/sync": {
      post: {
        tags: ["Providers"],
        summary: "Sync an outside calendar import",
        description:
          "Fetches the latest iCal events for a saved external calendar subscription and updates the imported blocking events in YardMatch. Sync errors are persisted onto the subscription health instead of disappearing as a one-off request failure.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                subscriptionId: "external-calendar-subscription-id"
              }
            }
          }
        },
        responses: {
          "200": { description: "External calendar import synced" }
        }
      }
    },
    "/api/calendar/imports/sync-stale": {
      post: {
        tags: ["Providers"],
        summary: "Bulk-refresh stale or errored outside calendar imports",
        description:
          "Refreshes every external calendar subscription that is stale or currently failing, then returns the updated import health and attempt counts so providers can recover mixed-schedule sync faster.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Stale or errored external calendar imports refreshed" }
        }
      }
    },
    "/api/calendar/imports/remove": {
      post: {
        tags: ["Providers"],
        summary: "Remove an outside calendar import",
        description:
          "Deletes a saved external calendar subscription and removes the imported blocking events tied to that feed.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                subscriptionId: "external-calendar-subscription-id"
              }
            }
          }
        },
        responses: {
          "200": { description: "External calendar import removed" }
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

export function renderDocsHtml(): string {
  const pathGroups = apiSpec.paths as Record<
    string,
    Record<string, { summary: string; description?: string }>
  >;
  const endpointCount = Object.values(pathGroups).reduce(
    (count, operations) => count + Object.keys(operations).length,
    0
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>YardMatch API Docs</title>
    <meta
      name="description"
      content="Interactive YardMatch API reference for auth, bookings, staffing, customer chat, support, and observability."
    />
    <style>
      :root {
        color-scheme: light only;
        --bg: #f5f0e4;
        --card: rgba(255,255,255,0.92);
        --ink: #14281d;
        --muted: #58675d;
        --primary: #2f7d4c;
        --accent: #e7f4ea;
        --border: rgba(20, 40, 29, 0.1);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(255, 219, 133, 0.25), transparent 28rem),
          linear-gradient(135deg, #f8f1dc 0%, #eef8f0 45%, #e9f2ec 100%);
        color: var(--ink);
      }
      .shell {
        width: min(calc(100% - 2rem), 1320px);
        margin: 0 auto;
        padding: 1.5rem 0 2rem;
      }
      .hero {
        display: grid;
        gap: 1rem;
        grid-template-columns: 1.05fr 0.95fr;
        align-items: stretch;
        margin-bottom: 1rem;
      }
      .panel {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 1.25rem 1.35rem;
        box-shadow: 0 18px 42px rgba(20, 40, 29, 0.08);
        backdrop-filter: blur(14px);
      }
      .eyebrow {
        display: inline-block;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        background: var(--accent);
        border: 1px solid var(--border);
        color: var(--primary);
        font-weight: 600;
        letter-spacing: 0.01em;
      }
      h1, h2, h3, p { margin: 0; }
      h1 {
        font-size: clamp(2rem, 4vw, 3.35rem);
        line-height: 0.95;
        margin-top: 0.9rem;
      }
      p {
        line-height: 1.6;
        color: var(--muted);
      }
      .hero-copy {
        display: grid;
        gap: 1rem;
      }
      .hero-copy p {
        max-width: 56ch;
        font-size: 1.03rem;
      }
      .stats {
        display: grid;
        gap: 0.85rem;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .stat {
        border-radius: 18px;
        border: 1px solid var(--border);
        padding: 0.9rem;
        background: rgba(255,255,255,0.7);
      }
      .stat strong {
        display: block;
        font-size: 1.4rem;
        margin-bottom: 0.25rem;
      }
      .actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 2.9rem;
        padding: 0 1.1rem;
        border-radius: 999px;
        background: var(--primary);
        color: white;
        text-decoration: none;
        font-weight: 600;
        border: 0;
      }
      .button-secondary {
        background: white;
        color: var(--ink);
        border: 1px solid var(--border);
      }
      .notes {
        display: grid;
        gap: 0.85rem;
      }
      .note {
        border: 1px solid var(--border);
        border-radius: 18px;
        padding: 0.95rem 1rem;
        background: rgba(255,255,255,0.72);
      }
      .reference-shell {
        border: 1px solid var(--border);
        border-radius: 26px;
        overflow: hidden;
        background: rgba(255,255,255,0.84);
        box-shadow: 0 18px 42px rgba(20, 40, 29, 0.08);
      }
      #scalar-api-reference {
        min-height: 70vh;
      }
      @media (max-width: 900px) {
        .shell {
          width: min(calc(100% - 1rem), 1320px);
          padding-top: 0.75rem;
        }
        .hero, .stats {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <article class="panel hero-copy">
          <div>
            <span class="eyebrow">Developer docs</span>
            <h1>YardMatch API</h1>
          </div>
          <p>
            Interactive reference for auth, bookings, staffing, on-route handoff, support,
            observability, and the shared marketplace flows used by web and mobile.
          </p>
          <div class="stats">
            <div class="stat">
              <strong>${endpointCount}</strong>
              <span>documented operations</span>
            </div>
            <div class="stat">
              <strong>${apiSpec.tags.length}</strong>
              <span>route groups</span>
            </div>
            <div class="stat">
              <strong>JWT</strong>
              <span>bearer auth</span>
            </div>
          </div>
          <div class="actions">
            <a class="button" href="/api/docs/openapi.json">Open JSON spec</a>
            <a class="button button-secondary" href="/api/observability/overview">Live ops endpoint</a>
          </div>
        </article>
        <article class="panel notes">
          <h2>Integration notes</h2>
          <div class="note">
            <strong>Shared contracts first</strong>
            <p>Use the in-repo contracts package when possible so clients stay aligned with request and response shapes.</p>
          </div>
          <div class="note">
            <strong>Auth and ownership</strong>
            <p>Protected routes infer identity from the bearer token. Customer, provider, and crew access is role-checked in the API.</p>
          </div>
          <div class="note">
            <strong>Operational behavior</strong>
            <p>Customer↔provider chat unlocks only after an accepted crew member confirms they are on route for the booking.</p>
          </div>
        </article>
      </section>

      <section class="reference-shell">
        <div id="scalar-api-reference"></div>
      </section>
    </main>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#scalar-api-reference', {
        url: '/api/docs/openapi.json',
        title: 'YardMatch API',
        layout: 'modern',
        theme: 'default',
        defaultHttpClient: {
          targetKey: 'js',
          clientKey: 'fetch'
        },
        hideDownloadButton: false,
        darkMode: false
      });
    </script>
    <noscript>
      <main class="shell">
        <article class="panel">
          <h2>JavaScript is required for the interactive API reference.</h2>
          <p>You can still inspect the OpenAPI document directly at <a href="/api/docs/openapi.json">/api/docs/openapi.json</a>.</p>
        </article>
      </main>
    </noscript>
  </body>
</html>`;
}
