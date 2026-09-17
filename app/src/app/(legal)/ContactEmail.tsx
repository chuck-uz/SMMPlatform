import { getContactEmail } from "@/lib/publicSite";

// Renders "на <mailto>" when CONTACT_EMAIL is configured, otherwise a neutral
// phrase without a mailbox so the sentence still reads correctly.
export function ContactEmail({ lead = "на" }: { lead?: string }) {
  const email = getContactEmail();
  if (!email) {
    return <>через форму обратной связи на сайте</>;
  }
  return (
    <>
      {lead ? `${lead} ` : null}
      <a href={`mailto:${email}`} className="underline">
        {email}
      </a>
    </>
  );
}
