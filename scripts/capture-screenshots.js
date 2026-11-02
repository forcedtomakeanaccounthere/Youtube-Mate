// Captures README screenshots of the frontend with Playwright and a mocked backend.
// Usage: (cd frontend && npm run build && npm start) then: OUT=docs/screenshots-raw node scripts/capture-screenshots.js [name-filter...]
// Mock user/playlists/links are fictional demo data; thumbs/ holds generated placeholder thumbnails.
// Playwright capture of YouTube Mate UI with mocked backend.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const OUT = process.env.OUT || path.join(__dirname, 'shots');
const THUMBS = path.join(__dirname, 'thumbs');
fs.mkdirSync(OUT, { recursive: true });
const only = process.argv.slice(2);

const thumb = (k) => `https://i.ytimg.com/vi/${k}/hqdefault.jpg`;
const user = {
  _id: 'u1', id: 'u1', name: 'Abhishek Anand', email: 'demo@ytmate.co', isVerified: true, emailVerified: true,
  avatar: '', subscription: { plan: 'pro', status: 'active' }, plan: 'pro',
};
const now = new Date('2026-10-28T10:00:00Z').toISOString();

const urls = [
  ['node', 'Building Node.js Authentication from Scratch', 'Piyush Garg', 'node-auth', '0:45:00', 128],
  ['react', 'React Hooks Explained in 20 Minutes', 'Codevolution', 'react-hooks', '0:03:15', 342],
  ['dsa', 'Sort Characters By Frequency | Hash Table | Bucket Sort', 'Aryan Mittal', 'dsa-sort', null, 57],
].map(([k, title, ch, alias, ts, clicks], i) => ({
  _id: 'url' + i, originalUrl: `https://www.youtube.com/watch?v=${k}`, shortUrl: `https://ytmate.co/${alias}`, shortCode: alias,
  customAlias: alias, timestampFormatted: ts, analyticsEnabled: true, clicks, createdAt: now,
  videoData: { videoId: k, title, thumbnailUrl: thumb(k), duration: '39:09', durationSeconds: 2349, channel: ch, views: 397805 },
}));

const playlists = [
  ['seaborn', 'Seaborn Masterclass', 'Imported from YouTube — every plot type explained.', 10, true, false, ['python', 'data-viz']],
  ['os', 'Operating System Lectures', 'Lectures loosely based on Operating System Concepts by Silberschatz.', 13, true, true, ['os', 'cse']],
  ['music', 'My Favorite Music Videos', 'A collection of all-time favourite music videos.', 5, true, false, ['music', 'favorites']],
  ['ml', 'Machine Learning Roadmap', 'Curated ML course — maths to deployment, shared with study group.', 24, false, true, ['ml', 'ai']],
  ['lofi', 'Lo-fi Study Beats', 'Background focus music for long coding sessions.', 18, true, true, ['lofi', 'focus']],
  ['travel', 'Japan Travel Vlogs', 'Inspiration for the next trip.', 9, false, false, ['travel']],
].map(([k, title, description, videoCount, isPublic, isCollaborative, tags], i) => ({
  id: 'pl' + i, _id: 'pl' + i, title, description, thumbnail: thumb(k), videoCount, isPublic, isCollaborative,
  owner: { name: i % 3 === 2 ? 'Test User' : 'Abhishek Anand', avatar: '' }, collaborators: isCollaborative ? 3 : 0,
  views: [95081, 525473, 1250, 8812, 40210, 640][i], createdAt: now, lastModified: now, tags, category: 'education', status: 'published', isFavorite: i === 1,
}));

function mock(url, method) {
  const u = new URL(url);
  const p = u.pathname.replace(/^\/api/, '');
  if (p.startsWith('/auth/me') || p.startsWith('/auth/profile')) return { success: true, user, data: { user } };
  if (p.startsWith('/urls/my-urls')) return { success: true, data: { urls, total: urls.length } };
  if (p.match(/^\/playlists\/?$/) || p.startsWith('/playlists/my') || p.startsWith('/playlists/shared') || p.startsWith('/playlists/favorites'))
    return { success: true, playlists, data: { playlists }, pagination: { current: 1, total: 1, count: playlists.length, limit: 12 } };
  if (p.startsWith('/stripe') || p.startsWith('/subscription')) return { success: true, plan: 'pro', subscription: { plan: 'pro', status: 'active' } };
  if (p.startsWith('/video-qa/usage') || p.includes('usage') || p.includes('quota'))
    return { success: true, data: { premium: { used: 0, limit: 2 }, standard: { used: 1, limit: 3 }, images: { used: 0, limit: 2 } } };
  const pid = p.match(/^\/playlists\/(pl\d)$/) || p.match(/^\/api\/playlists\/(pl\d)$/);
  if (pid) return playlistDetail;
  if (p.startsWith('/downloads/playlist/info')) return {
    title: 'Data Visualization using Seaborn', channel: 'CampusX',
    videos: ['Introduction to Seaborn','Scatter Plots','Boxplot','Violinplots','Barplots and Countplots','Heatmaps','Clustermaps','Pairplots'].map((t, i) => ({ id: 'seaborn' + i, title: 'Data Visualization using Seaborn | ' + t, thumbnail: thumb('seaborn'), duration: ['12:04','08:31','06:40','05:06','06:14','05:58','04:41','07:22'][i], channel: 'CampusX' })),
  };
  if (p.startsWith('/downloads/history')) return { success: true, data: { downloads: [
    { _id: 'd1', title: 'Data Visualization using Seaborn | Boxplot', thumbnail: thumb('seaborn'), format: 'video', quality: '1080p', status: 'completed', createdAt: now, fileSize: 52428800, progress: 100 },
    { _id: 'd2', title: 'React Hooks Explained in 20 Minutes', thumbnail: thumb('react'), format: 'video', quality: '720p', status: 'completed', createdAt: now, fileSize: 31457280, progress: 100 },
  ] }, downloads: [] };
  return { success: true, data: {} };
}

const vids = [['os','Introduction to Operating Systems','Neso Academy','12:34'],['os','Process Management & Scheduling','Neso Academy','18:02'],['os','Threads and Concurrency','Neso Academy','15:47'],['os','CPU Scheduling Algorithms','Gate Smashers','22:10'],['os','Deadlocks — Detection & Avoidance','Gate Smashers','19:31'],['os','Memory Management & Paging','Neso Academy','24:05']];
const playlistDetail = {
  id: 'pl1', title: 'Operating System Lectures', description: 'Lectures loosely based on Operating System Concepts by Silberschatz, Galvin and Gagne.',
  thumbnail: thumb('os'), isPublic: true, isCollaborative: true, owner: { name: 'Abhishek Anand', avatar: '' },
  videos: vids.map(([k, title, channel, duration], i) => ({ id: 'v' + i, title, channel, duration, thumbnail: thumb(k), addedBy: i % 2 ? 'Riya Sharma' : 'Abhishek Anand', addedAt: now, views: 120000 + i * 9137, likes: 3200 + i * 41, description: '', youtubeUrl: 'https://youtube.com/watch?v=' + i, position: i })),
  collaborators: [
    { id: 'u1', name: 'Abhishek Anand', avatar: '', role: 'owner', joinedAt: now, lastActive: now },
    { id: 'u2', name: 'Riya Sharma', avatar: '', role: 'editor', joinedAt: now, lastActive: now },
    { id: 'u3', name: 'Karan Mehta', avatar: '', role: 'viewer', joinedAt: now, lastActive: now },
  ],
  comments: [{ id: 'c1', user: { id: 'u2', name: 'Riya Sharma', avatar: '' }, content: 'Added the scheduling lectures — perfect for the mid-sem!', timestamp: now, replies: [] }],
  activities: [{ id: 'a1', user: 'Riya Sharma', action: 'added_video', details: { title: 'CPU Scheduling Algorithms' }, timestamp: now }],
  stats: { totalViews: 525473, totalDuration: '1h 51m', createdAt: now, lastModified: now },
  tags: ['os', 'operating systems', 'cse fundamentals'], category: 'education', userRole: 'owner', isFavorite: true,
};

async function setupPage(page, { auth = true, dark = false } = {}) {
  await page.addInitScript(([u, auth, dark]) => {
    try {
      if (auth) { localStorage.setItem('token', 'demo-token'); localStorage.setItem('user', JSON.stringify(u)); }
      localStorage.setItem('darkMode', dark ? 'true' : 'false');
      localStorage.setItem('stream-display-name', 'Abhishek');
    } catch (e) {}
  }, [user, auth, dark]);
  await page.route(/localhost:5000|onrender\.com/, async (route) => {
    const req = route.request();
    const body = mock(req.url(), req.method());
    if (process.env.LOG) console.log('API', req.method(), req.url());
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const serveThumb = async (route) => {
    const m = decodeURIComponent(route.request().url()).match(/vi\/([a-z]+)\//);
    const f = path.join(THUMBS, (m && m[1]) + '.jpg');
    if (fs.existsSync(f)) return route.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(f) });
    return route.fulfill({ status: 200, contentType: 'image/jpeg', body: fs.readFileSync(path.join(THUMBS, 'react.jpg')) });
  };
  await page.route(/i\.ytimg\.com|img\.youtube\.com/, serveThumb);
  await page.route(/_next\/image\?url=https?%3A%2F%2Fi\.ytimg/, serveThumb);
  // Block third-party scripts that can't load in the sandbox (recaptcha, stripe, youtube iframe api)
  await page.route(/google\.com\/recaptcha|gstatic|js\.stripe\.com|youtube\.com\/iframe_api|googleapis/, (r) => r.fulfill({ status: 200, body: '' }));
}

const shots = [
  // name, path, opts
  { name: '01-landing-hero', path: '/', auth: false, wait: 2500 },
  { name: '02-landing-features', path: '/', auth: true, scrollText: 'Powerful Features', wait: 2000, action: async (p) => { await p.mouse.wheel(0, 520); await p.waitForTimeout(1500); } },
  { name: '03-landing-faq', path: '/', auth: false, scrollText: 'Frequently', wait: 1500 },
  { name: '04-login', path: '/login', auth: false },
  { name: '05-subscription', path: '/subscription' },
  { name: '06-shorten', path: '/shorten', wait: 2000 },
  { name: '07-transcript', path: '/transcript' },
  { name: '08-download-hub', path: '/download' },
  { name: '09-download-video', path: '/download/video' },
  { name: '10-download-audio', path: '/download/audio' },
  { name: '11-download-playlist', path: '/download/playlist' },
  { name: '12-playlists', path: '/playlists', wait: 2000 },
  { name: '12b-playlist-detail', path: '/playlists/pl1', wait: 2500 },
  { name: '06b-shorten-filled', path: '/shorten', wait: 2000, action: async (p) => {
      await p.getByPlaceholder(/youtube.com\/watch/).first().fill('https://www.youtube.com/watch?v=OWeruyqhiTo');
      await p.getByPlaceholder(/custom/i).first().fill('node-auth').catch(()=>{});
      await p.waitForTimeout(1500);
  } },
  { name: '06c-shorten-links', path: '/shorten', wait: 2000, scrollText: 'Generated Short URLs', action: async (p) => { await p.mouse.wheel(0, 300); await p.waitForTimeout(800); } },
  { name: '06d-shorten-bulk', path: '/shorten', wait: 1500, action: async (p) => { await p.getByText('Bulk URLs').first().click(); await p.waitForTimeout(1000); } },
  { name: '11b-playlist-loaded', path: '/download/playlist', wait: 1500, action: async (p) => {
      await p.getByPlaceholder(/playlist\?list/).first().fill('https://www.youtube.com/playlist?list=PLKnIA16_Rmva');
      await p.getByText('Load Playlist').first().click(); await p.waitForTimeout(2500);
  } },
  { name: '02b-features-nav', path: '/', wait: 2000, action: async (p) => { await p.getByRole('button', { name: /Features/ }).first().click().catch(()=>{}); await p.waitForTimeout(1000); } },
  { name: '07b-transcript-filled', path: '/transcript', wait: 1500, action: async (p) => { await p.getByPlaceholder(/youtube.com\/watch/).first().fill('https://youtu.be/roxC8SMs7HU'); await p.waitForTimeout(800); } },
  { name: '12c-playlist-collab', path: '/playlists/pl1', wait: 2500, action: async (p) => { await p.getByRole('tab', { name: /Collaborators/ }).first().click(); await p.waitForTimeout(1000); } },
  { name: '13-playlist-create', path: '/playlists/create' },
  { name: '14-stream', path: '/stream', wait: 2000 },
  { name: '15-about', path: '/about' },
  { name: '16-blog', path: '/blog' },
  { name: '17-landing-dark', path: '/', auth: true, dark: true, wait: 2500 },
  { name: '18-shorten-dark', path: '/shorten', dark: true, wait: 2000 },
  { name: '19-mobile-landing', path: '/', auth: false, mobile: true, wait: 2500 },
  { name: '20-mobile-transcript', path: '/transcript', mobile: true },
];

(async () => {
  const browser = await chromium.launch();
  for (const s of shots) {
    if (only.length && !only.some((o) => s.name.includes(o))) continue;
    const ctx = await browser.newContext({
      viewport: s.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: s.mobile ? 2 : 1.5,
      colorScheme: s.dark ? 'dark' : 'light',
    });
    const page = await ctx.newPage();
    await setupPage(page, { auth: s.auth !== false, dark: !!s.dark });
    try {
      await page.goto(BASE + s.path, { waitUntil: 'networkidle', timeout: 45000 });
    } catch (e) { console.log('nav warn', s.name, e.message.split('\n')[0]); }
    await page.waitForTimeout(s.wait || 1500);
    if (s.scrollTo) { await page.locator(s.scrollTo).first().scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(1500); }
    if (s.scrollText) { await page.getByText(s.scrollText).first().scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(1500); }
    if (s.action) await s.action(page);
    await page.screenshot({ path: path.join(OUT, s.name + '.png'), fullPage: !!s.full });
    console.log('saved', s.name);
    await ctx.close();
  }
  await browser.close();
})();
