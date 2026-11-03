import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import wordmarkWhite from "@/assets/everloyal-wordmark-white.png";

// Short, plain-language privacy policy for the waitlist. Keep it in step with what the
// site actually collects (src/routes/index.tsx, src/lib/registration.ts, src/lib/device.ts).
export const LAST_UPDATED = "29 October 2026";
export const CONTACT_EMAIL = "admin@everloyal.pet";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Everloyal" },
      {
        name: "description",
        content: "How Everloyal collects, uses and protects the details you share on our waitlist.",
      },
    ],
  }),
  component: PrivacyPolicy,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="font-display text-xl font-semibold text-el-blue sm:text-2xl">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-el-ink/85 sm:text-base">
        {children}
      </div>
    </section>
  );
}

const List = ({ items }: { items: ReactNode[] }) => (
  <ul className="space-y-2">
    {items.map((item, i) => (
      <li key={i} className="flex gap-3">
        <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-el-orange" aria-hidden="true" />
        <span>{item}</span>
      </li>
    ))}
  </ul>
);

const homeLink =
  "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-el-lime focus-visible:ring-offset-2";

function PrivacyPolicy() {
  return (
    <div className="min-h-screen w-full bg-el-blue">
      <header className="mx-auto flex w-full max-w-3xl flex-col items-center gap-1.5 px-4 pb-6 pt-8 text-center sm:pt-10">
        <Link
          to="/"
          aria-label="Everloyal home"
          className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-el-lime"
        >
          <img src={wordmarkWhite} alt="Everloyal" className="h-12 w-auto sm:h-16" />
        </Link>
        <p className="font-display text-base font-semibold text-el-cream sm:text-lg">
          For Pawrents Who Care.
        </p>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-12 sm:px-6">
        <article className="rounded-[2rem] bg-el-cream p-6 shadow-2xl ring-1 ring-el-ink/10 sm:p-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-el-blue">
            Your data, looked after
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-el-blue-deep sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-el-ink/65">Last updated: {LAST_UPDATED}</p>

          <p className="mt-6 rounded-2xl bg-el-blue-deep p-4 text-[15px] leading-relaxed text-el-cream sm:p-5 sm:text-base">
            Everloyal (“we”, “us”) runs this waitlist for our upcoming dog nutrition products. We
            collect only what we need to welcome you, keep you updated and make better products for
            your dog.{" "}
            <strong className="text-el-lime">We never sell or rent your personal data.</strong>
          </p>

          <div className="mt-8">
            <Section title="What we collect">
              <p>When you join the waitlist, you give us:</p>
              <List
                items={[
                  "Your full name, mobile number, email address and city.",
                  "Your dog’s name and breed, and the concerns you pick (with any notes you add).",
                  "The invite code of the pawrent who shared Everloyal with you, if you used one.",
                ]}
              />
              <p>Your browser also tells us, without any extra permission:</p>
              <List
                items={[
                  "A short device description (for example, phone model, operating system and browser).",
                  "When you signed up and how long the form took to fill in.",
                ]}
              />
              <p>
                We don’t use advertising or tracking cookies. Your browser keeps a copy of your
                sign-up on your own device, so your welcome page works and a sign-up made offline is
                sent once you’re back online.
              </p>
            </Section>

            <Section title="How we use it">
              <List
                items={[
                  "To add you to the waitlist and recognise you if you sign up again.",
                  "To contact you about Everloyal’s launch, early access, free products and offers by phone, WhatsApp, SMS or email.",
                  "To understand what dogs need, so our nutrition team can shape each product.",
                  "To run the invite programme and credit the pawrents who refer others.",
                  "To keep the waitlist secure and free of spam or duplicate sign-ups.",
                ]}
              />
              <p>
                Your dog’s concerns help us design better products. They are not used to give
                medical advice; for health issues, please speak to your vet.
              </p>
            </Section>

            <Section title="Who we share it with">
              <p>
                Your data is used only by Everloyal. We share it only with the trusted service
                providers who run this website for us (our database, server and hosting providers),
                and only so they can provide that service. They may store data outside India, under
                appropriate safeguards. We may also disclose data where the law requires it.
              </p>
            </Section>

            <Section title="How we keep it safe">
              <p>
                Your details travel over an encrypted connection and are stored in a database that
                is closed to the public. Only a small number of authorised people at Everloyal can
                access them.
              </p>
            </Section>

            <Section title="How long we keep it">
              <p>
                We keep your details while the waitlist and our launch offers are running, and for
                as long as you stay in touch with us. You can ask us to delete them at any time.
              </p>
            </Section>

            <Section title="Your choices and rights">
              <List
                items={[
                  "Ask for a copy of your data, or for it to be corrected or deleted.",
                  "Stop marketing messages at any time: reply STOP on WhatsApp or SMS, or email us.",
                  "Withdraw your consent, or raise a concern, by writing to us.",
                ]}
              />
              <p>
                We handle your data in line with India’s Digital Personal Data Protection Act, 2023,
                and will respond to your request within a reasonable time.
              </p>
            </Section>

            <Section title="Children">
              <p>
                The waitlist is meant for adults aged 18 and over. We don’t knowingly collect data
                from children.
              </p>
            </Section>

            <Section title="Changes to this policy">
              <p>
                If we change this policy, we’ll update it on this page with a new “Last updated”
                date.
              </p>
            </Section>

            <Section title="Contact us">
              <p>
                For any privacy question or request, email us at{" "}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-bold text-el-blue underline underline-offset-[3px] hover:text-el-blue-deep"
                >
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </Section>
          </div>
        </article>

        <p className="mt-8 text-center">
          <Link
            to="/"
            className={`${homeLink} border border-el-cream/40 text-el-cream hover:bg-el-cream/10`}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
