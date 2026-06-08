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
          "Used by the business owner by default after the route has started. Accepted crew can be supported later for delegated route-leader scenarios. This moves the booking into in-progress status.",
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
    "/api/places/search": {
      get: {
        tags: ["Search"],
        summary: "Search for cities, towns, and service areas",
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
          "Lets a landscaping business owner change the service radius used to match against each customer property address, choose whether matched crew members are auto-accepted or reviewed first, and manage outside-calendar blocking that protects YardMatch availability from direct clients or personal time.",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                serviceRadiusMiles: 20,
                staffingMode: "review-first",
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
          "200": { description: "Updated provider profile" }
        }
      }
    },
    "/api/providers/staffing": {
      get: {
        tags: ["Providers"],
        summary: "Get provider staffing overview",
        description:
          "Returns upcoming jobs, crew gaps, matched crew candidates, and accepted assignments for the authenticated provider business.",
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
          "Returns recent push, email, and SMS delivery records for the authenticated user, including retry metadata for push sends that can be attempted again.",
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
          "Creates a hosted Stripe Checkout session for a customer-owned booking and returns the checkout URL.",
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
          "201": { description: "Stripe checkout session created" }
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
          "Legacy/internal payment record creation path. Stripe Checkout should be used for real customer card payments.",
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
          "201": { description: "Payment authorized" }
        }
      }
    },
    "/api/payments/refund": {
      post: {
        tags: ["Payments"],
        summary: "Request or execute a refund",
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
          "200": { description: "Payment refunded" }
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
    "/api/support/ops/tickets": {
      get: {
        tags: ["Support"],
        summary: "List the internal support operations queue",
        description:
          "Returns support tickets with linked booking and participant context so operations can triage disputes, no-shows, and service issues.",
        responses: {
          "200": { description: "Support operations queue" }
        }
      }
    },
    "/api/support/ops/tickets/update": {
      post: {
        tags: ["Support"],
        summary: "Triages or resolves a support ticket",
        description:
          "Lets internal ops move a ticket into triaged or resolved state and optionally restore, cancel, or complete the linked booking.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                ticketId: "ticket_123",
                status: "resolved",
                resolutionAction: "restore-active-booking",
                resolutionNotes: "Support confirmed the booking should continue as scheduled."
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
          "Returns a subscribable ICS feed URL and webcal URL so providers can add YardMatch jobs and manual outside-calendar blocks to Apple Calendar, Google Calendar, and other iCal-compatible scheduling tools.",
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
          "Returns a combined schedule view for the authenticated provider, merging YardMatch jobs with blocking outside-calendar entries so mixed books of business can be managed in one timeline.",
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
          "Returns the provider's external iCal subscriptions and how many imported events they are currently contributing to availability blocking.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "External calendar imports" }
        }
      },
      post: {
        tags: ["Providers"],
        summary: "Add an outside calendar import",
        description:
          "Lets a provider paste a Google, Apple, or generic iCal feed URL so outside events can be pulled into YardMatch and block availability automatically.",
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
          "Fetches the latest iCal events for a saved external calendar subscription and updates the imported blocking events in YardMatch.",
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
