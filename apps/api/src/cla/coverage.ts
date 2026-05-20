import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import type { DbClient } from "../db/client.js";
import {
  corporateAgreements,
  orgMembershipCache,
  personalSignatures,
  type CorporateAgreement
} from "../db/schema.js";

export type Contributor = {
  githubUserId: string | null;
  login: string;
  isBot?: boolean;
};

export type CoverageReason = "personal" | "corporate" | "bot";

export type CoveredContributor = Contributor & {
  reason: CoverageReason;
  corporateOrgLogin?: string;
};

export type MissingContributor = Contributor & {
  reason: string;
};

export type CoverageStatus = {
  covered: boolean;
  coveredContributors: CoveredContributor[];
  missingContributors: MissingContributor[];
};

export type MembershipVerifier = (params: {
  orgId: string;
  orgLogin: string;
  contributor: Contributor;
}) => Promise<boolean>;

type CorporateCoverage = Pick<
  CorporateAgreement,
  "orgId" | "orgLogin" | "effectiveUntil"
>;

export async function getCoverageStatus(params: {
  db: DbClient;
  contributors: Contributor[];
  claVersionHash: string;
  membershipVerifier?: MembershipVerifier;
}): Promise<CoverageStatus> {
  const contributorIds = params.contributors
    .filter((contributor) => !contributor.isBot)
    .map((contributor) => contributor.githubUserId)
    .filter((id): id is string => Boolean(id));

  const personalRows =
    contributorIds.length === 0
      ? []
      : await params.db.query.personalSignatures.findMany({
          where: (table) =>
            and(
              eq(table.claVersionHash, params.claVersionHash),
              inArray(table.githubUserId, contributorIds),
              isNull(table.revokedAt)
            )
        });

  const now = new Date();
  const corporateRows = await params.db.query.corporateAgreements.findMany({
    where: (table) =>
      and(
        eq(table.claVersionHash, params.claVersionHash),
        or(isNull(table.effectiveUntil), gt(table.effectiveUntil, now))
      )
  });

  return evaluateCoverage({
    contributors: params.contributors,
    personallySignedUserIds: new Set(personalRows.map((row) => row.githubUserId)),
    corporateAgreements: corporateRows,
    membershipVerifier:
      params.membershipVerifier ??
      ((membershipParams) => verifyMembershipFromCache(params.db, membershipParams))
  });
}

export async function evaluateCoverage(params: {
  contributors: Contributor[];
  personallySignedUserIds: Set<string>;
  corporateAgreements: CorporateCoverage[];
  membershipVerifier: MembershipVerifier;
}): Promise<CoverageStatus> {
  const coveredContributors: CoveredContributor[] = [];
  const missingContributors: MissingContributor[] = [];

  for (const contributor of dedupeContributors(params.contributors)) {
    if (contributor.isBot) {
      coveredContributors.push({ ...contributor, reason: "bot" });
      continue;
    }

    if (!contributor.githubUserId) {
      missingContributors.push({
        ...contributor,
        reason: "Contributor is not linked to a GitHub user"
      });
      continue;
    }

    if (params.personallySignedUserIds.has(contributor.githubUserId)) {
      coveredContributors.push({ ...contributor, reason: "personal" });
      continue;
    }

    const corporateAgreement = await findCoveringCorporateAgreement({
      contributor,
      agreements: params.corporateAgreements,
      membershipVerifier: params.membershipVerifier
    });

    if (corporateAgreement) {
      coveredContributors.push({
        ...contributor,
        reason: "corporate",
        corporateOrgLogin: corporateAgreement.orgLogin
      });
      continue;
    }

    missingContributors.push({
      ...contributor,
      reason: "No personal or corporate CLA signature covers this user"
    });
  }

  return {
    covered: missingContributors.length === 0,
    coveredContributors,
    missingContributors
  };
}

async function findCoveringCorporateAgreement(params: {
  contributor: Contributor;
  agreements: CorporateCoverage[];
  membershipVerifier: MembershipVerifier;
}): Promise<CorporateCoverage | null> {
  for (const agreement of params.agreements) {
    const isMember = await params.membershipVerifier({
      orgId: agreement.orgId,
      orgLogin: agreement.orgLogin,
      contributor: params.contributor
    });

    if (isMember) {
      return agreement;
    }
  }

  return null;
}

async function verifyMembershipFromCache(
  db: DbClient,
  params: {
    orgId: string;
    contributor: Contributor;
  }
): Promise<boolean> {
  if (!params.contributor.githubUserId) {
    return false;
  }
  const githubUserId = params.contributor.githubUserId;

  const membership = await db.query.orgMembershipCache.findFirst({
    where: (table) =>
      and(
        eq(table.orgId, params.orgId),
        eq(table.githubUserId, githubUserId),
        eq(table.active, true)
      )
  });

  return Boolean(membership);
}

function dedupeContributors(contributors: Contributor[]): Contributor[] {
  const seen = new Set<string>();
  const unique: Contributor[] = [];

  for (const contributor of contributors) {
    const key = contributor.githubUserId ?? `login:${contributor.login.toLowerCase()}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(contributor);
  }

  return unique;
}
