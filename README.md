# QKI Path Quote

QKI Chain（Chain ID `20181205`）上的路径报价、循环路径扫描与钱包兑换前端。

## 功能

- 自动测速预设 HTTPS RPC，并使用最快可用节点。
- 调用固定 Router 的 `getAmountsOut(uint256,address[])` 查询多跳路径。
- 内置 WQKI、USDT、GAS、CCT1、CCT2、QKN，并支持添加自定义 Token 快捷项。
- 输出可直接调用的 `["a","b"]` path 格式。
- 支持时间戳显示、Token decimals/raw 数量转换。
- 搜索最佳输入数量，按“输出减输入”比较毛利。
- 扫描更长的循环路径，按用户填写的 Gas Price 估算 gas 成本并计算净收益。
- 通过 `eth_call` 模拟路径是否可交易，并导出筛选结果。
- 扫描时可输入自定义模拟余额及 allowance；完整 `eth_call` 仍以链上真实状态为准。
- 连接注入式 EIP-1193 钱包并切换或添加 QKI 网络。
- 自定义授权数量、收款地址、amountOutMin、gas price 和有效期。
- 页面以醒目的选项支持标准 Token 与 Fee Token（转账扣税 Token）兑换。
- 响应式交易控制台界面，支持桌面与移动端。
- 每笔授权与兑换均在钱包中确认。

## 本地运行

```bash
python3 -m http.server 8080 --directory dist
```

然后打开 `http://localhost:8080`。

## 测试

```bash
node test.mjs
node network-test.mjs
node optimizer-test.mjs
node scanner-test.mjs
node wallet-test.mjs
```

## 固定配置

- Router: `0x3c91FD5247B050A1536F24D012a17a618EEFbfCA`
- Chain ID: `20181205`
- Gas price: 扫描与交易页面默认 `1000 Gwei`，均可自定义
