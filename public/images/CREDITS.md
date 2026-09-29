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
