import { getSiteUrl } from "@/lib/publicSite";

// "Платформа по адресу <host>" when NEXTAUTH_URL is set, otherwise just "Платформа".
export function SiteAddress() {
  const site = getSiteUrl();
  if (!site) {
    return <>Платформа</>;
  }
  return (
    <>
      Платформа по адресу{" "}
      <a href={`${site.origin}/`} className="underline">
        {site.host}
      </a>
    </>
  );
}
