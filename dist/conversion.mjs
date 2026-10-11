import {MAX,units} from './abi.mjs';
export function decimals(value){if(!/^\d{1,3}$/.test(value)||Number(value)>255)throw Error('精度必须是 0–255 的整数');return Number(value)}
export function rawValue(value){if(!/^\d{1,1000}$/.test(value))throw Error('链上数量必须是非负十进制整数');const n=BigInt(value);if(n>MAX)throw Error('数量超过 uint256 上限');return n.toString()}
export function toRaw(value,d){d=decimals(String(d));if(value.length>1000||!/^\d+(\.\d+)?$/.test(value))throw Error('请输入普通非负小数，不支持科学计数法');const [whole,fraction='']=value.split('.');if(fraction.length>d)throw Error('小数位数超过 Token 精度，未进行截断或四舍五入');return rawValue(whole+fraction.padEnd(d,'0'))}
export function toHuman(value,d){return units(rawValue(value),decimals(String(d)))}
export function deadline(now,minutes){if(!/^\d{1,6}$/.test(minutes)||Number(minutes)<1||Number(minutes)>525600)throw Error('请输入 1–525600 之间的整数分钟');return Math.floor(now/1000)+Number(minutes)*60}
