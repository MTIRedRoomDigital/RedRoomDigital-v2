import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://redroomdigital.com";
  const now = new Date();

  return [
    { url: base,                    lastModified: now, changeFrequency: "daily",   priority: 1.0 },
    { url: `${base}/explore`,       lastModified: now, changeFrequency: "hourly",  priority: 0.9 },
    { url: `${base}/worlds`,        lastModified: now, changeFrequency: "hourly",  priority: 0.9 },
    { url: `${base}/pricing`,       lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${base}/forum`,         lastModified: now, changeFrequency: "daily",   priority: 0.7 },
    { url: `${base}/register`,      lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/login`,         lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/contact`,       lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/privacy`,       lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
    { url: `${base}/terms`,         lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
  ];
}
