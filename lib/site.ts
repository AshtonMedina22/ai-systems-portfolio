export const site = {
  name: "Ashton Medina",
  role: "Systems Architect & Operations Consultant",
  url: "https://ai-systems-portfolio-iota.vercel.app",
  github: "https://github.com/AshtonMedina22",
  githubRepo: "https://github.com/AshtonMedina22/ai-systems-portfolio",
  linkedin: "https://www.linkedin.com/in/ashton-medina/",
  email: "ashtonmedina22@gmail.com",
  title: "Ashton Medina - Systems Architect & Operations Consultant",
  description:
    "Ashton Medina builds custom software tools, database pipelines, and automated workflows for multi-site operations - with 10 years of hands-on operational experience.",
} as const;

export const contactMailto = `mailto:${site.email}?subject=${encodeURIComponent(
  "Portfolio inquiry"
)}`;
