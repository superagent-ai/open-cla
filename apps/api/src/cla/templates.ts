export type DefaultClaTemplate = {
  name: string;
  title: string;
  description: string;
  body: string;
};

export const DEFAULT_CLA_TEMPLATE_FALLBACK_NAME = "standard-combined-v1";

export const defaultClaTemplates: Record<string, DefaultClaTemplate> = {
  "standard-combined-v1": {
    name: "standard-combined-v1",
    title: "Standard Contributor License Agreement",
    description: "Balanced default for projects accepting both personal and organization signatures.",
    body: `# Standard Contributor License Agreement

Thank you for contributing to this project. This Contributor License Agreement
explains the rights you grant for contributions you submit to the project.

## 1. Definitions

"Contribution" means any code, documentation, design, text, test, data, issue,
pull request, suggestion, or other material that you intentionally submit to the
project.

"Project" means the repository, package, service, documentation, and related
materials to which you submit a Contribution.

"You" means the person signing this agreement. If you are signing on behalf of an
organization, "You" also means that organization.

## 2. Copyright License

You grant the project maintainers and all recipients of the Project a perpetual,
worldwide, non-exclusive, royalty-free, irrevocable copyright license to use,
copy, prepare derivative works of, publicly display, publicly perform,
sublicense, and distribute your Contributions as part of the Project.

## 3. Patent License

You grant the project maintainers and all recipients of the Project a perpetual,
worldwide, non-exclusive, royalty-free, irrevocable patent license to make, have
made, use, offer to sell, sell, import, and otherwise transfer the Project, but
only for patent claims that You can license and that are necessarily infringed by
your Contributions alone or by combining your Contributions with the Project.

## 4. Your Representations

You represent that:

- You have the legal right to submit each Contribution.
- Each Contribution is your original work, or You have sufficient rights to
  submit it under this agreement.
- If You are signing for an organization, You are authorized to bind that
  organization.
- You are not knowingly submitting material that violates another person's or
  organization's rights.
- You will identify any third-party material included in a Contribution when
  required by its license or when it is not obvious from the Contribution.

## 5. Project License

You understand that the Project may distribute your Contributions under the
Project's current license and under future versions of that license, or under
another license chosen by the project maintainers for the Project.

## 6. No Warranty

Your Contributions are provided "as is", without warranties or conditions of any
kind, express or implied, including warranties of merchantability, fitness for a
particular purpose, and non-infringement.

## 7. Agreement

By signing, You agree that this agreement applies to all Contributions You submit
to the Project.
`
  },
  "inbound-outbound-v1": {
    name: "inbound-outbound-v1",
    title: "Inbound = Outbound Contribution Agreement",
    description: "Lightweight agreement that licenses contributions under the same terms as the project.",
    body: `# Inbound = Outbound Contribution Agreement

Thank you for contributing to this project. This agreement keeps contribution
terms simple: your Contributions are licensed to the project under the same
license terms that the project uses for outbound distribution.

## 1. Definitions

"Contribution" means any code, documentation, text, design, issue, pull request,
test, or other material that you intentionally submit to the project.

"Project License" means the license or licenses under which the project is made
available at the time You submit a Contribution.

"You" means the person signing this agreement. If You are signing on behalf of an
organization, "You" also means that organization.

## 2. License Grant

You license each Contribution under the Project License. The project maintainers
and all recipients of the project may use, copy, modify, publish, distribute,
sublicense, and otherwise exercise your Contribution under the Project License.

If the Project License includes a patent license, You grant that patent license
for patent claims that You can license and that are necessarily infringed by your
Contribution alone or by combining your Contribution with the project.

## 3. Your Representations

You represent that:

- You have the legal right to submit each Contribution under the Project License.
- Each Contribution is your original work, or You have sufficient rights to
  submit it under the Project License.
- If You are signing for an organization, You are authorized to bind that
  organization.
- You will identify third-party material when required by its license.

## 4. No Warranty

Your Contributions are provided "as is", without warranties or conditions of any
kind, express or implied.

## 5. Agreement

By signing, You agree that this agreement applies to all Contributions You submit
to the project.
`
  },
  "copyright-only-v1": {
    name: "copyright-only-v1",
    title: "Copyright-Only Contributor License Agreement",
    description: "Copyright license without an express patent grant.",
    body: `# Copyright-Only Contributor License Agreement

Thank you for contributing to this project. This agreement grants copyright
permission for your Contributions. It does not grant an express patent license.

## 1. Definitions

"Contribution" means any code, documentation, text, design, issue, pull request,
test, or other material that You intentionally submit to the project.

"You" means the person signing this agreement. If You are signing on behalf of an
organization, "You" also means that organization.

## 2. Copyright License

You grant the project maintainers and all recipients of the project a perpetual,
worldwide, non-exclusive, royalty-free, irrevocable copyright license to use,
copy, prepare derivative works of, publicly display, publicly perform,
sublicense, and distribute your Contributions as part of the project.

To the extent permitted by law, You waive or agree not to assert moral rights,
database rights, or similar rights that would prevent the project maintainers or
recipients from exercising this copyright license.

## 3. No Patent License

This agreement does not grant an express patent license. If the project requires
patent rights for Contributions, use a template that includes an express patent
grant.

## 4. Your Representations

You represent that:

- You have the legal right to submit each Contribution.
- Each Contribution is your original work, or You have sufficient rights to
  submit it under this agreement.
- If You are signing for an organization, You are authorized to bind that
  organization.
- You are not knowingly submitting material that violates another person's or
  organization's rights.

## 5. Project License

You understand that the project may distribute your Contributions under the
project's current license and under future versions of that license, or under
another license chosen by the project maintainers for the project.

## 6. No Warranty

Your Contributions are provided "as is", without warranties or conditions of any
kind, express or implied.

## 7. Agreement

By signing, You agree that this agreement applies to all Contributions You submit
to the project.
`
  },
  "patent-grant-v1": {
    name: "patent-grant-v1",
    title: "Patent Grant Contributor License Agreement",
    description: "Stronger CLA with explicit copyright and patent grants plus defensive termination.",
    body: `# Patent Grant Contributor License Agreement

Thank you for contributing to this project. This agreement grants copyright and
patent rights needed to use your Contributions in the project.

## 1. Definitions

"Contribution" means any code, documentation, text, design, issue, pull request,
test, or other material that You intentionally submit to the project.

"Project" means the repository, package, service, documentation, and related
materials to which You submit a Contribution.

"You" means the person signing this agreement. If You are signing on behalf of an
organization, "You" also means that organization.

## 2. Copyright License

You grant the project maintainers and all recipients of the Project a perpetual,
worldwide, non-exclusive, royalty-free, irrevocable copyright license to use,
copy, prepare derivative works of, publicly display, publicly perform,
sublicense, and distribute your Contributions as part of the Project.

## 3. Patent License

You grant the project maintainers and all recipients of the Project a perpetual,
worldwide, non-exclusive, royalty-free, irrevocable patent license to make, have
made, use, offer to sell, sell, import, and otherwise transfer the Project, but
only for patent claims that You can license and that are necessarily infringed by
your Contributions alone or by combining your Contributions with the Project.

## 4. Defensive Termination

If You or an organization on whose behalf You signed this agreement initiate a
patent claim alleging that the Project or a Contribution infringes a patent, any
patent licenses granted to You under this agreement for the Project terminate as
of the date that claim is initiated.

## 5. Your Representations

You represent that:

- You have the legal right to submit each Contribution.
- Each Contribution is your original work, or You have sufficient rights to
  submit it under this agreement.
- If You are signing for an organization, You are authorized to bind that
  organization.
- You are not knowingly submitting material that violates another person's or
  organization's rights.
- You will identify any third-party material included in a Contribution when
  required by its license or when it is not obvious from the Contribution.

## 6. Project License

You understand that the Project may distribute your Contributions under the
Project's current license and under future versions of that license, or under
another license chosen by the project maintainers for the Project.

## 7. No Warranty

Your Contributions are provided "as is", without warranties or conditions of any
kind, express or implied.

## 8. Agreement

By signing, You agree that this agreement applies to all Contributions You submit
to the Project.
`
  },
  "organization-covered-v1": {
    name: "organization-covered-v1",
    title: "Organization Contributor License Agreement",
    description: "For companies or organizations that want one owner signature to cover authorized contributors.",
    body: `# Organization Contributor License Agreement

Thank you for contributing to this project. This agreement is intended for
organizations that authorize employees, contractors, members, or other
representatives to contribute to the project. If You sign personally, this
agreement applies only to your own Contributions.

## 1. Definitions

"Contribution" means any code, documentation, design, text, test, data, issue,
pull request, suggestion, or other material intentionally submitted to the
project.

"Covered Contributor" means an employee, contractor, member, or other person who
is authorized by the organization signing this agreement to submit Contributions
to the project on the organization's behalf.

"Organization" means the organization on whose behalf this agreement is signed.

"You" means the person signing this agreement and, when signed on behalf of an
Organization, that Organization.

## 2. Covered Contributions

When signed on behalf of an Organization, this agreement applies to Contributions
submitted by Covered Contributors within the scope of their authorization from
the Organization.

The Organization is responsible for deciding who is authorized to contribute on
its behalf. If a Covered Contributor submits material they own personally and not
on behalf of the Organization, that person should sign separately as an
individual contributor.

## 3. Copyright License

You grant the project maintainers and all recipients of the project a perpetual,
worldwide, non-exclusive, royalty-free, irrevocable copyright license to use,
copy, prepare derivative works of, publicly display, publicly perform,
sublicense, and distribute Covered Contributions as part of the project.

## 4. Patent License

You grant the project maintainers and all recipients of the project a perpetual,
worldwide, non-exclusive, royalty-free, irrevocable patent license to make, have
made, use, offer to sell, sell, import, and otherwise transfer the project, but
only for patent claims that You can license and that are necessarily infringed by
Covered Contributions alone or by combining Covered Contributions with the
project.

## 5. Authority and Representations

You represent that:

- You are authorized to sign this agreement.
- The Organization has the legal right to submit Covered Contributions under
  this agreement.
- Covered Contributions are original work of the Organization or its Covered
  Contributors, or the Organization has sufficient rights to submit them under
  this agreement.
- The Organization is not knowingly submitting material that violates another
  person's or organization's rights.
- Third-party material included in Covered Contributions will be identified when
  required by its license or when it is not obvious from the Contribution.

## 6. Project License

You understand that the project may distribute Covered Contributions under the
project's current license and under future versions of that license, or under
another license chosen by the project maintainers for the project.

## 7. No Warranty

Covered Contributions are provided "as is", without warranties or conditions of
any kind, express or implied.

## 8. Agreement

By signing, You agree that this agreement applies to Covered Contributions
submitted to the project.
`
  },
  "docs-content-v1": {
    name: "docs-content-v1",
    title: "Documentation and Content Contribution Agreement",
    description: "For documentation, websites, examples, tutorials, media, and other non-code content.",
    body: `# Documentation and Content Contribution Agreement

Thank you for contributing documentation or content to this project. This
agreement applies to non-code Contributions such as documentation, examples,
tutorials, website copy, diagrams, images, designs, translations, comments, and
other written or visual materials.

## 1. Definitions

"Content Contribution" means any documentation, text, example, tutorial, website
copy, diagram, image, design, translation, comment, issue, pull request, or other
non-code material that You intentionally submit to the project.

"You" means the person signing this agreement. If You are signing on behalf of an
organization, "You" also means that organization.

## 2. Content License

You grant the project maintainers and all recipients of the project a perpetual,
worldwide, non-exclusive, royalty-free, irrevocable copyright license to use,
copy, adapt, translate, prepare derivative works of, publicly display, publicly
perform, sublicense, and distribute your Content Contributions as part of the
project.

The project may distribute Content Contributions under the project's code
license, documentation license, website terms, or another license chosen by the
project maintainers for project materials.

## 3. Attribution and Moral Rights

The project may, but is not required to, credit You for Content Contributions. To
the extent permitted by law, You waive or agree not to assert moral rights,
database rights, or similar rights that would prevent the project maintainers or
recipients from using Content Contributions under this agreement.

## 4. Your Representations

You represent that:

- You have the legal right to submit each Content Contribution.
- Each Content Contribution is your original work, or You have sufficient rights
  to submit it under this agreement.
- If You are signing for an organization, You are authorized to bind that
  organization.
- You have permission for any third-party text, image, media, trademark, or
  personal information included in a Content Contribution.
- You will identify third-party material when required by its license.

## 5. No Warranty

Your Content Contributions are provided "as is", without warranties or conditions
of any kind, express or implied.

## 6. Agreement

By signing, You agree that this agreement applies to all Content Contributions
You submit to the project.
`
  },
  "experimental-research-v1": {
    name: "experimental-research-v1",
    title: "Experimental and Research Contribution Agreement",
    description: "For research repositories, demos, notebooks, datasets, models, and prototypes.",
    body: `# Experimental and Research Contribution Agreement

Thank you for contributing to this experimental or research project. This
agreement is designed for repositories that may include prototypes, notebooks,
datasets, benchmarks, models, documentation, or research artifacts.

## 1. Definitions

"Contribution" means any code, notebook, script, documentation, model, benchmark,
configuration, dataset metadata, data sample, issue, pull request, suggestion, or
other material that You intentionally submit to the project.

"Research Artifact" means a Contribution that is experimental, exploratory,
scientific, educational, benchmark-oriented, or otherwise research-focused.

"You" means the person signing this agreement. If You are signing on behalf of an
organization, "You" also means that organization.

## 2. Copyright License

You grant the project maintainers and all recipients of the project a perpetual,
worldwide, non-exclusive, royalty-free, irrevocable copyright license to use,
copy, prepare derivative works of, publicly display, publicly perform,
sublicense, and distribute your Contributions as part of the project.

## 3. Patent License

You grant the project maintainers and all recipients of the project a perpetual,
worldwide, non-exclusive, royalty-free, irrevocable patent license to make, have
made, use, offer to sell, sell, import, and otherwise transfer the project, but
only for patent claims that You can license and that are necessarily infringed by
your Contributions alone or by combining your Contributions with the project.

## 4. Data, Models, and Research Materials

If You submit data, model weights, prompts, outputs, benchmarks, or other
Research Artifacts, You represent that You have the rights and permissions needed
to submit them. You must not knowingly submit confidential information,
restricted personal data, regulated data, or material that cannot be shared under
the project's license or instructions.

You understand that the project maintainers may modify, remove, decline,
evaluate, reproduce, publish, or stop using Research Artifacts at their
discretion.

## 5. Your Representations

You represent that:

- You have the legal right to submit each Contribution.
- Each Contribution is your original work, or You have sufficient rights to
  submit it under this agreement.
- If You are signing for an organization, You are authorized to bind that
  organization.
- You are not knowingly submitting material that violates another person's or
  organization's rights.
- You will identify third-party material, datasets, models, or licenses when
  required by their terms or when they are not obvious from the Contribution.

## 6. No Validation or Warranty

Research Artifacts may be incomplete, experimental, incorrect, insecure, or
non-reproducible. Your Contributions are provided "as is", without warranties or
conditions of any kind, express or implied.

## 7. Project License

You understand that the project may distribute your Contributions under the
project's current license and under future versions of that license, or under
another license chosen by the project maintainers for the project.

## 8. Agreement

By signing, You agree that this agreement applies to all Contributions You submit
to the project.
`
  },
  "individual-v1": {
    name: "individual-v1",
    title: "Individual Contributor License Agreement",
    description: "Individual contributor CLA kept for compatibility with existing deployments.",
    body: `# Individual Contributor License Agreement

Thank you for contributing to this project. This agreement applies to
Contributions You submit as an individual.

## 1. Definitions

"Contribution" means any code, documentation, design, text, test, data, issue,
pull request, suggestion, or other material that You intentionally submit to the
project.

"You" means the individual person signing this agreement.

## 2. Copyright License

You grant the project maintainers and all recipients of the project a perpetual,
worldwide, non-exclusive, royalty-free, irrevocable copyright license to use,
copy, prepare derivative works of, publicly display, publicly perform,
sublicense, and distribute your Contributions as part of the project.

## 3. Patent License

You grant the project maintainers and all recipients of the project a perpetual,
worldwide, non-exclusive, royalty-free, irrevocable patent license to make, have
made, use, offer to sell, sell, import, and otherwise transfer the project, but
only for patent claims that You can license and that are necessarily infringed by
your Contributions alone or by combining your Contributions with the project.

## 4. Your Representations

You represent that:

- You have the legal right to submit each Contribution.
- Each Contribution is your original work, or You have sufficient rights to
  submit it under this agreement.
- You are not knowingly submitting material that violates another person's or
  organization's rights.
- You will identify any third-party material included in a Contribution when
  required by its license or when it is not obvious from the Contribution.

## 5. Employment or Organization Rights

If your employer or another organization may own rights in your Contributions,
You represent that You have permission to submit those Contributions under this
agreement or that the organization has separately authorized them.

## 6. Project License

You understand that the project may distribute your Contributions under the
project's current license and under future versions of that license, or under
another license chosen by the project maintainers for the project.

## 7. No Warranty

Your Contributions are provided "as is", without warranties or conditions of any
kind, express or implied.

## 8. Agreement

By signing, You agree that this agreement applies to all Contributions You submit
to the project as an individual.
`
  }
};

export function listDefaultTemplates(): DefaultClaTemplate[] {
  return Object.values(defaultClaTemplates);
}

export function getDefaultTemplate(name: string): DefaultClaTemplate {
  const template =
    defaultClaTemplates[name] ?? defaultClaTemplates[DEFAULT_CLA_TEMPLATE_FALLBACK_NAME];
  if (!template) {
    throw new Error("Default CLA template registry is empty");
  }

  return template;
}
