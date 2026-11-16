/**
 * Explorer persona briefs. Each is a goal and a short description of who the person is. Never steps: the explorer has
 * to find its own way, and the places it has to guess are findings.
 */
export type PersonaName = "first-time-owner" | "owner-two-properties" | "new-provider" | "provider-busy-day" | "crew-member" | "forgot-password";

export const PERSONAS: Record<PersonaName, { title: string; who: string; goal: string; alsoCheck: string[] }> = {
  "first-time-owner": {
    title: "First-time property owner",
    who: "You own a house in Barnegat, NJ (any street address in 08005). You have never used YardMatch. You are on your phone half the time.",
    goal: "Get your lawn mowed sometime next week by someone trustworthy, and know what it will cost and who is coming.",
    alsoCheck: ["What you are told about price, cancellation and what happens next before you commit.", "Whether you get a confirmation you can find again."]
  },
  "owner-two-properties": {
    title: "Owner with two properties",
    who: "You already have a YardMatch account. You own your home in Barnegat and a beach house in Manahawkin.",
    goal: "Set up weekly mowing at the beach house and a one-time cleanup at home, without mixing up the two addresses.",
    alsoCheck: ["Whether it is always clear which property a visit is for.", "How you would change or cancel one visit without touching the other."]
  },
  "new-provider": {
    title: "New provider onboarding",
    who: "You run a two-person lawn care business in Waretown, NJ with general liability insurance. A friend told you about YardMatch.",
    goal: "Sign up your business and get to the point where homeowners can book you.",
    alsoCheck: ["What you are asked for and why.", "Whether you know what is left to do and how long approval takes.", "How YardMatch charges you."]
  },
  "provider-busy-day": {
    title: "Provider on a busy day",
    who: "You run Bot Lawn 0 in Barnegat. Tomorrow is packed. You have a crew and it is the evening before.",
    goal: "Get ready for tomorrow: know every stop, answer anything waiting on you, and make sure your crew knows where to be.",
    alsoCheck: ["Anything waiting on you that is easy to miss.", "Whether what you see matches what the customer and crew see."]
  },
  "crew-member": {
    title: "Crew member",
    who: "You work on a crew for Bot Lawn 0. Your boss set up your account.",
    goal: "Find out where you are working tomorrow and what you need to do when you get there.",
    alsoCheck: ["What you can and cannot do yourself (call off, start the route, add photos).", "Whether you can see things a crew member should not."]
  },
  "forgot-password": {
    title: "Someone who forgot their password",
    who: "You booked a mowing with YardMatch a while ago. You cannot remember your password.",
    goal: "Get back into your account.",
    alsoCheck: [
      "Requesting a reset for an email that has no account.",
      "Using a reset link or code after it has expired (use the expire-reset tool), and using one a second time.",
      "Whether a session from before the reset still works afterwards (use the check-session tool)."
    ]
  }
};
