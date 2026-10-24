// Generated 2026-10-24 from the channel's Videos tab (IDs, current titles, view counts)
// and upload dates from the research notes. Views are approximate; the page says "about".
export type Family = 'cant-miss' | 'explosive' | 'toolpath' | 'lock' | 'assembly' | 'other';

export interface Video {
  id: string;
  title: string;
  /** ISO upload date */
  date: string;
  views: number;
  family: Family;
}

export const families: Record<Family, string> = {
  'cant-miss': "Can't miss",
  explosive: 'Explosive',
  toolpath: 'Robot arm',
  lock: 'Lock',
  assembly: 'Assembly',
  other: 'Shop',
};

/** Oldest first. */
export const videos: Video[] = [
  { id: 'WuY2-OrT9ig', title: "Bending Steel With Plastic Tools", date: '2020-03-04', views: 1400000, family: 'other' },
  { id: 'BuC1IiZBY_o', title: "Making a particle filter that doesn't wear out for my plasma cutter", date: '2020-03-08', views: 2400000, family: 'other' },
  { id: 'c3LhK2SAusk', title: "This marker will change the way you work with sheet metal", date: '2020-03-17', views: 2600000, family: 'other' },
  { id: '8cNeAOpR-Ws', title: "3D Printed Sheet Metal Forming (Part 2)", date: '2020-03-22', views: 4099999, family: 'other' },
  { id: '1de6fO-9ZDU', title: "Fixing a little mess with a big mess", date: '2020-03-29', views: 3400000, family: 'other' },
  { id: 'lPMg0dk1hFI', title: "This machine changes everything", date: '2020-04-08', views: 2100000, family: 'other' },
  { id: 'vtN4tkvcBMA', title: "My curved basketball hoop always goes in", date: '2020-04-16', views: 9100000, family: 'cant-miss' },
  { id: 'IcjgrB9vTec', title: "How I made steel toe crocs with wood", date: '2020-04-27', views: 9300000, family: 'other' },
  { id: 'FycDx69px8U', title: "The automatic hoop always goes in", date: '2020-05-10', views: 8900000, family: 'cant-miss' },
  { id: 'o5Cv9fvajrc', title: "My self correcting golf club makes me a better golfer", date: '2020-06-02', views: 5900000, family: 'cant-miss' },
  { id: '8Au47gnXs0w', title: "See in complete darkness with touch", date: '2020-06-20', views: 6100000, family: 'other' },
  { id: '7zBrbdU_y0s', title: "I made a hair cutting machine", date: '2020-07-14', views: 8000000, family: 'toolpath' },
  { id: 'B3CsOx5U9Gs', title: "World's most powerful bat goes boom. Made on my new Tormach 24r", date: '2020-08-09', views: 8300000, family: 'explosive' },
  { id: 'myO8fxhDRW0', title: "Moving hoop won't let you miss", date: '2020-09-09', views: 28000000, family: 'cant-miss' },
  { id: 'Puo6Vgcbxps', title: "Explosive Bat: crushing MLB records. Ft: Smarter Every Day", date: '2020-10-18', views: 18000000, family: 'explosive' },
  { id: 'X9zXcnSXNF0', title: "Making a robot to carve photos into pumpkins", date: '2020-10-26', views: 9700000, family: 'toolpath' },
  { id: '_7vPNcnYWQ4', title: "Making an unpickable lock. Calling locksmiths", date: '2020-11-25', views: 18000000, family: 'lock' },
  { id: 'WQ8Xgp8ALFo', title: "Sometimes you have to test robots on yourself", date: '2020-12-22', views: 5400000, family: 'toolpath' },
  { id: 'vsTTXYxydOE', title: "Automatic pool stick vs. strangers", date: '2021-02-15', views: 23000000, family: 'cant-miss' },
  { id: 'ix68oRfI5Gw', title: "Chainsaw + robotic arm = art?", date: '2021-04-04', views: 7600000, family: 'toolpath' },
  { id: '2A2NY29iQdI', title: "TWO Unpickable (?) Locks for Lock Picking Lawyer!", date: '2021-05-31', views: 14000000, family: 'lock' },
  { id: 'SjJulcvTA7Y', title: "This is why I have 17,342 pounds of tools", date: '2021-06-29', views: 12000000, family: 'other' },
  { id: '1MkrNVic7pw', title: "Auto-aiming bow vs. FLYING targets", date: '2021-08-13', views: 15000000, family: 'cant-miss' },
  { id: 'osUTMnDFV30', title: "My GIANT wall painting robot", date: '2021-10-30', views: 7800000, family: 'toolpath' },
  { id: 'Q1RaC7YJ7sk', title: "Explosive powered nut cracker vs. metal nuts", date: '2021-12-05', views: 10000000, family: 'explosive' },
  { id: 'gnwIiw3Rz3I', title: "Wrist rocket: worlds fastest disc launcher", date: '2022-02-28', views: 9800000, family: 'explosive' },
  { id: 'xHWXZyfhQas', title: "I made a ball seeking hoop", date: '2022-06-05', views: 13000000, family: 'cant-miss' },
  { id: 'Gu_1S77XkiM', title: "A simple human task that's insanely hard for a robot", date: '2022-08-01', views: 7100000, family: 'toolpath' },
  { id: 'WsPHBD5NsS0', title: "Worlds hardest jigsaw vs. puzzle machine (all white)", date: '2022-12-01', views: 7500000, family: 'assembly' },
  { id: 'cQO2XTP7QDw', title: "I sent robot forgeries to a handwriting expert", date: '2023-05-27', views: 11000000, family: 'toolpath' },
  { id: 'wh8ij9NnLIQ', title: "Six questionably legal pencil sharpeners", date: '2023-10-11', views: 13000000, family: 'other' },
  { id: '9SRFbFreCkE', title: "I made these to do a ridiculously high dunk", date: '2024-01-01', views: 3900000, family: 'explosive' },
  { id: 't9rClZrbnrQ', title: "Precision guided launcher turns noobs into pros", date: '2024-05-02', views: 5000000, family: 'cant-miss' },
  { id: 'YqywL9PkM2s', title: "After 100+ parts and 45 hours of practice, I did it", date: '2024-08-09', views: 4099999, family: 'other' },
  { id: 'aXfTgCCsRSg', title: "What if we made a camera that sees in reverse?", date: '2024-12-04', views: 5900000, family: 'other' },
  { id: 'BO_YGcSzJdA', title: "I really thought this would fly well", date: '2025-03-04', views: 3500000, family: 'other' },
  { id: 'dXIkUkwzTQU', title: "Baking brownies from the inside out", date: '2025-06-02', views: 7800000, family: 'other' },
  { id: 'vJ43DjwLPGA', title: "Why is this task so difficult for machines?", date: '2025-08-30', views: 3200000, family: 'other' },
  { id: 'JQB8aNKyeao', title: "Making an autocorrect mini golf club (part 1)", date: '2026-01-01', views: 2300000, family: 'cant-miss' },
  { id: '2OfjZ3ORJfc', title: "Robot golf vs holes that keep getting harder", date: '2026-04-15', views: 5400000, family: 'cant-miss' },
  { id: 'RpslsMqPFWA', title: "I made an apple peel itself", date: '2026-08-05', views: 3700000, family: 'toolpath' },
];

export const latest = videos[videos.length - 1];
export const thumb = (id: string, size: 'hq' | 'maxres' | 'mq' | 'sd' = 'hq') =>
  `https://i.ytimg.com/vi/${id}/${size}default.jpg`;
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
export const channelUrl = 'https://www.youtube.com/@stuffmadehere';
