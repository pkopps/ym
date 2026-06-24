import { PrismaClient } from "@prisma/client";
import { DataEngineeringLogger } from "@yardmatch/analytics";
import { hashPassword, validatePasswordStrength } from "../auth";
import { PrismaMarketplaceRepository } from "../repositories/PrismaMarketplaceRepository";
import { MarketplacePlatformService } from "../services/MarketplacePlatformService";

interface ParsedArgs {
  email: string;
  fullName: string;
  password: string;
  phone: string;
  internalScope: "operations" | "admin";
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0) {
    return undefined;
  }

  const value = process.argv[index + 1];
  return value?.trim() || undefined;
}

function parseArgs(): ParsedArgs {
  const email = readArg("--email");
  const fullName = readArg("--name") ?? readArg("--full-name");
  const password = readArg("--password");
  const phone = readArg("--phone");
  const internalScopeArg = readArg("--scope") ?? "admin";

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to create or update an ops user.");
  }

  if (!email || !fullName || !password || !phone) {
    throw new Error(
      "Usage: npm --workspace @yardmatch/api run ops:create-user -- --email ops@example.com --name \"Casey Ops\" --password \"StrongPass123\" --phone \"555-0990\" [--scope admin|operations]"
    );
  }
  if (internalScopeArg !== "admin" && internalScopeArg !== "operations") {
    throw new Error("`--scope` must be either `admin` or `operations`.");
  }

  return {
    email: email.toLowerCase(),
    fullName,
    password,
    phone,
    internalScope: internalScopeArg
  };
}

async function main() {
  const args = parseArgs();
  validatePasswordStrength(args.password);

  const prisma = new PrismaClient();
  const repository = new PrismaMarketplaceRepository(prisma);
  const platform = new MarketplacePlatformService(repository, new DataEngineeringLogger());

  try {
    const existingIdentity = await platform.findAuthIdentityByEmail(args.email);
    if (existingIdentity && existingIdentity.role !== "ops") {
      throw new Error(`A non-ops account already uses ${args.email}.`);
    }

    if (!existingIdentity) {
      const opsUser = await platform.registerUser(
        {
          fullName: args.fullName,
          email: args.email,
          password: args.password,
          phone: args.phone,
          role: "ops",
          internalScope: args.internalScope,
          address: {
            line1: "18 Bay Ave",
            city: "Barnegat",
            state: "NJ",
            postalCode: "08005",
            country: "US",
            point: {
              latitude: 39.7532,
              longitude: -74.2229
            }
          }
        },
        hashPassword(args.password)
      );

      console.log(`Created ops user ${opsUser.email} (${opsUser.id}).`);
      return;
    }

    const existingOpsUser = await repository.findOpsUserById(existingIdentity.userId);
    if (!existingOpsUser) {
      throw new Error(`Ops profile for ${args.email} could not be loaded.`);
    }

    await repository.updateOpsUser(existingOpsUser.id, {
      fullName: args.fullName,
      phone: args.phone,
      internalScope: args.internalScope
    });
    await platform.updateAuthIdentity(existingOpsUser.id, {
      passwordHash: hashPassword(args.password),
      sessionVersion: (existingIdentity.sessionVersion ?? 1) + 1
    });

    console.log(`Updated ops user ${args.email} and rotated existing sessions.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unable to create ops user.");
  process.exitCode = 1;
});
