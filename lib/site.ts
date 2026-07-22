export const site = {
  name: "Ashton Medina",
  role: "AI Solutions Architect",
  github: "https://github.com/AshtonMedina22",
  githubRepo: "https://github.com/AshtonMedina22/ai-systems-portfolio",
  linkedin: "https://www.linkedin.com/in/ashton-medina/",
  email: "ashtonmedina22@gmail.com",
} as const;

export const contactMailto = `mailto:${site.email}?subject=${encodeURIComponent(
  "Portfolio inquiry - AI systems"
)}`;
