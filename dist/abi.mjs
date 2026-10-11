export const MAX = (1n << 256n) - 1n;
export function uint(value) {
  if (!/^[0-9]+$/.test(value)) throw Error('amountIn 必须是十进制整数，不支持小数或科学计数法');
  const n = BigInt(value);
  if (n > MAX || n === 0n) throw Error('amountIn 必须大于 0，且不超过 uint256 上限');
  return n;
}
export function address(value) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value) || /^0x0{40}$/i.test(value)) throw Error('请输入完整、非零的 0x 合约地址（40 位十六进制）');
  return value;
}
export const word = n => BigInt(n).toString(16).padStart(64, '0');
export function encode(amount, path) {
  if (path.length < 2 || path.length > 20) throw Error('路径需要 2–20 个 token 地址');
  path.forEach(address);
  for (let i = 1; i < path.length; i++) if (path[i].toLowerCase() === path[i-1].toLowerCase()) throw Error('相邻 token 不能相同');
  return '0xd06ca61f' + word(uint(amount)) + word(64) + word(path.length) + path.map(a => a.slice(2).toLowerCase().padStart(64,'0')).join('');
}
export function decode(hex, count) {
  if (typeof hex !== 'string' || !/^0x(?:[0-9a-fA-F]{64})+$/.test(hex)) throw Error('Router 未返回有效 ABI 数据，请检查网络和地址');
  const s = hex.slice(2);
  if (BigInt('0x' + s.slice(0,64)) !== 32n || s.length < 128) throw Error('无效的数组偏移');
  if (BigInt('0x' + s.slice(64,128)) !== BigInt(count) || s.length !== 128 + count*64) throw Error('返回数组长度与路径不一致');
  return Array.from({length:count}, (_,i) => BigInt('0x' + s.slice(128+i*64,192+i*64)).toString());
}
export function units(raw, decimals) {
  if (decimals === 0) return raw;
  const s=raw.padStart(decimals+1,'0');
  return s.slice(0,-decimals) + (s.slice(-decimals).replace(/0+$/,'') ? '.'+s.slice(-decimals).replace(/0+$/,'') : '');
}
