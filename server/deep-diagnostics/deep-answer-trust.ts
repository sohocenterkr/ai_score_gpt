export function answerExplicitlyDoesNotIdentifyTarget(
  answerText: string | null | undefined,
): boolean {
  if (!answerText?.trim()) {
    return false;
  }

  const opening = answerText
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .slice(0, 600);

  const koreanPatterns = [
    /(?:정확(?:한|히는?)?\s*)?[^.!?]{0,100}(?:서비스|브랜드|대상)[^.!?]{0,60}(?:확인하지 못|찾지 못|확인되지 않|확인할 수 없|찾을 수 없|식별하지 못)/,
    /(?:확인하지 못|찾지 못|확인되지 않|확인할 수 없|찾을 수 없|식별하지 못)[^.!?]{0,100}(?:서비스|브랜드|대상)/,
  ];
  const englishPatterns = [
    /(?:could not|couldn't|unable to|did not)\s+(?:verify|find|identify|confirm)[^.!?]{0,100}(?:service|brand|site|target)/i,
    /(?:service|brand|site|target)[^.!?]{0,100}(?:could not|couldn't|was not|is not)\s+(?:verified|found|identified|confirmed)/i,
  ];

  return [...koreanPatterns, ...englishPatterns].some(
    (pattern) => pattern.test(opening),
  );
}
