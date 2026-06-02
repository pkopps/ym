-- CreateTable
CREATE TABLE "user_accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "address" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "userId" TEXT NOT NULL,
    "propertyNotes" TEXT NOT NULL,
    "lawnSizeSqFt" INTEGER NOT NULL,
    "defaultPropertyId" TEXT,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "customer_properties" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address" JSONB NOT NULL,
    "gateCode" TEXT,
    "accessNotes" TEXT,
    "lawnSizeSqFt" INTEGER,
    "shrubBedSqFt" INTEGER,
    "drivewaySqFt" INTEGER,
    "sidewalkLinearFt" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_business_profiles" (
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "yearsExperience" INTEGER NOT NULL,
    "serviceRadiusMiles" INTEGER NOT NULL,
    "sponsoredListingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "categories" TEXT[],
    "rating" DOUBLE PRECISION NOT NULL,
    "timelinessRating" DOUBLE PRECISION NOT NULL,
    "attentionToDetailRating" DOUBLE PRECISION NOT NULL,
    "reviewCount" INTEGER NOT NULL,
    "calendarConnection" JSONB NOT NULL,

    CONSTRAINT "provider_business_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "crew_member_profiles" (
    "userId" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "yearsExperience" INTEGER NOT NULL,
    "categories" TEXT[],
    "willingToTravelMiles" INTEGER NOT NULL,
    "preferredSchedule" TEXT NOT NULL,
    "hasOwnEquipment" BOOLEAN NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "completedJobs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "assignedProviderId" TEXT,

    CONSTRAINT "crew_member_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "availability_slots" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "startIso" TIMESTAMP(3) NOT NULL,
    "endIso" TIMESTAMP(3) NOT NULL,
    "isBooked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "availability_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "serviceAddress" JSONB NOT NULL,
    "servicePropertyId" TEXT,
    "category" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "scheduledStartIso" TIMESTAMP(3) NOT NULL,
    "scheduledEndIso" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "reviewId" TEXT,
    "addressChangeHistory" JSONB NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_reviews" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "overallRating" INTEGER NOT NULL,
    "timelinessRating" INTEGER NOT NULL,
    "attentionToDetailRating" INTEGER NOT NULL,
    "reviewText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_invites" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "channels" TEXT[],
    "scheduledSendIso" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAtIso" TIMESTAMP(3) NOT NULL,
    "deepLinkPath" TEXT NOT NULL,

    CONSTRAINT "review_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_records" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "refundable" BOOLEAN NOT NULL,
    "refundReason" TEXT,

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "requesterId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_accounts_email_key" ON "user_accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "provider_reviews_bookingId_key" ON "provider_reviews"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "review_invites_bookingId_key" ON "review_invites"("bookingId");

-- AddForeignKey
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_properties" ADD CONSTRAINT "customer_properties_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_business_profiles" ADD CONSTRAINT "provider_business_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crew_member_profiles" ADD CONSTRAINT "crew_member_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_slots" ADD CONSTRAINT "availability_slots_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "provider_business_profiles"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
