export const site = {
  name: "Ashton Medina",
  role: "Business Systems Architect - AI & Automation",
  url: "https://ai-systems-portfolio-iota.vercel.app",
  github: "https://github.com/AshtonMedina22",
  githubRepo: "https://github.com/AshtonMedina22/ai-systems-portfolio",
  linkedin: "https://www.linkedin.com/in/ashton-medina/",
  email: "ashtonmedina22@gmail.com",
  title: "Ashton Medina - Business Systems Architect - AI & Automation",
  description:
    "I build the business systems companies run on - ERP platforms, integrations, and automated workflows, with AI built in where it earns its place under human oversight. Ten years turning fragmented tools and manual process into platforms people trust.",
} as const;

export const contactMailto = `mailto:${site.email}?subject=${encodeURIComponent(
  "Portfolio inquiry"
)}`;
