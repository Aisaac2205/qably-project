const UNKNOWN = 'unknown';

export interface DiagnosableResponse {
  readonly candidates?: readonly { readonly finishReason?: string }[];
  readonly usageMetadata?: {
    readonly promptTokenCount?: number;
    readonly candidatesTokenCount?: number;
  };
}

function countOrUnknown(count: number | undefined): string {
  return count === undefined ? UNKNOWN : String(count);
}

export function describeResponseDiagnostics(
  response: DiagnosableResponse,
  maxOutputTokens: number,
): string {
  const finishReason = response.candidates?.[0]?.finishReason ?? UNKNOWN;
  const outputTokens = countOrUnknown(
    response.usageMetadata?.candidatesTokenCount,
  );
  const promptTokens = countOrUnknown(response.usageMetadata?.promptTokenCount);

  return `finishReason=${finishReason}, output tokens ${outputTokens} of ${maxOutputTokens}, prompt tokens ${promptTokens}`;
}
