export type RobotsDecision = "ALLOWED" | "BLOCKED" | "UNSPECIFIED";

interface RobotsRule {
  directive: "ALLOW" | "DISALLOW";
  path: string;
}

interface RobotsGroup {
  userAgents: string[];
  rules: RobotsRule[];
}

export interface ParsedRobotsPolicy {
  groups: RobotsGroup[];
  sitemaps: string[];
}

function stripComment(line: string): string {
  const index = line.indexOf("#");
  return (index >= 0 ? line.slice(0, index) : line).trim();
}

export function parseRobotsPolicy(text: string): ParsedRobotsPolicy {
  const groups: RobotsGroup[] = [];
  const sitemaps = new Set<string>();
  let currentGroup: RobotsGroup | null = null;
  let currentGroupHasRules = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripComment(rawLine);

    if (!line) {
      continue;
    }

    const separator = line.indexOf(":");

    if (separator < 0) {
      continue;
    }

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "sitemap") {
      if (value) {
        sitemaps.add(value);
      }
      continue;
    }

    if (field === "user-agent") {
      if (!value) {
        continue;
      }

      if (!currentGroup || currentGroupHasRules) {
        currentGroup = {
          userAgents: [],
          rules: [],
        };
        groups.push(currentGroup);
        currentGroupHasRules = false;
      }

      currentGroup.userAgents.push(value.toLowerCase());
      continue;
    }

    if (
      (field === "allow" || field === "disallow") &&
      currentGroup
    ) {
      currentGroup.rules.push({
        directive: field === "allow" ? "ALLOW" : "DISALLOW",
        path: value,
      });
      currentGroupHasRules = true;
    }
  }

  return {
    groups,
    sitemaps: [...sitemaps].slice(0, 20),
  };
}

function userAgentSpecificity(
  group: RobotsGroup,
  userAgent: string,
): number {
  const normalized = userAgent.toLowerCase();
  let specificity = -1;

  for (const token of group.userAgents) {
    if (token === "*") {
      specificity = Math.max(specificity, 0);
      continue;
    }

    if (normalized.includes(token)) {
      specificity = Math.max(specificity, token.length);
    }
  }

  return specificity;
}

function rulePattern(path: string): RegExp | null {
  if (!path) {
    return null;
  }

  const endAnchored = path.endsWith("$");
  const raw = endAnchored ? path.slice(0, -1) : path;
  const escaped = raw
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}${endAnchored ? "$" : ""}`);
}

function ruleSpecificity(path: string): number {
  return path.replace(/[\*$]/g, "").length;
}

export function evaluateRobotsPolicy(
  policy: ParsedRobotsPolicy,
  userAgent: string,
  pathname: string,
): RobotsDecision {
  const matches = policy.groups
    .map((group) => ({
      group,
      specificity: userAgentSpecificity(group, userAgent),
    }))
    .filter((item) => item.specificity >= 0);

  if (matches.length === 0) {
    return "UNSPECIFIED";
  }

  const highestSpecificity = Math.max(
    ...matches.map((item) => item.specificity),
  );
  const applicableRules = matches
    .filter((item) => item.specificity === highestSpecificity)
    .flatMap((item) => item.group.rules);

  let selected:
    | {
        directive: "ALLOW" | "DISALLOW";
        specificity: number;
      }
    | undefined;

  for (const rule of applicableRules) {
    const pattern = rulePattern(rule.path);

    if (!pattern || !pattern.test(pathname)) {
      continue;
    }

    const specificity = ruleSpecificity(rule.path);

    if (
      !selected ||
      specificity > selected.specificity ||
      (specificity === selected.specificity &&
        rule.directive === "ALLOW")
    ) {
      selected = {
        directive: rule.directive,
        specificity,
      };
    }
  }

  if (!selected) {
    return "UNSPECIFIED";
  }

  return selected.directive === "ALLOW" ? "ALLOWED" : "BLOCKED";
}
