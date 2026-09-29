# Media credits

Every file here is a placeholder standing in for photography of your own events.
Swap the files, keep the names, and nothing else has to change.

## Photographs — Unsplash

All under the [Unsplash License](https://unsplash.com/license): free to use
commercially, no permission or attribution required. Credited anyway.

Source URL pattern: `https://images.unsplash.com/<photo-id>`

### Sport tiles

| File | Photo id | Subject |
| --- | --- | --- |
| `sport-badminton.jpg` | `photo-1626224583764-f87db24ac4ea` | Player jumping, indoor court |
| `sport-cricket.jpg` | `photo-1745180267045-d160b19bb86d` | Club match on a green field |
| `sport-football.jpg` | `flagged/photo-1550413231-202a9d53a331` | Night match under one floodlight |
| `sport-basketball.jpg` | `photo-1762025772651-ac4520ba44f2` | Community hall mid-game |
| `sport-volleyball.jpg` | `photo-1786025123903-0556971bd7f4` | Club match, scoreboard in frame |
| `sport-tabletennis.jpg` | `photo-1511067007398-7e4b90cfa4bc` | Tables in a dark venue |

### Everything else

Deliberately spread across sports and situations rather than illustrating one
game — the four steps run gym, football, basketball, standings.

| File | Photo id | Subject | Used for |
| --- | --- | --- | --- |
| `step-setup.jpg` | `photo-1663576748730-3d420fb1d9ac` | Basketball gym, one player | 1. Set it up |
| `step-share.jpg` | `photo-1785216130375-48966f2d7912` | Youth football squad huddle | 2. Share the form |
| `step-draw.jpg` | `photo-1759694384846-fe2e5c46e76e` | Basketball team huddle | 3. Draw the fixtures |
| `step-score.jpg` | `photo-1533237264985-ee62f6d342bb` | Illuminated ranked leaderboard | 4. Score at the venue |
| `why-spreadsheet.jpg` | `photo-1741478551723-4b7ce95cf395` | Monitor running a results spreadsheet at a venue | Story section — the literal subject of the headline |
| `wordmark-track.jpg` | `photo-1549896869-ca27eeffe4fb` | Running-track lane markings | Fill clipped into the footer wordmark |
| `hero-night.jpg` | — | Frame 1 of `hero-loop.mp4` | Hero poster |
| `auth-login.jpg` | `photo-1608245449230-4ac19066d2d0` | Basketball dunk in a darkened gym | Log in side panel |
| `auth-signup.jpg` | `photo-1758119354167-305914252bcb` | Volleyball spike under floodlights at night | Sign up side panel |

Log in and sign up carry different photographs on purpose — sharing one made
the two screens feel like the same page with the heading swapped. Both are
portrait crops, because that panel is a tall half-column on desktop and a
shallow banner on mobile.

`hero-night.jpg` is not a separate photograph. It is extracted from the hero
clip with ffmpeg so the poster and the first video frame are identical — a
mismatched poster visibly pops the moment the clip starts playing.

### Tournament screens

Badminton-specific, for the organizer's tournament pages, the captain's
registration page and the public tournament page. Darker frames were picked
on purpose: every one of these sits under text on a black ground.

| File | Photo id | Photographer | Subject | Used for |
| --- | --- | --- | --- | --- |
| `tournament-banner.jpg` | `photo-1626721105368-a69248e93b32` | Stephan Rothe | Shuttlecock on the net, dark hall | Organizer tournament banner; a dashboard card |
| `register-panel.jpg` | `photo-1722087642932-9b070e9a066e` | Irish83 | Jump smash in a dark gym (portrait) | Captain registration side panel |
| `dashboard-hall.jpg` | `photo-1599391398131-cd12dfc6c24e` | Muktasim Azlan | Player mid-rally under hall lights | Dashboard greeting |
| `podium-trophies.jpg` | `photo-1770482228588-270b08d2d376` | breizhography | Lit wall of trophies | Podium, everywhere it appears |
| `empty-shuttle.jpg` | `photo-1696250530563-70f39e532e10` | Sleeba Thomas | Shuttlecock in flight on dark green | Dashboard before the first tournament |
| `card-court.jpg` | `photo-1775993167393-f2add1f8eec2` | Palak Pitroda | Empty indoor courts, blue floor | Dashboard card |
| `card-shuttle.jpg` | `photo-1765544581327-b5e9055d986c` | Ogie | Shuttlecock on a green court | Dashboard card |
| `tournament-hero.jpg` | - | - | Frame 1 of `tournament-loop.mp4` | Public page hero poster |

Dashboard cards pick one of the three card images from the tournament's id
(`lib/tournament/art.ts`), so a list of tournaments is not one photograph
repeated.

## Video — Pexels

`../video/hero-loop.mp4` — Pexels video `32578918`, "Children practicing soccer
on artificial turf at night". [Pexels License](https://www.pexels.com/license/):
free to use, no attribution required, may not be resold as stock.

Source: https://www.pexels.com/video/children-practicing-soccer-on-artificial-turf-at-night-32578918/

The original is 3840×2160, 21.6s, 114 MB. It is re-encoded locally to 1920×1080,
11s, CRF 30, no audio, `+faststart` — **2.0 MB**. Regenerate with:

```
ffmpeg -ss 10 -t 11 -i <source>.mp4 \
  -vf "scale=1920:1080:flags=lanczos" -c:v libx264 -preset slow -crf 30 \
  -pix_fmt yuv420p -movflags +faststart -an hero-loop.mp4
```

The clip is still gated off on narrow viewports, `prefers-reduced-motion` and
`Save-Data` — see `components/motion/hero-media.tsx`.

`../video/tournament-loop.mp4` — Pexels video `35087074`, "Dynamic Indoor
Badminton Match with Youths" by Sarthak Raj: three young players on a
community court, which is who Lobby is for.
Source: https://www.pexels.com/video/dynamic-indoor-badminton-match-with-youths-35087074/

The original is 3840×2160, 22s, 95 MB. Cut to 10s from 0:08, re-encoded to
1920×1080 with a mild grade (saturation 0.8, contrast 1.06, brightness −0.03)
so it sits under the dark scrim, CRF 30, no audio, `+faststart` — **1.4 MB**:

```
ffmpeg -ss 8 -t 10 -i <source>.mp4   -vf "scale=1920:1080:flags=lanczos,eq=saturation=0.8:contrast=1.06:brightness=-0.03"   -c:v libx264 -preset slow -crf 30 -pix_fmt yuv420p -movflags +faststart -an tournament-loop.mp4
ffmpeg -i tournament-loop.mp4 -frames:v 1 -q:v 4 ../images/tournament-hero.jpg
```

Played through the same `HeroMedia` component as the landing clip, so the same
gating applies: wide viewports only, never under reduced motion or Save-Data.
