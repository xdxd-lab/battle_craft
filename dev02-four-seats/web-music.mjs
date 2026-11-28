import { TRACKS } from './music-tracks.mjs';
export default Object.fromEntries(TRACKS.map(({ id, file }) => [id, `../assets/music/${file}`]));
