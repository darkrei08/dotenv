export type ImageSource = {
  data: string;
  mimeType: string;
  widthCells: number;
};

type ImageBlock = {
  type: string;
  data?: string;
  mimeType?: string;
};

type ImageCapabilities = {
  images?: string | null;
};

type ImageResult = {
  content: ImageBlock[];
};

const SENSITIVE_FLAG_RE =
  /(--?(?:api[-_]?key|token|secret|password|passwd|pwd|auth|authorization|access[-_]?token|refresh[-_]?token)(?:\s+|=))([^\s'"`]+)/gi;
const SENSITIVE_ASSIGNMENT_RE =
  /\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|AUTH|CREDENTIAL|PRIVATE[_-]?KEY)[A-Z0-9_]*\s*=\s*)([^\s'"`]+)/gi;
const BEARER_RE = /\b(Bearer\s+)([A-Za-z0-9._~+\/-]+=*)/gi;
const COMMON_SECRET_RE =
  /\b(?:sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]+|xox[baprs]-[A-Za-z0-9-]{8,}|AKIA[0-9A-Z]{16})\b/g;

export function redactSensitive(text: string): string {
  return text
    .replace(SENSITIVE_ASSIGNMENT_RE, "$1[redacted]")
    .replace(SENSITIVE_FLAG_RE, "$1[redacted]")
    .replace(BEARER_RE, "$1[redacted]")
    .replace(COMMON_SECRET_RE, "[redacted]");
}

export function imageSourcesForResult(
  result: ImageResult | undefined,
  showImages: boolean,
  imageWidthCells: number,
  capabilities: ImageCapabilities,
): ImageSource[] {
  if (!result || !showImages || !capabilities.images) return [];

  return result.content
    .filter(
      (entry): entry is ImageBlock & { data: string; mimeType: string } =>
        entry.type === "image" &&
        typeof entry.data === "string" &&
        entry.data.length > 0 &&
        typeof entry.mimeType === "string" &&
        entry.mimeType.length > 0,
    )
    .map(({ data, mimeType }) => ({
      data,
      mimeType,
      widthCells: imageWidthCells,
    }));
}
