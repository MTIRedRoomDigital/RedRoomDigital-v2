import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*",              allow: "/" },
      { userAgent: "GPTBot",         disallow: "/" },
      { userAgent: "CCBot",          disallow: "/" },
      { userAgent: "Google-Extended", disallow: "/" },
      { userAgent: "OAI-SearchBot",  allow: "/" },
      { userAgent: "PerplexityBot",  allow: "/" },
    ],
    sitemap: "https://redroomdigital.com/sitemap.xml",
  };
}
