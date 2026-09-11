/** Phase R — Battleversia domain contracts and deterministic game rules. */
export type BVUniverse='anime'|'marvel'|'dc';
export type BVAuctionMode='overall'|'anime'|'marvel'|'dc'|'marvel_vs_dc'|'anime_vs_dc'|'dc_vs_marvel';
export type BVAuctionStatus='lobby'|'active'|'paused'|'completed'|'cancelled';
export type BVTournamentStatus='draft'|'registration'|'active'|'paused'|'completed'|'cancelled';
export interface BVCharacter { id:string; slug:string; name:string; universe:BVUniverse; power_score:number; price:number; market_available:boolean; }
export const YON_SYMBOL='◈';
export const DEFAULT_AUCTION_FUND=100000;
export const BID_WINDOW_SECONDS=15;
export const AUCTION_MIN_PLAYERS=2;
export const AUCTION_MAX_PLAYERS=5;
export function validAuctionMode(mode:string):mode is BVAuctionMode{return ['overall','anime','marvel','dc','marvel_vs_dc','anime_vs_dc','dc_vs_marvel'].includes(mode);}
export function allowedUniverses(mode:BVAuctionMode):BVUniverse[]{switch(mode){case'anime':return['anime'];case'marvel':return['marvel'];case'dc':return['dc'];case'marvel_vs_dc':return['marvel','dc'];case'anime_vs_dc':return['anime','dc'];case'dc_vs_marvel':return['dc','marvel'];default:return['anime','marvel','dc'];}}
export function nextBidDeadline(now=new Date()):string{return new Date(now.getTime()+BID_WINDOW_SECONDS*1000).toISOString();}
export function canJoinAuction(status:BVAuctionStatus,count:number,maxPlayers:number):boolean{return (status==='lobby'||status==='active')&&count<maxPlayers;}
export function initialAuctionFund(value?:number):number{return Number.isFinite(value)&&Number(value)>=0?Number(value):DEFAULT_AUCTION_FUND;}
export function canonicalCharacterScore(power:number,price:number):number{return Math.round((Number(power)||0)*1000)/1000+(Number(price)||0)/1000000;}
export function tournamentValid(min:number,max:number):boolean{return Number.isInteger(min)&&Number.isInteger(max)&&min>=2&&max>=min;}
export function moduleSlug():string{return'battleversia';}
