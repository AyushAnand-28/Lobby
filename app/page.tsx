import Image from "next/image";
import Link from "next/link";

import { Wordmark } from "@/components/brand";
import { Counter } from "@/components/motion/counter";
import { GiantWordmark } from "@/components/motion/giant-wordmark";
import { HeroMedia } from "@/components/motion/hero-media";
import { Parallax } from "@/components/motion/parallax";
import { PinnedStack, StackCard } from "@/components/motion/pinned-stack";
import { Reveal } from "@/components/motion/reveal";
import { RevealText } from "@/components/motion/reveal-text";
import { ArrowLink, RollLink } from "@/components/motion/roll-link";
import { getCurrentUser } from "@/lib/auth/session";
import {
  SPORT_CATALOGUE,
  featuredSports,
  liveSports,
  unfeaturedSports,
  type CatalogueSport,
} from "@/sports/catalogue";

/**
 * The page is a stack of full-bleed black bands, each announced by a small
 * dotted label, with one piece of oversized display type carrying the hero and
 * a single inverted white band closing it out.
 */
export default async function LandingPage() {
  const user = await getCurrentUser();
  const featured = featuredSports();
  const alsoCovered = unfeaturedSports();
  const live = liveSports();

  return (
    <>
      <SiteHeader signedIn={Boolean(user)} />

      <main className="flex-1">
        {/* ---- Hero ---------------------------------------------------- */}
        <section className="relative isolate flex min-h-svh flex-col justify-between gutter py-[var(--y-default)]">
          <HeroMedia
            image="/images/hero-night.jpg"
            video="/video/hero-loop.mp4"
          />

          {/* One heading for the accessibility tree; the display lines below
              are decorative duplicates so each can carry its own alignment. */}
          <h1 className="sr-only">
            Lobby turns scores into standings — tournament software for local
            and college organizers.
          </h1>

          <div aria-hidden className="mt-auto">
            <RevealText
              split="lines"
              trigger={false}
              className="display-xl block text-left"
            >
              SCORES
            </RevealText>
            <RevealText
              split="lines"
              trigger={false}
              delay={0.1}
              className="display-xl block text-center"
            >
              INTO
            </RevealText>
            <RevealText
              split="lines"
              trigger={false}
              delay={0.2}
              className="display-xl block text-right"
            >
              STANDINGS
            </RevealText>
          </div>

          <Reveal
            y={20}
            delay={0.9}
            trigger={false}
            className="mt-auto max-w-sm pt-[var(--y-half-default)] text-base leading-snug font-light text-foreground/70"
          >
            <p>
              Tournament software for local and college sport. Register teams,
              draw the fixtures, and enter scores at the venue. Everyone else
              just opens a link.
            </p>
          </Reveal>
        </section>

        {/* ---- Formats ------------------------------------------------- */}
        <section className="band">
          <p className="eyebrow justify-center w-full text-center">Built for</p>

          <Reveal
            stagger
            y={24}
            className="mt-[var(--y-default)] flex flex-wrap items-center justify-between gap-x-10 gap-y-8"
          >
            {[
              "Knockout",
              "Round robin",
              "Groups → Knockout",
              "Seeded draws",
              "League tables",
            ].map((format) => (
              <span
                key={format}
                className="text-lg font-light text-foreground/45 uppercase"
              >
                {format}
              </span>
            ))}
          </Reveal>
        </section>

        {/* ---- Sports -------------------------------------------------- */}
        <section id="sports" className="band">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <p className="eyebrow">Sports</p>
            <p className="max-w-md text-base leading-relaxed font-light text-foreground/55">
              One tournament engine underneath, each sport&rsquo;s own scoring
              on top. {live.map((sport) => sport.name).join(", ")} is live
              today; the rest land one at a time.
            </p>
          </div>

          <RevealText
            as="h2"
            split="lines"
            className="display-lg mt-[var(--y-default)] max-w-3xl"
          >
            Whatever your club actually plays.
          </RevealText>

          <Reveal
            stagger
            className="mt-[var(--y-default)] grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-3"
          >
            {featured.map((sport) => (
              <SportTile key={sport.slug} sport={sport} />
            ))}
          </Reveal>

          {/* The long tail. Named rather than pictured — the grid above
              already carries the point, and twelve photographs would say
              nothing extra for a megabyte apiece. */}
          <Reveal
            y={20}
            className="mt-[var(--y-default)] flex flex-wrap items-baseline gap-x-8 gap-y-3 border-t border-border pt-8"
          >
            <span className="text-sm uppercase text-foreground/40">
              Also on the roadmap
            </span>
            {alsoCovered.map((sport) => (
              <span
                key={sport.slug}
                className="text-lg font-light text-foreground/60"
              >
                {sport.name}
              </span>
            ))}
          </Reveal>
        </section>

        {/* ---- Who it is for ------------------------------------------- */}
        <section className="band">
          <p className="eyebrow">Who it is for</p>

          <div className="mt-[var(--y-default)] grid gap-[var(--y-default)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <RevealText as="h2" split="lines" className="display-lg max-w-md">
              Three people. Three doors. One account between them.
            </RevealText>

            <Reveal stagger className="grid gap-px bg-border sm:grid-cols-3">
              <Door
                title="Organizers"
                access="Signs in"
                body="One account. Create the tournament, approve teams, run the draw, keep scores current."
              />
              <Door
                title="Captains"
                access="Link only"
                body="A registration link lands in the group chat. Fill in the team, done. No signup."
              />
              <Door
                title="Players & fans"
                access="No sign-in"
                body="One public page with fixtures, results and the table. Updates as scores land."
              />
            </Reveal>
          </div>
        </section>

        {/* ---- Key figures --------------------------------------------- */}
        <section className="band">
          <p className="eyebrow">Key figures</p>

          <Reveal
            stagger
            className="mt-[var(--y-default)] grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4"
          >
            <Figure
              n="1"
              value={SPORT_CATALOGUE.length}
              label="Sports on the roadmap"
            />
            <Figure n="2" value={3} label="Draw formats" />
            <Figure n="3" value={1} label="Link to share" />
            <Figure n="4" value={0} label="Accounts for players" />
          </Reveal>
        </section>

        {/* ---- How a weekend runs -------------------------------------- */}
        <section className="band">
          <p className="eyebrow">How a weekend runs</p>

          <PinnedStack className="mt-[var(--y-default)] grid gap-[var(--y-default)]">
            <Step
              n="1"
              title="SET IT UP"
              headline="Name it, date it, size it."
              body="Venue, format and how many teams you can take. Two minutes, and the registration link exists."
              detail={["Name & dates", "Venue", "Format", "Team cap"]}
              image="/images/step-setup.jpg"
            />
            <Step
              n="2"
              title="SHARE THE FORM"
              headline="One link does the admin."
              body="Send it once. Captains submit their squad, you approve or reject. Nobody creates an account to enter."
              detail={[
                "Public link",
                "Squad details",
                "Approve / reject",
                "No player signup",
              ]}
              image="/images/step-share.jpg"
            />
            <Step
              n="3"
              title="DRAW THE FIXTURES"
              headline="The bracket builds itself."
              body="Knockout, round robin, or groups feeding a knockout. Seeded or random, generated from whoever you approved."
              detail={["Knockout", "Round robin", "Groups", "Seeding"]}
              image="/images/step-draw.jpg"
            />
            <Step
              n="4"
              title="SCORE AT THE VENUE"
              headline="Between matches, on your phone."
              body="Tap in the result and the public page has it. Standings, qualification and the next round recalculate as you go."
              detail={[
                "Phone-first",
                "Live standings",
                "Auto-advance",
                "Shareable",
              ]}
              image="/images/step-score.jpg"
            />
          </PinnedStack>
        </section>

        {/* ---- Why -------------------------------------------------------- */}
        <section className="band">
          <p className="eyebrow">Why Lobby</p>

          {/* Text left, image right — the reference's story layout. The copy
              column is top-aligned against the image so the section reads as
              two columns rather than two unrelated blocks. */}
          <div className="mt-[var(--y-default)] grid items-start gap-[var(--y-default)] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
            <div className="flex flex-col gap-[var(--y-half-default)]">
              <RevealText as="h2" split="lines" className="display-lg">
                Every local tournament runs on a spreadsheet and one exhausted
                volunteer.
              </RevealText>

              <Reveal
                y={30}
                className="flex max-w-md flex-col gap-6 text-base leading-relaxed font-light text-foreground/70"
              >
                <p>
                  Lobby is built for the person at the scorer&rsquo;s table, not
                  for a federation. Every sport brings its own scoring — sets
                  and games, runs and wickets, raid points — so you enter a
                  result rather than work one out.
                </p>
                <p>
                  The draw, the registration link and the public page behave the
                  same whatever is being played. The organizer signs in; nobody
                  else has to.
                </p>
                <ArrowLink href="/signup" className="mt-2">
                  Start a tournament
                </ArrowLink>
              </Reveal>
            </div>

            {/* Travels against the scroll — the reference's parallax range
                starts a full viewport early so it never appears to snap. */}
            {/* Literally the thing the headline is about: a laptop running the
                scoring spreadsheet at a real event. Landscape, so the frame is
                4:3 rather than the 3:4 the old portrait shot needed. */}
            <Parallax strength={12} className="aspect-[4/3] w-full">
              <Image
                src="/images/why-spreadsheet.jpg"
                alt="A monitor at a sports venue showing results typed into a spreadsheet"
                width={1600}
                height={1067}
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="size-full object-cover"
              />
            </Parallax>
          </div>
        </section>

        {/* ---- Closing statement --------------------------------------- */}
        <section className="flex min-h-[60svh] flex-col items-center justify-center gutter py-[var(--y-default)] text-center">
          <RevealText as="h2" split="chars" className="display-xl">
            START THE DRAW.
          </RevealText>

          <Reveal y={20} className="mt-[var(--y-default)]">
            <Link
              href="/signup"
              className="outline-ring/50 inline-block bg-paper px-10 py-5 text-base font-medium text-ink uppercase transition-opacity duration-[400ms] hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              Create your account
            </Link>
          </Reveal>

          <p className="mt-6 text-sm font-light text-foreground/45">
            Free while in early access. No card, nothing to install.
          </p>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/* ---------------------------------------------------------------------- */

function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 gutter py-[var(--y-half-default)] mix-blend-difference">
      <div className="flex items-center justify-between text-base">
        <Wordmark />

        <nav className="hidden items-center gap-10 uppercase sm:flex">
          <RollLink href="/#sports">Sports</RollLink>
          <RollLink href="/#about">About</RollLink>
          {signedIn ? (
            <RollLink href="/dashboard">Dashboard</RollLink>
          ) : (
            <RollLink href="/login">Log in</RollLink>
          )}
        </nav>

        <RollLink href={signedIn ? "/dashboard" : "/signup"} className="uppercase">
          {signedIn ? "Dashboard" : "Get started"}
        </RollLink>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    /* The single inverted band. Everything above it is black. */
    <footer className="bg-paper text-ink">
      <div className="gutter pt-[var(--y-default)]">
        <Wordmark href={null} />

        <div className="mt-[var(--y-default)] grid gap-10 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <FooterColumn
            title="Product"
            links={[
              ["Log in", "/login"],
              ["Create an account", "/signup"],
            ]}
          />
          <FooterColumn
            title="Sports"
            links={SPORT_CATALOGUE.slice(0, 5).map(
              (sport) => [sport.name, "/#sports"] as [string, string],
            )}
          />
          <FooterColumn title="Legal" links={[["Terms", "/terms"]]} />
          <div>
            <p className="font-medium uppercase">Contact</p>
            <p className="mt-4 text-ink/55">
              Built for organizers who would rather be watching the game.
            </p>
          </div>
        </div>

        <div className="mt-[var(--y-default)] pb-[var(--y-half-default)]">
          <GiantWordmark word="LOBBY" image="/images/wordmark-track.jpg" />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: [label: string, href: string][];
}) {
  return (
    <div>
      <p className="font-medium uppercase">{title}</p>
      <ul className="mt-4 grid gap-2">
        {/* Keyed by label: several sports deliberately share one href. */}
        {links.map(([label, href]) => (
          <li key={label}>
            <Link
              href={href}
              className="text-ink/55 underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SportTile({ sport }: { sport: CatalogueSport }) {
  const isLive = sport.status === "live";

  return (
    <article className="group relative isolate flex min-h-[22rem] flex-col justify-between overflow-clip bg-background p-6">
      {sport.image ? (
        <>
          <Image
            src={sport.image}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="-z-10 object-cover opacity-65 transition duration-[800ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:opacity-90"
          />
          {/* Held down hard: the tile is type first, photograph second. */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/70 to-background/30" />
        </>
      ) : null}

      <span
        className={
          isLive
            ? "self-start bg-paper px-2.5 py-1 text-xs font-medium text-ink uppercase"
            : "self-start border border-border px-2.5 py-1 text-xs font-light text-foreground/60 uppercase"
        }
      >
        {isLive ? "Live" : "Coming soon"}
      </span>

      <div>
        <h3 className="text-3xl leading-none font-semibold uppercase">
          {sport.name}
        </h3>
        <p className="mt-3 text-sm leading-relaxed font-light text-foreground/65">
          {sport.scoring}
        </p>
      </div>
    </article>
  );
}

function Door({
  title,
  access,
  body,
}: {
  title: string;
  access: string;
  body: string;
}) {
  return (
    <div className="flex min-h-56 flex-col justify-between gap-8 bg-background p-7">
      <span className="self-start border border-border px-2.5 py-1 text-xs font-light uppercase text-foreground/55">
        {access}
      </span>
      <div>
        <h3 className="text-xl font-medium">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed font-light text-foreground/60">
          {body}
        </p>
      </div>
    </div>
  );
}

function Figure({
  n,
  value,
  label,
}: {
  n: string;
  value: number;
  label: string;
}) {
  return (
    <div className="flex min-h-52 flex-col justify-between bg-background p-7">
      <span className="text-sm font-light text-foreground/40">{n}.</span>
      <div className="mt-10 text-right">
        {/* Sits at the reference's stat weight: huge, dimmed, right-aligned. */}
        <Counter
          value={value}
          className="block text-[clamp(3.5rem,7vw,7rem)] leading-none font-semibold text-foreground/35"
        />
        <p className="mt-4 text-sm font-light text-foreground/60">{label}</p>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  headline,
  body,
  detail,
  image,
}: {
  n: string;
  title: string;
  headline: string;
  body: string;
  detail: string[];
  image: string;
}) {
  return (
    <StackCard className="grid gap-8 p-[var(--x-double-default)] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,0.8fr)]">
      {/*
        Image panel with the step number and title sitting on it — the
        reference's service-card treatment. The gradient is what keeps the
        title legible regardless of what the photograph is doing behind it.
      */}
      <div className="relative isolate flex min-h-64 flex-col justify-between overflow-clip p-6">
        <Image
          src={image}
          alt=""
          fill
          sizes="(min-width: 1024px) 30vw, 100vw"
          className="-z-10 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-background/45 to-background/25" />

        <span className="text-2xl font-medium">{n}.</span>
        <h3 className="text-3xl leading-none font-semibold uppercase">
          {title}
        </h3>
      </div>

      <div className="flex flex-col justify-between gap-8">
        <div>
          <p className="text-3xl leading-tight font-medium">{headline}</p>
          <p className="mt-6 max-w-lg text-base leading-relaxed font-light text-foreground/60">
            {body}
          </p>
        </div>
        <ArrowLink href="/signup">Start a tournament</ArrowLink>
      </div>

      <div>
        <p className="text-xs font-light uppercase text-foreground/45">
          Includes :
        </p>
        <ul className="mt-4 grid gap-1.5 text-base font-light text-foreground/80">
          {detail.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </StackCard>
  );
}
