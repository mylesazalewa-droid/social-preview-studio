// Platform definitions. Each entry describes one preview card.
// kind: how the card chrome is drawn
//   'feed'      -> profile row + media + actions + caption below
//   'fullbleed' -> 9:16 media fills card, UI overlaid (stories / reels / tiktok / shorts)
//   'thumbnail' -> media + title row below (YouTube thumbnail)
// caption rules:
//   truncateAt   -> chars shown before the "more" link
//   moreLabel    -> text of the truncation link
//   hardLimit    -> platform hard character cap (counter turns red past it)
//   recommended  -> soft guidance cap (counter turns amber past it)
//   isTitle      -> treat the caption as a headline/title
//   overlay      -> caption shown over the media instead of below
//   captionDesktop -> caption rules to use when the Desktop / web view is selected
//                     (web columns are wider and show more caption than the phone app)
//   specW / specH  -> production pixel size per ratio, used by the "Ready pack" export

window.PLATFORMS = [
  {
    id: 'ig-feed',
    icon: 'brInstagram', short: 'Instagram',
    name: 'Instagram',
    placement: 'Feed',
    accent: '#E1306C',
    kind: 'feed',
    ratios: ['1:1', '4:5'],
    defaultRatio: '1:1',
    slides: 'swipe',
    maxSlides: 10,
    caption: { truncateAt: 125, moreLabel: 'more', hardLimit: 2200 },
    captionDesktop: { truncateAt: 340, moreLabel: 'more', hardLimit: 2200 },
    spec: { '1:1': [1080, 1080], '4:5': [1080, 1350] },
  },
  {
    id: 'ig-story',
    icon: 'brStory', short: 'Story',
    name: 'Instagram',
    placement: 'Story',
    accent: '#E1306C',
    kind: 'fullbleed',
    ratios: ['9:16'],
    defaultRatio: '9:16',
    slides: 'single',
    caption: { overlay: true, truncateAt: 0 },
    spec: { '9:16': [1080, 1920] },
  },
  {
    id: 'ig-reel',
    icon: 'brReel', short: 'Reel',
    name: 'Instagram',
    placement: 'Reel',
    accent: '#E1306C',
    kind: 'fullbleed',
    ratios: ['9:16'],
    defaultRatio: '9:16',
    slides: 'single',
    caption: { overlay: true, truncateAt: 70, moreLabel: 'more' },
    captionDesktop: { overlay: true, truncateAt: 200, moreLabel: 'more' },
    spec: { '9:16': [1080, 1920] },
  },
  {
    id: 'tiktok',
    icon: 'brTiktok', short: 'TikTok',
    name: 'TikTok',
    placement: 'Photo / For You',
    accent: '#25F4EE',
    kind: 'fullbleed',
    ratios: ['9:16'],
    defaultRatio: '9:16',
    slides: 'swipe',
    maxSlides: 35,
    caption: { overlay: true, truncateAt: 80, moreLabel: 'more', hardLimit: 2200 },
    captionDesktop: { overlay: true, truncateAt: 150, moreLabel: 'more', hardLimit: 2200 },
    spec: { '9:16': [1080, 1920] },
  },
  {
    id: 'yt-shorts',
    icon: 'brShorts', short: 'Shorts',
    name: 'YouTube',
    placement: 'Shorts',
    accent: '#FF0000',
    kind: 'fullbleed',
    ratios: ['9:16'],
    defaultRatio: '9:16',
    slides: 'single',
    caption: { overlay: true, truncateAt: 100, moreLabel: '...more', hardLimit: 100, isTitle: true },
    spec: { '9:16': [1080, 1920] },
  },
  {
    id: 'yt-thumb',
    icon: 'brYoutube', short: 'Thumbnail',
    name: 'YouTube',
    placement: 'Thumbnail',
    accent: '#FF0000',
    kind: 'thumbnail',
    ratios: ['16:9'],
    defaultRatio: '16:9',
    slides: 'single',
    caption: { isTitle: true, recommended: 60, hardLimit: 100 },
    captionDesktop: { isTitle: true, recommended: 70, hardLimit: 100 },
    spec: { '16:9': [1280, 720] },
  },
  {
    id: 'x',
    icon: 'brX', short: 'X',
    name: 'X',
    placement: 'Timeline',
    accent: '#1D9BF0',
    kind: 'feed',
    ratios: ['16:9', '1:1'],
    defaultRatio: '16:9',
    slides: 'mosaic',
    maxSlides: 4,
    caption: { hardLimit: 280 },
    spec: { '16:9': [1600, 900], '1:1': [1080, 1080] },
  },
  {
    id: 'fb-feed',
    icon: 'brFacebook', short: 'Facebook',
    name: 'Facebook',
    placement: 'Feed',
    accent: '#1877F2',
    kind: 'feed',
    ratios: ['1.91:1', '1:1', '4:5'],
    defaultRatio: '1.91:1',
    slides: 'collage',
    maxSlides: 10,
    caption: { truncateAt: 250, moreLabel: 'See more' },
    captionDesktop: { truncateAt: 480, moreLabel: 'See more' },
    spec: { '1.91:1': [1200, 630], '1:1': [1080, 1080], '4:5': [1080, 1350] },
  },
  {
    id: 'li-feed',
    icon: 'brLinkedin', short: 'LinkedIn',
    name: 'LinkedIn',
    placement: 'Feed',
    accent: '#0A66C2',
    kind: 'feed',
    ratios: ['1.91:1', '1:1'],
    defaultRatio: '1.91:1',
    slides: 'swipe',
    maxSlides: 20,
    caption: { truncateAt: 140, moreLabel: '…see more' },
    captionDesktop: { truncateAt: 215, moreLabel: '…see more' },
    spec: { '1.91:1': [1200, 627], '1:1': [1080, 1080] },
  },
];

window.RATIO_VALUE = {
  '1:1': 1,
  '4:5': 4 / 5,
  '9:16': 9 / 16,
  '16:9': 16 / 9,
  '1.91:1': 1.91,
};
