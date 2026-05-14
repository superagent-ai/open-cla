export type DefaultClaTemplate = {
  name: string;
  title: string;
  body: string;
};

export const defaultClaTemplates: Record<string, DefaultClaTemplate> = {
  "individual-v1": {
    name: "individual-v1",
    title: "Default Individual Contributor License Agreement",
    body: `# Contributor License Agreement

Thank you for contributing. By signing this agreement, you certify that you have
the right to submit your contributions and that your contributions may be used
under the repository's license.

This default template is a placeholder. Replace it with a repository-level
CLA.md or configure a reviewed organization template before production use.
`
  }
};

export function getDefaultTemplate(name: string): DefaultClaTemplate {
  const template = defaultClaTemplates[name] ?? defaultClaTemplates["individual-v1"];
  if (!template) {
    throw new Error("Default CLA template registry is empty");
  }

  return template;
}
