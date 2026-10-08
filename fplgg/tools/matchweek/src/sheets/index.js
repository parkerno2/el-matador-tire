/* sheet registry: each sheet module exports { render(arg) → html, mount?(el,arg), unmount?(el), cls? } */
import player from './player.js';
import manager from './manager.js';
import identity from './identity.js';
import search from './search.js';
import menu from './menu.js';
import post from '../feed/post-sheet.js';
export const SHEETS = { player, manager, identity, search, menu, post };
